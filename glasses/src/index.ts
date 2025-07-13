/**
 * Main entry point for the Nutrition Lens smart glasses application
 * 
 * This application captures photos, uploads them to UploadThing, analyzes nutrition
 * facts using Claude Vision API, and sends results to Discord webhooks.
 * Optimized with parallel processing using worker threads.
 */

import { AppServer, AppSession } from '@mentra/sdk';
import { CONFIG } from './config/environment';
import { PhotoManager } from './services/photo-manager';
import { setupWebviewRoutes } from './routes/webview';
import { elevenlabsTTS } from './services/elevenlabs.mts';
import { analyzeDietaryQuestionWithAudio, analyzeDietaryQuestionWithSession } from './services/claude-dietary-analysis';
import { getUserProfile } from './services/supabase';
import { uploadPhotoToUploadThing } from './services/uploadthing';
import { UserDietaryProfile } from './types';
import { 
  defaultWorkerManager, 
  initializeDefaultWorkers, 
  shutdownDefaultWorkers,
  WorkerMessage 
} from './utils/worker-manager';
import * as fs from 'fs';
import * as path from 'path';

// Worker thread interfaces for type safety
interface ImageProcessingMessage extends WorkerMessage {
  type: 'process_image';
  photoData: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
    requestId: string;
  };
  userId: string;
  question?: string;
}

interface AudioProcessingMessage extends WorkerMessage {
  type: 'process_audio';
  audioData: ArrayBuffer;
  userId: string;
  context: string;
}

/**
 * Photo Taker App with parallel processing capabilities
 * Extends AppServer to provide optimized photo taking and audio processing
 */
class NutritionLensApp extends AppServer {
  private photoManager: PhotoManager = new PhotoManager();
  private isStreamingPhotos: Map<string, boolean> = new Map();
  private nextPhotoTime: Map<string, number> = new Map();
  private cameraReady: Map<string, boolean> = new Map();
  private cameraInUse: Map<string, boolean> = new Map();
  private lastCameraOperation: Map<string, number> = new Map();
  private userSessions: Map<string, AppSession> = new Map();
  private isCapturingQuestion: Map<string, boolean> = new Map();
  private capturedQuestions: Map<string, string> = new Map();
  private cleanupHandlers: Map<string, Array<() => void>> = new Map();

  // Parallel processing state
  private workersInitialized: boolean = false;

  constructor() {
    super({
      packageName: CONFIG.PACKAGE_NAME,
      apiKey: CONFIG.MENTRAOS_API_KEY,
      port: CONFIG.PORT,
    });
    this.setupMiddleware();
    this.setupWebviewRoutes();
    this.setupPhotoManagerCallbacks();
    this.initializeWorkers();
  }

  /**
   * Initialize worker threads for parallel processing
   */
  private async initializeWorkers(): Promise<void> {
    try {
      console.log('🚀 Initializing worker threads for parallel processing...');
      this.workersInitialized = await initializeDefaultWorkers();
      
      if (this.workersInitialized) {
        console.log('✅ Parallel processing enabled with worker threads');
      } else {
        console.log('⚠️ Falling back to single-threaded processing');
      }
    } catch (error) {
      console.warn('⚠️ Workers not available, using single-threaded processing:', error);
      this.workersInitialized = false;
    }
  }

  /**
   * Process image in parallel using worker thread
   */
  private async processImageParallel(photoData: any, userId: string, question?: string): Promise<any> {
    if (!this.workersInitialized || !defaultWorkerManager.isWorkerAvailable('image')) {
      return this.processImageSingleThreaded(photoData, userId, question);
    }

    try {
      const taskId = defaultWorkerManager.generateTaskId('image');
      const message: ImageProcessingMessage = {
        type: 'process_image',
        id: taskId,
        photoData: {
          buffer: photoData.buffer,
          filename: photoData.filename,
          mimeType: photoData.mimeType,
          requestId: photoData.requestId
        },
        userId,
        question
      };

      return await defaultWorkerManager.sendTask('image', message);
    } catch (error) {
      console.warn('⚠️ Parallel image processing failed, falling back to single-threaded:', error);
      return this.processImageSingleThreaded(photoData, userId, question);
    }
  }

