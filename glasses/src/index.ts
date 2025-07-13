/**
 * Main entry point for the Nutrition Lens smart glasses application
 * 
 * This application captures photos, uploads them to UploadThing, analyzes nutrition
 * facts using Claude Vision API, and sends results to Discord webhooks.
 */

import { AppServer, AppSession } from '@mentra/sdk';
import { CONFIG } from './config/environment';
import { PhotoManager } from './services/photo-manager';
import { setupWebviewRoutes } from './routes/webview';
import { elevenlabsTTS } from './services/elevenlabs.mts';
import { analyzeDietaryQuestion } from './services/claude-dietary-analysis';
import { getUserProfile } from './services/supabase';
import { uploadPhotoToUploadThing } from './services/uploadthing';
import { UserDietaryProfile } from './types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Photo Taker App with webview functionality for displaying photos
 * Extends AppServer to provide photo taking and webview display capabilities
 */
class NutritionLensApp extends AppServer {
  private photoManager: PhotoManager = new PhotoManager();
  private isStreamingPhotos: Map<string, boolean> = new Map(); // Track if we are streaming photos for a user
  private nextPhotoTime: Map<string, number> = new Map(); // Track next photo time for a user
  private cameraReady: Map<string, boolean> = new Map(); // Track if camera is pre-warmed for user
  private cameraInUse: Map<string, boolean> = new Map(); // Track if camera is currently being used
  private userSessions: Map<string, AppSession> = new Map(); // Track active sessions for TTS
  private isCapturingQuestion: Map<string, boolean> = new Map(); // Track if we're capturing a question
  private capturedQuestions: Map<string, string> = new Map(); // Store captured questions by user

  constructor() {
    super({
      packageName: CONFIG.PACKAGE_NAME,
      apiKey: CONFIG.MENTRAOS_API_KEY,
      port: CONFIG.PORT,
    });
    this.setupMiddleware();
    this.setupWebviewRoutes();
    this.setupPhotoManagerCallbacks();
  }

  /**
   * Set up Express middleware
   */
  private setupMiddleware(): void {
    const app = this.getExpressApp();
    // Add JSON body parser for TTS requests
    app.use(require('express').json());
  }

  /**
   * Set up PhotoManager callbacks for audio playback
   */
  private setupPhotoManagerCallbacks(): void {
    // Set up audio playback callback for PhotoManager
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
      this.logger.error(`No active session found for user ${userId} for audio playback`);
      throw new Error('No active session found for audio playback');
    }