  /**
   * Process audio in parallel using worker thread
   */
  private async processAudioParallel(audioData: ArrayBuffer, userId: string, context: string): Promise<any> {
    if (!this.workersInitialized || !defaultWorkerManager.isWorkerAvailable('audio')) {
      return this.processAudioSingleThreaded(audioData, userId, context);
    }

    try {
      const taskId = defaultWorkerManager.generateTaskId('audio');
      const message: AudioProcessingMessage = {
        type: 'process_audio',
        id: taskId,
        audioData,
        userId,
        context
      };

      return await defaultWorkerManager.sendTask('audio', message);
    } catch (error) {
      console.warn('⚠️ Parallel audio processing failed, falling back to single-threaded:', error);
      return this.processAudioSingleThreaded(audioData, userId, context);
    }
  }

  /**
   * Fallback single-threaded image processing
   */
  private async processImageSingleThreaded(photoData: any, userId: string, question?: string): Promise<any> {
    try {
      const uploadedFile = await uploadPhotoToUploadThing(
        photoData.buffer,
        photoData.filename,
        photoData.mimeType,
        userId,
        photoData.requestId
      );

      if (question) {
        const result = await analyzeDietaryQuestionWithAudio(question, uploadedFile.url, 'Nathan');
        return { uploadedFile, analysis: result };
      }

      return { uploadedFile };
    } catch (error) {
      throw new Error(`Single-threaded image processing failed: ${error}`);
    }
  }

  /**
   * Fallback single-threaded audio processing
   */
  private async processAudioSingleThreaded(audioData: ArrayBuffer, userId: string, context: string): Promise<any> {
    try {
      return { processed: true, audioLength: audioData.byteLength, context };
    } catch (error) {
      throw new Error(`Single-threaded audio processing failed: ${error}`);
    }
  }

  /**
   * Set up Express middleware with error handling
   */
  private setupMiddleware(): void {
    try {
      // Try to access getExpressApp method, fallback if not available
      if (typeof (this as any).getExpressApp === 'function') {
        const app = (this as any).getExpressApp();
    app.use(require('express').json());
        console.log('✅ Express middleware setup successful');
      } else {
        console.warn('⚠️ getExpressApp method not available, skipping middleware setup');
      }
    } catch (error) {
      console.warn('⚠️ Express middleware setup failed:', error);
    }
  }

  /**
   * Set up PhotoManager callbacks for audio playback
   */
  private setupPhotoManagerCallbacks(): void {
    this.photoManager.setAudioPlaybackCallback(async (userId: string, audioUrl: string) => {
      await this.playAudioOnGlasses(userId, audioUrl);
    });
  }

  /**
   * Play audio on the glasses using MentraOS layout system
   */
  private async playAudioOnGlasses(userId: string, audioUrl: string): Promise<void> {
    const session = this.userSessions.get(userId);
    if (!session) {
      console.error(`No active session found for user ${userId} for audio playback`);
      throw new Error('No active session found for audio playback');
    }

    try {
      session.logger.info(`Playing audio on glasses for user ${userId}: ${audioUrl}`);
      
      if (session.layouts && typeof session.layouts.showTextWall === 'function') {
        session.layouts.showTextWall("🎵 Audio Playing...");
        
        setTimeout(() => {
          if (session.layouts && typeof session.layouts.showTextWall === 'function') {
            session.layouts.showTextWall("");
          }
        }, 3000);
      }

      try {
        await session.audio.playAudio({audioUrl: audioUrl});
        session.logger.info(`Audio playback initiated successfully for user ${userId}`);
      } catch (audioError) {
        session.logger.warn(`Direct audio playback failed, using fallback: ${audioError}`);
        
      const audioHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Audio Player</title>
        </head>
        <body style="margin:0; padding:0; background:transparent;">
          <audio autoplay>
            <source src="${audioUrl}" type="audio/mpeg">
            <source src="${audioUrl}" type="audio/wav">
            <source src="${audioUrl}" type="audio/ogg">
            Your browser does not support the audio element.
          </audio>
          <script>
            setTimeout(() => {
              window.close();
            }, 5000);
          </script>
        </body>
        </html>
      `;

      const tempDir = '/tmp';
      const tempFileName = `audio_player_${userId}_${Date.now()}.html`;
      const tempFilePath = path.join(tempDir, tempFileName);
      
      fs.writeFileSync(tempFilePath, audioHtml);
        session.logger.info(`Created audio player file: ${tempFilePath}`);
      
      setTimeout(() => {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (error) {
            session.logger.warn(`Failed to cleanup temporary audio file: ${error}`);
        }
      }, 10000);
      }
      
    } catch (error) {
      session.logger.error(`Error playing audio on glasses for user ${userId}: ${error}`);
      throw error;
    }
  }

  /**
   * Handle new session creation and button press events with parallel processing
   */
  protected async onSession(session: AppSession, sessionId: string, userId: string): Promise<void> {
    session.logger.info(`Session started for user ${userId}`);
    this.userSessions.set(userId, session);
    this.cleanupHandlers.set(sessionId, []);

    // Initialize user state
    this.isStreamingPhotos.set(userId, false);
    this.nextPhotoTime.set(userId, Date.now());
    this.cameraReady.set(userId, false);
    this.isCapturingQuestion.set(userId, false);
    this.capturedQuestions.set(userId, '');

    // Check capabilities before setting up features
    if (!session.capabilities) {
      session.logger.warn('Capabilities not available yet, deferring setup');
      return;
    }

    // Pre-warm the camera for instant capture if available
    if (session.capabilities.hasCamera) {
      await this.prewarmCameraOptimized(session, userId);
    } else {
      session.logger.info('No camera available - photo features disabled');
    }

    // Handle transcription events for question capture with parallel audio processing
    if (session.capabilities.hasMicrophone) {
      const unsubscribeTranscription = session.events.onTranscription(async (data) => {
      if (this.isCapturingQuestion.get(userId) && data.isFinal) {
        const currentQuestion = this.capturedQuestions.get(userId) || '';
        const newQuestion = currentQuestion + ' ' + data.text.trim();
        this.capturedQuestions.set(userId, newQuestion.trim());
          session.logger.info(`📝 Captured question from ${userId}: "${data.text}"`);
        
          // Process audio in parallel if worker is available
          if (this.workersInitialized && data.text) {
            this.processAudioParallel(
              new TextEncoder().encode(data.text).buffer,
              userId,
              'transcription'
            ).catch(error => {
              session.logger.warn(`Audio processing failed: ${error}`);
            });
          }
          
        if (session.layouts && typeof session.layouts.showTextWall === 'function') {
          session.layouts.showTextWall(`🎤 Question: ${newQuestion.trim()}`);
        }
      }
    });

      this.addSessionCleanupHandler(sessionId, unsubscribeTranscription);
    }

    // Handle button press events
    if (session.capabilities.hasButton) {
      const unsubscribeButton = session.events.onButtonPress((button) => {
        session.logger.info(`Button pressed: ${button.buttonId} (${button.pressType})`);
      
      if (button.pressType === 'long') {
          // Long press: Use parallel processing for question capture and analysis
        if (this.isCapturingQuestion.get(userId)) {
            this.stopQuestionCaptureAndAnalyzeParallel(session, userId);
        } else {
          this.startQuestionCapture(session, userId);
        }
      } else {
          // Short press: Use single-threaded processing for immediate photo
        session.audio.playAudio({audioUrl: 'https://p70oi85l49.ufs.sh/f/nh2RhlWG3N8JdhLgZNdJUzAnxuO94lXyfcDtQHhpJgCwiVWK'})
        this.takePhotoImmediate(session, userId);
      }
    });

      this.addSessionCleanupHandler(sessionId, unsubscribeButton);
    }

    // Set up optimized streaming photo interval with single-threaded processing
    this.setupStreamingPhotoInterval(session, userId, sessionId);
  }

  /**
   * Add a cleanup handler for a specific session
   */
  private addSessionCleanupHandler(sessionId: string, handler: () => void): void {
    const handlers = this.cleanupHandlers.get(sessionId) || [];
    handlers.push(handler);
    this.cleanupHandlers.set(sessionId, handlers);
  }

  /**
   * Pre-warm the camera for instant capture - optimized version
   */
  private async prewarmCameraOptimized(session: AppSession, userId: string): Promise<void> {
    try {
      const caps = session.capabilities;
      if (!caps?.hasCamera) {
        session.logger.warn(`No camera available for user ${userId}`);
        return;
      }

      if (caps.camera) {
        session.logger.info(`Camera capabilities for user ${userId}: focus=${caps.camera.hasFocus}, HDR=${caps.camera.hasHDR}`);
      }

      session.logger.info(`Pre-warming camera for user ${userId}`);
      
      const preWarmPromise = session.camera.requestPhoto();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Pre-warm timeout after 3 seconds')), 3000);
      });

      try {
        await Promise.race([preWarmPromise, timeoutPromise]);
      this.cameraReady.set(userId, true);
        session.logger.info(`Camera pre-warmed successfully for user ${userId}`);
      } catch (error) {
        session.logger.warn(`Camera pre-warm failed (non-critical): ${error}`);
        this.cameraReady.set(userId, false);
      }
    } catch (error) {
      session.logger.error(`Error pre-warming camera for user ${userId}: ${error}`);
      this.cameraReady.set(userId, false);
    }
  }

  /**
   * Set up optimized streaming photo interval with single-threaded processing
   */
  private setupStreamingPhotoInterval(session: AppSession, userId: string, sessionId: string): void {
    const intervalId = setInterval(async () => {
      if (this.isStreamingPhotos.get(userId) && Date.now() > (this.nextPhotoTime.get(userId) ?? 0)) {
        try {
          this.nextPhotoTime.set(userId, Date.now() + 30000);

          if (!session.capabilities?.hasCamera) {
            session.logger.error('❌ No camera available for streaming photo');
            return;
          }

          // Check camera availability for streaming photos
          const waitResult = await this.waitForCameraAvailability(session, userId, 5000);
          if (!waitResult) {
            session.logger.warn('⚠️ Camera not available for streaming photo, skipping');
            return;
          }
          
          const photo = await this.capturePhotoWithEnhancedTimeout(session, userId, 8000);
          if (photo) {
            this.nextPhotoTime.set(userId, Date.now());
            this.lastCameraOperation.set(userId, Date.now());
            
            // Process photo using original nutrition analysis workflow for streaming
            try {
              await this.processNutritionAnalysisWorkflow(session, photo, userId);
              session.logger.info('📸 Streaming photo nutrition analysis completed');
            } catch (error) {
              session.logger.error(`Streaming photo nutrition analysis failed: ${error}`);
            }
          }
        } catch (error) {
          session.logger.error(`Error auto-taking photo: ${error}`);
        }
      }
    }, 2000);

    this.addSessionCleanupHandler(sessionId, () => {
      clearInterval(intervalId);
    });
  }

  /**
   * Take photo immediately with single-threaded processing (for regular button press)
   */
  private takePhotoImmediate(session: AppSession, userId: string): void {
    this.takePhotoImmediateAsync(session, userId).catch(error => {
      session.logger.error(`Error in immediate photo capture: ${error}`);
    });
  }

  /**
   * Single-threaded async version of immediate photo capture (for regular button press)
   * Follows original workflow: photo → upload → nutrition analysis → database
   */
  private async takePhotoImmediateAsync(session: AppSession, userId: string): Promise<void> {
    try {
      if (!session.capabilities?.hasCamera) {
        session.logger.error('❌ No camera available for immediate photo');
        return;
      }

      // Check if camera is busy and wait with better timeout handling
      const waitResult = await this.waitForCameraAvailability(session, userId, 8000);
      if (!waitResult) {
        session.logger.warn('⚠️ Camera timeout - unable to capture photo, please try again');
        if (session.layouts && typeof session.layouts.showTextWall === 'function') {
          session.layouts.showTextWall('📸 Camera busy. Please wait and try again.');
        }
        return;
      }

      session.logger.info(`📸 Taking immediate photo for user ${userId} (single-threaded nutrition analysis)`);
      this.cameraInUse.set(userId, true);

      if (session.layouts && typeof session.layouts.showTextWall === 'function') {
        session.layouts.showTextWall('📸 Taking photo for nutrition analysis...');
      }

      const photo = await this.capturePhotoWithEnhancedTimeout(session, userId, 10000);
      
      if (photo) {
        session.logger.info(`✅ Immediate photo captured successfully`);

        // Process using original nutrition analysis workflow (single-threaded)
        try {
          await this.processNutritionAnalysisWorkflow(session, photo, userId);
        } catch (error) {
          session.logger.error(`Nutrition analysis workflow failed: ${error}`);
          if (session.layouts && typeof session.layouts.showTextWall === 'function') {
            session.layouts.showTextWall('❌ Nutrition analysis failed. Try again.');
          }
        }
      } else {
        session.logger.warn(`⚠️ Immediate photo capture returned null`);
        if (session.layouts && typeof session.layouts.showTextWall === 'function') {
          session.layouts.showTextWall('❌ Photo capture failed. Try again.');
        }
      }

    } catch (error) {
      session.logger.error(`❌ Immediate photo capture failed: ${error}`);
      
      if (session.layouts && typeof session.layouts.showTextWall === 'function') {
        session.layouts.showTextWall('📸 Photo failed. Try again.');
      }
    } finally {
      this.cameraInUse.set(userId, false);
      this.lastCameraOperation.set(userId, Date.now());
    }
  }

  /**
   * Optimized photo capture with better timeout and retry logic
   */
  private async capturePhotoOptimized(session: AppSession, userId: string, timeoutMs: number = 8000): Promise<any | null> {
    try {
      if (!session.capabilities?.hasCamera) {
        session.logger.error('❌ No camera available on this device');
        return null;
      }

      const photoPromise = session.camera.requestPhoto();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Photo request timed out after ${timeoutMs}ms`)), timeoutMs);
      });

      const photo = await Promise.race([photoPromise, timeoutPromise]);
      session.logger.info(`✅ Photo captured successfully`);
      return photo;

    } catch (error) {
      session.logger.warn(`⚠️ Photo capture failed: ${error}`);
      return null;
    }
  }

  /**
   * Wait for camera to become available with proper cooldown management
   */
  private async waitForCameraAvailability(session: AppSession, userId: string, maxWaitMs: number = 8000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      // Check if camera is currently in use by another operation
      if (!this.cameraInUse.get(userId)) {
        // Check if enough time has passed since last operation (minimum 2 seconds cooldown)
        const lastOperation = this.lastCameraOperation.get(userId) || 0;
        const timeSinceLastOp = Date.now() - lastOperation;
        
        if (timeSinceLastOp >= 2000) {
          session.logger.info(`✅ Camera available for user ${userId} (${timeSinceLastOp}ms since last operation)`);
          return true;
        } else {
          const remainingCooldown = 2000 - timeSinceLastOp;
          session.logger.info(`⏳ Camera cooldown: waiting ${remainingCooldown}ms more for user ${userId}`);
          await new Promise(resolve => setTimeout(resolve, Math.min(remainingCooldown, 500)));
        }
      } else {
        session.logger.info(`⏳ Camera busy, waiting for availability for user ${userId}`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    session.logger.warn(`❌ Camera availability timeout after ${maxWaitMs}ms for user ${userId}`);
    return false;
  }

  /**
   * Enhanced photo capture with better timeout handling for consecutive operations
   */
  private async capturePhotoWithEnhancedTimeout(session: AppSession, userId: string, timeoutMs: number = 10000): Promise<any | null> {
    try {
      if (!session.capabilities?.hasCamera) {
        session.logger.error('❌ No camera available on this device');
        return null;
      }

      // For consecutive operations, use longer timeout
      const lastOperation = this.lastCameraOperation.get(userId) || 0;
      const timeSinceLastOp = Date.now() - lastOperation;
      
      // If last operation was recent, increase timeout to account for camera reset time
      let adjustedTimeout = timeoutMs;
      if (timeSinceLastOp < 10000) {
        adjustedTimeout = Math.max(timeoutMs, 12000);
        session.logger.info(`📸 Using extended timeout (${adjustedTimeout}ms) due to recent camera operation`);
      }

      session.logger.info(`📸 Starting photo capture with ${adjustedTimeout}ms timeout`);
      
      const captureStartTime = Date.now();
      const photoPromise = session.camera.requestPhoto();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Photo request timed out after ${adjustedTimeout}ms`)), adjustedTimeout);
      });

      const photo = await Promise.race([photoPromise, timeoutPromise]);
      session.logger.info(`✅ Photo captured successfully in ${Date.now() - captureStartTime}ms`);
      return photo;

    } catch (error) {
      session.logger.warn(`⚠️ Enhanced photo capture failed: ${error}`);
      return null;
    }
  }

  /**
   * Play TTS audio on the glasses for a specific user
   */
  public async playTTSForUser(userId: string, text: string): Promise<void> {
    const session = this.userSessions.get(userId);
    if (!session) {
      console.error(`No active session found for user ${userId}`);
      throw new Error('No active session found');
    }

    try {
      session.logger.info(`Generating and uploading TTS for user ${userId}: "${text}"`);
      
      const uploadResult = await elevenlabsTTS.generateAndUploadTTS(text, userId);
      session.logger.info(`TTS audio uploaded to: ${uploadResult.url}`);
      
      if (session.layouts && typeof session.layouts.showTextWall === 'function') {
        session.layouts.showTextWall(`🔊 ${text}\n📤 Uploaded to bucket`);
        
        setTimeout(() => {
          if (session.layouts && typeof session.layouts.showTextWall === 'function') {
            session.layouts.showTextWall("");
          }
        }, 5000);
      }
      
      session.logger.info(`TTS generated and uploaded successfully for user ${userId}. File key: ${uploadResult.key}`);
      
    } catch (error) {
      session.logger.error(`Error generating and uploading TTS for user ${userId}: ${error}`);
      throw error;
    }
  }

  /**
   * Start capturing question via transcription
   */
  private startQuestionCapture(session: AppSession, userId: string): void {
    session.logger.info(`🎤 Starting question capture for user ${userId}`);
    this.isCapturingQuestion.set(userId, true);
    this.capturedQuestions.set(userId, '');
    
    if (session.layouts && typeof session.layouts.showTextWall === 'function') {
      session.layouts.showTextWall('🎤 Listening for your question...\nHold button again to stop and analyze');
    }
  }

  /**
   * Stop question capture and analyze with photo - parallel processing version
   * THIS IS THE ONLY METHOD THAT USES PARALLEL PROCESSING
   */
  private async stopQuestionCaptureAndAnalyzeParallel(session: AppSession, userId: string): Promise<void> {
    session.logger.info(`🛑 Stopping question capture for user ${userId}`);
    this.isCapturingQuestion.set(userId, false);
    
    const question = this.capturedQuestions.get(userId) || '';
    
    if (!question.trim()) {
      session.logger.warn(`No question captured for user ${userId}`);
      if (session.layouts && typeof session.layouts.showTextWall === 'function') {
        session.layouts.showTextWall('❌ No question captured. Try again.');
      }
      return;
    }

    try {
      if (session.layouts && typeof session.layouts.showTextWall === 'function') {
        session.layouts.showTextWall('📸 Taking photo and analyzing with parallel processing...');
      }

      session.logger.info(`📝 Question captured: "${question}"`);
      session.logger.info(`📸 Taking photo for dietary analysis with parallel processing...`);

      // Take a photo with optimized capture
      const photo = await this.capturePhotoWithRetryOptimized(session, userId);
      
      if (!photo) {
        session.logger.error('❌ Failed to capture photo after retries');
        if (session.layouts && typeof session.layouts.showTextWall === 'function') {
          session.layouts.showTextWall('❌ Photo capture failed. Try again.');
        }
        return;
      }
      
      // ONLY USE PARALLEL PROCESSING FOR CLICK AND HOLD SUBMISSIONS
      session.logger.info('🚀 Using parallel processing for question-based dietary analysis');
      
      // Process image and audio in parallel
      const [imageResult] = await Promise.allSettled([
        this.processImageParallel(photo, userId, question),
        this.processAudioParallel(
          new TextEncoder().encode(question).buffer,
          userId,
          'dietary_question'
        )
      ]);

      if (imageResult.status === 'fulfilled') {
        const result = imageResult.value;
        
        if (result.analysis) {
          // Store the audio URL and play it
          const audioUrlFromClaude: string = result.analysis.audioUrl;
      session.audio.playAudio({audioUrl: audioUrlFromClaude});
      
          // Print analysis to terminal
          console.log('\n🤖 === CLAUDE DIETARY ANALYSIS WITH PARALLEL PROCESSING ===');
      console.log(`👤 User: Nathan`);
      console.log(`❓ Question: "${question}"`);
          console.log(`📷 Image: ${result.uploadedFile.url}`);
      console.log(`💬 Analysis:`);
          console.log(result.analysis.analysis);
          console.log(`🎧 Audio URL: ${result.analysis.audioUrl}`);
          console.log(`🔑 Audio Key: ${result.analysis.audioKey}`);
      console.log('===============================================\n');
        }

        session.logger.info('✅ Analysis complete with parallel processing and optimized glasses display');
      } else {
        throw new Error('Parallel image processing failed');
      }

    } catch (error) {
      session.logger.error(`❌ Error during parallel dietary analysis: ${error}`);
      if (session.layouts && typeof session.layouts.showTextWall === 'function') {
        session.layouts.showTextWall('❌ Analysis failed. Try again.');
      }
    } finally {
      this.capturedQuestions.delete(userId);
    }
  }

  /**
   * Optimized capture photo with retry logic and better timeout handling
   */
  private async capturePhotoWithRetryOptimized(session: AppSession, userId: string, maxRetries: number = 2): Promise<any | null> {
    // Use enhanced camera availability check
    const waitResult = await this.waitForCameraAvailability(session, userId, 10000);
    if (!waitResult) {
      session.logger.error('❌ Camera not available for dietary analysis after waiting');
        return null;
    }

    this.cameraInUse.set(userId, true);

    try {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          session.logger.info(`📸 Photo capture attempt ${attempt}/${maxRetries}`);
          
          if (attempt > 1 && session.layouts && typeof session.layouts.showTextWall === 'function') {
            session.layouts.showTextWall(`📸 Retrying photo... (${attempt}/${maxRetries})`);
          }

          // Use enhanced timeout with longer delays for retries
          const baseTimeout = 10000 + (attempt - 1) * 3000;
          const photo = await this.capturePhotoWithEnhancedTimeout(session, userId, baseTimeout);
          
          if (photo) {
            session.logger.info(`✅ Photo captured successfully on attempt ${attempt}`);
          return photo;
          }

        } catch (error) {
          session.logger.warn(`⚠️ Photo capture attempt ${attempt} failed: ${error}`);
          
          if (attempt === maxRetries) {
            session.logger.error(`❌ All photo capture attempts failed: ${error}`);
            return null;
          }

          // Longer delays between retries for camera recovery
          const delay = 2000 * attempt;
          session.logger.info(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      return null;
    } finally {
      this.cameraInUse.set(userId, false);
      this.lastCameraOperation.set(userId, Date.now());
    }
  }

  /**
   * Process nutrition analysis workflow for regular button press
   * Follows original flow: upload → Claude nutrition analysis → database storage
   */
  private async processNutritionAnalysisWorkflow(session: AppSession, photo: any, userId: string): Promise<void> {
    try {
      session.logger.info('🍎 Starting nutrition analysis workflow (upload → analyze → store)');
      
      if (session.layouts && typeof session.layouts.showTextWall === 'function') {
        session.layouts.showTextWall('📤 Uploading photo...');
      }

      // Step 1: Upload photo to UploadThing
      const uploadedFile = await uploadPhotoToUploadThing(
        photo.buffer,
        photo.filename,
        photo.mimeType,
        userId,
        photo.requestId
      );

      session.logger.info(`✅ Photo uploaded to UploadThing: ${uploadedFile.url}`);
      
      if (session.layouts && typeof session.layouts.showTextWall === 'function') {
        session.layouts.showTextWall('🧠 Analyzing nutrition...');
      }

      // Step 2: Analyze nutrition facts using Claude Vision API
      const { analyzeNutritionFacts } = await import('./services/nutrition-analysis');
      const nutritionData = await analyzeNutritionFacts(uploadedFile.url);

      if (!nutritionData) {
        throw new Error('Nutrition analysis returned null');
      }

      session.logger.info('✅ Nutrition analysis completed successfully');
      
      // Add image URL to nutrition data
      nutritionData.imgURL = uploadedFile.url;

      if (session.layouts && typeof session.layouts.showTextWall === 'function') {
        session.layouts.showTextWall('💾 Saving to database...');
      }

      // Step 3: Store nutrition data in Supabase database
      const { insertNutritionData } = await import('./services/supabase');
      const saveSuccess = await insertNutritionData(nutritionData);

      if (!saveSuccess) {
        throw new Error('Failed to save nutrition data to database');
      }

      session.logger.info('✅ Nutrition data saved to database successfully');

      // Display success message with key nutrients
      const caloriesText = nutritionData.calories ? `${nutritionData.calories} cal` : 'N/A cal';
      const proteinText = nutritionData.protein ? `${nutritionData.protein}g protein` : 'N/A protein';
      const carbsText = nutritionData.carbs ? `${nutritionData.carbs}g carbs` : 'N/A carbs';

      if (session.layouts && typeof session.layouts.showTextWall === 'function') {
        session.layouts.showTextWall(`✅ Nutrition analyzed!\n${caloriesText}\n${proteinText}\n${carbsText}`);
        
        setTimeout(() => {
          if (session.layouts && typeof session.layouts.showTextWall === 'function') {
            session.layouts.showTextWall('');
          }
        }, 5000);
      }

      // Print analysis to terminal
      console.log('\n🍎 === NUTRITION ANALYSIS WORKFLOW COMPLETE ===');
      console.log(`👤 User: ${userId}`);
      console.log(`📷 Image: ${uploadedFile.url}`);
      console.log(`📊 Key Nutrients:`);
      console.log(`  Calories: ${nutritionData.calories || 'N/A'}`);
      console.log(`  Protein: ${nutritionData.protein || 'N/A'}g`);
      console.log(`  Carbs: ${nutritionData.carbs || 'N/A'}g`);
      console.log(`  Fats: ${nutritionData.fats || 'N/A'}g`);
      console.log(`💾 Saved to database: ${saveSuccess ? '✅' : '❌'}`);
      console.log('===============================================\n');

    } catch (error) {
      session.logger.error(`❌ Nutrition analysis workflow failed: ${error}`);
      throw error;
    }
  }

  /**
   * Get active session for a user (for external access)
   */
  public getSessionForUser(userId: string): AppSession | undefined {
    return this.userSessions.get(userId);
  }

  protected async onStop(sessionId: string, userId: string, reason: string): Promise<void> {
    const session = this.userSessions.get(userId);
    if (session) {
      session.logger.info(`Session ${sessionId} stopped for user ${userId}. Reason: ${reason}`);
    }
    
    // Clean up all session-specific handlers
    const handlers = this.cleanupHandlers.get(sessionId);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler();
        } catch (error) {
          console.error(`Error during cleanup: ${error}`);
        }
      });
      this.cleanupHandlers.delete(sessionId);
    }
    
    // Clean up user-specific state
    this.isStreamingPhotos.delete(userId);
    this.nextPhotoTime.delete(userId);
    this.cameraReady.delete(userId);
    this.cameraInUse.delete(userId);
    this.lastCameraOperation.delete(userId);
    this.userSessions.delete(userId);
    this.isCapturingQuestion.delete(userId);
    this.capturedQuestions.delete(userId);
  }

  /**
   * Set up webview routes for photo display functionality
   */
  private setupWebviewRoutes(): void {
    try {
      // Try to access getExpressApp method with fallback
      if (typeof (this as any).getExpressApp === 'function') {
        const app = (this as any).getExpressApp();
    setupWebviewRoutes(app, this.photoManager, this);
        console.log('✅ Webview routes setup successful');
      } else {
        console.warn('⚠️ getExpressApp method not available, skipping webview routes setup');
      }
    } catch (error) {
      console.warn('⚠️ Webview routes setup failed:', error);
    }
  }

  /**
   * Cleanup worker threads and shutdown gracefully
   */
  public async shutdown(): Promise<void> {
    try {
      if (this.workersInitialized) {
        await shutdownDefaultWorkers();
        this.workersInitialized = false;
      }
      console.log('✅ Application shutdown complete');
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }
  }

  /**
   * Manual start method with fallback if SDK doesn't provide one
   */
  public async startServer(): Promise<void> {
    try {
      // Try to use the SDK's start method first
      if (typeof (this as any).start === 'function') {
        await (this as any).start();
        console.log('✅ Server started using SDK start method');
      } else {
        console.log('⚠️ SDK start method not available, server may need to be started manually');
        // In this case, the MentraOS platform might handle the server startup
      }
    } catch (error) {
      console.error('❌ Error starting server:', error);
      throw error;
    }
  }
}

// Start the server with parallel processing
const app = new NutritionLensApp();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await app.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await app.shutdown();
  process.exit(0);
});

// Start the server with improved error handling
async function startApplication() {
  try {
    await app.startServer();
    console.log('🚀 Nutrition Lens application started successfully with parallel processing');
  } catch (error) {
    console.error('❌ Failed to start application:', error);
    console.log('ℹ️ The application may still work if MentraOS handles server startup automatically');
  }
}

// Initialize the application
startApplication();