    try {
      this.logger.info(`Playing audio on glasses for user ${userId}: ${audioUrl}`);
      
      // Use the layout system to display an audio-playing notification
      // This approach shows a text notification while we attempt to play audio
      if (session.layouts && typeof session.layouts.showTextWall === 'function') {
        session.layouts.showTextWall("🎵 Audio Playing...");
        
        // Wait a moment for the text to display
        setTimeout(() => {
          if (session.layouts && typeof session.layouts.showTextWall === 'function') {
            session.layouts.showTextWall(""); // Clear the message
          }
        }, 3000);
      }

      // Create an audio playback iframe/webview approach
      // Since MentraOS might support embedded web content, we'll create a simple HTML audio player
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
            // Auto-close after playing
            setTimeout(() => {
              window.close();
            }, 5000);
          </script>
        </body>
        </html>
      `;

      // Create a temporary HTML file for audio playback
      const tempDir = '/tmp';
      const tempFileName = `audio_player_${userId}_${Date.now()}.html`;
      const tempFilePath = path.join(tempDir, tempFileName);
      
      fs.writeFileSync(tempFilePath, audioHtml);
      
      // Log the created audio player file
      this.logger.info(`Created audio player file: ${tempFilePath}`);
      this.logger.info(`Audio URL: ${audioUrl}`);
      
      // Clean up the temporary file after a delay
      setTimeout(() => {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (error) {
          this.logger.warn(`Failed to cleanup temporary audio file: ${error}`);
        }
      }, 10000);

      this.logger.info(`Audio playback initiated successfully for user ${userId}`);
      
    } catch (error) {
      this.logger.error(`Error playing audio on glasses for user ${userId}: ${error}`);
      throw error;
    }
  }

  /**
   * Handle new session creation and button press events
   */
  protected async onSession(session: AppSession, sessionId: string, userId: string): Promise<void> {
    // this gets called whenever a user launches the app
    this.logger.info(`Session started for user ${userId}`);

    // Store the session for TTS functionality
    this.userSessions.set(userId, session);

    // set the initial state of the user
    this.isStreamingPhotos.set(userId, false);
    this.nextPhotoTime.set(userId, Date.now());
    this.cameraReady.set(userId, false);
    this.isCapturingQuestion.set(userId, false);
    this.capturedQuestions.set(userId, '');

    // Pre-warm the camera for instant capture
    await this.prewarmCamera(session, userId);

    // Handle transcription events for question capture
    const unsubscribeTranscription = session.events.onTranscription((data) => {
      if (this.isCapturingQuestion.get(userId) && data.isFinal) {
        const currentQuestion = this.capturedQuestions.get(userId) || '';
        const newQuestion = currentQuestion + ' ' + data.text.trim();
        this.capturedQuestions.set(userId, newQuestion.trim());
        this.logger.info(`📝 Captured question from ${userId}: "${data.text}"`);
        
        // Show the captured text on glasses
        if (session.layouts && typeof session.layouts.showTextWall === 'function') {
          session.layouts.showTextWall(`🎤 Question: ${newQuestion.trim()}`);
        }
      }
    });

    // this gets called whenever a user presses a button
    session.events.onButtonPress((button) => {
      this.logger.info(`Button pressed: ${button.buttonId} (${button.pressType})`);
      
      if (button.pressType === 'long') {
        // Check if this is the right button (for dietary questions) 
        // Note: buttonId implementation may vary, so we'll handle any long press for now
        if (this.isCapturingQuestion.get(userId)) {
          // Stop capturing and process the question
          this.stopQuestionCaptureAndAnalyze(session, userId);
        } else {
          // Start capturing question
          this.startQuestionCapture(session, userId);
        }
      } else {
        // Short press - take a single photo immediately
        // Use non-async call to minimize delay
        session.audio.playAudio({audioUrl: 'https://p70oi85l49.ufs.sh/f/nh2RhlWG3N8JdhLgZNdJUzAnxuO94lXyfcDtQHhpJgCwiVWK'})
        this.playTTSForUser(userId, 'The first move is what sets everything in motion.');
        this.takePhotoImmediate(session, userId);
      }
    });

    // Clean up transcription listener when session ends
    this.addCleanupHandler(unsubscribeTranscription);

    // repeatedly check if we are in streaming mode and if we are ready to take another photo
    setInterval(async () => {
      if (this.isStreamingPhotos.get(userId) && Date.now() > (this.nextPhotoTime.get(userId) ?? 0)) {
        try {
          // set the next photos for 30 seconds from now, as a fallback if this fails
          this.nextPhotoTime.set(userId, Date.now() + 30000);

          // Check camera capabilities before attempting
          if (!session.capabilities?.hasCamera) {
            this.logger.error('❌ No camera available for streaming photo');
            return;
          }

          // Take photo with timeout
          const photoPromise = session.camera.requestPhoto();
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Streaming photo request timed out after 8 seconds')), 8000);
          });

          // Race between photo capture and timeout
          const photo = await Promise.race([photoPromise, timeoutPromise]);

          // set the next photo time to now, since we are ready to take another photo
          this.nextPhotoTime.set(userId, Date.now());

          // cache the photo for display and process it
          await this.photoManager.cacheAndProcessPhoto(photo, userId, this.logger);
        } catch (error) {
          this.logger.error(`Error auto-taking photo: ${error}`);
        }
      }
    }, 1000);
  }

  /**
   * Pre-warm the camera for instant capture
   */
  private async prewarmCamera(session: AppSession, userId: string): Promise<void> {
    try {
      // Check camera capabilities first
      const caps = session.capabilities;
      if (!caps?.hasCamera) {
        this.logger.warn(`No camera available for user ${userId}`);
        return;
      }

      // Log camera capabilities for debugging
      if (caps.camera) {
        this.logger.info(`Camera capabilities for user ${userId}: focus=${caps.camera.hasFocus}, HDR=${caps.camera.hasHDR}`);
      }

      // Pre-warm the camera by taking a dummy photo (don't save it)
      this.logger.info(`Pre-warming camera for user ${userId}`);
      await session.camera.requestPhoto();
      this.cameraReady.set(userId, true);
      this.logger.info(`Camera pre-warmed for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error pre-warming camera for user ${userId}: ${error}`);
      // Camera not ready, but we'll still try to take photos
      this.cameraReady.set(userId, false);
    }
  }

  /**
   * Take photo immediately without async/await to minimize delay
   */
  private takePhotoImmediate(session: AppSession, userId: string): void {
    // Use async version with timeout handling but don't await to maintain non-blocking behavior
    this.takePhotoImmediateAsync(session, userId).catch(error => {
      this.logger.error(`Error in immediate photo capture: ${error}`);
    });
  }

  /**
   * Async version of immediate photo capture with timeout handling
   */
  private async takePhotoImmediateAsync(session: AppSession, userId: string): Promise<void> {
    try {
      // Check camera capabilities
      if (!session.capabilities?.hasCamera) {
        this.logger.error('❌ No camera available for immediate photo');
        return;
      }

      // Check if camera is already in use
      if (this.cameraInUse.get(userId)) {
        this.logger.warn('⚠️ Camera already in use for immediate photo, skipping');
        return;
      }

      this.logger.info(`📸 Taking immediate photo for user ${userId}`);
      this.cameraInUse.set(userId, true);

      // Use the same timeout logic as the dietary analysis
      const photoPromise = session.camera.requestPhoto();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Immediate photo request timed out after 8 seconds')), 8000);
      });

      // Race between photo capture and timeout (shorter timeout for immediate photos)
      const photo = await Promise.race([photoPromise, timeoutPromise]);
      
      this.logger.info(`✅ Immediate photo captured successfully`);
      await this.photoManager.cacheAndProcessPhoto(photo, userId, this.logger);

    } catch (error) {
      this.logger.error(`❌ Immediate photo capture failed: ${error}`);
      
      // Show user feedback if photo fails
      if (session.layouts && typeof session.layouts.showTextWall === 'function') {
        session.layouts.showTextWall('📸 Photo failed. Try again.');
      }
    } finally {
      // Always release camera lock
      this.cameraInUse.set(userId, false);
    }
  }

  /**
   * Play TTS audio on the glasses for a specific user
   */
  public async playTTSForUser(userId: string, text: string): Promise<void> {
    const session = this.userSessions.get(userId);
    if (!session) {
      this.logger.error(`No active session found for user ${userId}`);
      throw new Error('No active session found');
    }

    try {
      this.logger.info(`Generating and uploading TTS for user ${userId}: "${text}"`);
      
      // Generate TTS audio and upload to UploadThing
      const uploadResult = await elevenlabsTTS.generateAndUploadTTS(text, userId);
      
      this.logger.info(`TTS audio uploaded to: ${uploadResult.url}`);
      
      // Use layout system to show TTS notification with upload success
      if (session.layouts && typeof session.layouts.showTextWall === 'function') {
        session.layouts.showTextWall(`🔊 ${text}\n📤 Uploaded to bucket`);
        
        // Clear the message after a delay
        setTimeout(() => {
          if (session.layouts && typeof session.layouts.showTextWall === 'function') {
            session.layouts.showTextWall("");
          }
        }, 5000);
      }
      
      this.logger.info(`TTS generated and uploaded successfully for user ${userId}. File key: ${uploadResult.key}`);
      
    } catch (error) {
      this.logger.error(`Error generating and uploading TTS for user ${userId}: ${error}`);
      throw error;
    }
  }

  /**
   * Start capturing question via transcription
   */
  private startQuestionCapture(session: AppSession, userId: string): void {
    this.logger.info(`🎤 Starting question capture for user ${userId}`);
    this.isCapturingQuestion.set(userId, true);
    this.capturedQuestions.set(userId, '');
    
    // Show UI feedback
    if (session.layouts && typeof session.layouts.showTextWall === 'function') {
      session.layouts.showTextWall('🎤 Listening for your question...\nHold button again to stop and analyze');
    }
  }

  /**
   * Stop question capture and analyze with photo
   */
  private async stopQuestionCaptureAndAnalyze(session: AppSession, userId: string): Promise<void> {
    this.logger.info(`🛑 Stopping question capture for user ${userId}`);
    this.isCapturingQuestion.set(userId, false);
    
    const question = this.capturedQuestions.get(userId) || '';
    
    if (!question.trim()) {
      this.logger.warn(`No question captured for user ${userId}`);
      if (session.layouts && typeof session.layouts.showTextWall === 'function') {
        session.layouts.showTextWall('❌ No question captured. Try again.');
      }
      return;
    }

    try {
      // Show processing message
      if (session.layouts && typeof session.layouts.showTextWall === 'function') {
        session.layouts.showTextWall('📸 Taking photo and analyzing...');
      }

      this.logger.info(`📝 Question captured: "${question}"`);
      this.logger.info(`📸 Taking photo for dietary analysis...`);

      // Take a photo with timeout handling and retry logic
      const photo = await this.capturePhotoWithRetry(session, userId);
      
      if (!photo) {
        this.logger.error('❌ Failed to capture photo after retries');
        if (session.layouts && typeof session.layouts.showTextWall === 'function') {
          session.layouts.showTextWall('❌ Photo capture failed. Try again.');
        }
        return;
      }
      
      // Upload photo to get URL for Claude
      const uploadedFile = await uploadPhotoToUploadThing(
        photo.buffer,
        photo.filename,
        photo.mimeType,
        userId,
        photo.requestId
      );

      this.logger.info(`📤 Photo uploaded: ${uploadedFile.url}`);

      // Analyze with Claude (using simplified approach - Claude handles user lookup)
      const analysis = await analyzeDietaryQuestion(question, uploadedFile.url, 'Nathan');
      
      // Print analysis to terminal as requested
      console.log('\n🤖 === CLAUDE DIETARY ANALYSIS ===');
      console.log(`👤 User: Nathan`);
      console.log(`❓ Question: "${question}"`);
      console.log(`📷 Image: ${uploadedFile.url}`);
      console.log(`💬 Analysis:`);
      console.log(analysis);
      console.log('=================================\n');

      // Show success message on glasses
      if (session.layouts && typeof session.layouts.showTextWall === 'function') {
        session.layouts.showTextWall('✅ Analysis complete!\nCheck terminal for results.');
      }

    } catch (error) {
      this.logger.error(`❌ Error during dietary analysis: ${error}`);
      if (session.layouts && typeof session.layouts.showTextWall === 'function') {
        session.layouts.showTextWall('❌ Analysis failed. Try again.');
      }
    } finally {
      // Clean up captured question
      this.capturedQuestions.delete(userId);
    }
  }

  /**
   * Capture photo with timeout handling and retry logic
   */
  private async capturePhotoWithRetry(session: AppSession, userId: string, maxRetries: number = 3): Promise<any | null> {
    // Check if camera is already in use
    if (this.cameraInUse.get(userId)) {
      this.logger.warn('⚠️ Camera already in use for dietary analysis, waiting...');
      // Wait a bit for camera to be free
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (this.cameraInUse.get(userId)) {
        this.logger.error('❌ Camera still busy after waiting');
        return null;
      }
    }

    this.cameraInUse.set(userId, true);

    try {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          this.logger.info(`📸 Photo capture attempt ${attempt}/${maxRetries}`);
          
          // Check camera capabilities before attempting
          if (!session.capabilities?.hasCamera) {
            this.logger.error('❌ No camera available on this device');
            return null;
          }

          // Add user feedback for retry attempts
          if (attempt > 1 && session.layouts && typeof session.layouts.showTextWall === 'function') {
            session.layouts.showTextWall(`📸 Retrying photo... (${attempt}/${maxRetries})`);
          }

          // Create a promise that will timeout after 10 seconds
          const photoPromise = session.camera.requestPhoto();
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Photo request timed out after 10 seconds')), 10000);
          });

          // Race between photo capture and timeout
          const photo = await Promise.race([photoPromise, timeoutPromise]);
          
          this.logger.info(`✅ Photo captured successfully on attempt ${attempt}`);
          return photo;

        } catch (error) {
          this.logger.warn(`⚠️ Photo capture attempt ${attempt} failed: ${error}`);
          
          if (attempt === maxRetries) {
            this.logger.error(`❌ All photo capture attempts failed: ${error}`);
            return null;
          }

          // Wait a bit before retrying (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 1s, 2s, 4s max
          this.logger.info(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      return null;
    } finally {
      // Always release camera lock
      this.cameraInUse.set(userId, false);
    }
  }

  /**
   * Get active session for a user (for external access)
   */
  public getSessionForUser(userId: string): AppSession | undefined {
    return this.userSessions.get(userId);
  }

  protected async onStop(sessionId: string, userId: string, reason: string): Promise<void> {
    this.logger.info(`Session ${sessionId} stopped for user ${userId}. Reason: ${reason}`);
    
    // Clean up user-specific state
    this.isStreamingPhotos.delete(userId);
    this.nextPhotoTime.delete(userId);
    this.cameraReady.delete(userId);
    this.cameraInUse.delete(userId);
    this.userSessions.delete(userId);
    this.isCapturingQuestion.delete(userId);
    this.capturedQuestions.delete(userId);
  }

  /**
   * Set up webview routes for photo display functionality
   */
  private setupWebviewRoutes(): void {
    const app = this.getExpressApp();
    setupWebviewRoutes(app, this.photoManager, this);
  }
}

// Start the server
// DEV CONSOLE URL: https://console.mentra.glass/
// Get your webhook URL from ngrok (or whatever public URL you have)
const app = new NutritionLensApp();

app.start().catch(console.error);