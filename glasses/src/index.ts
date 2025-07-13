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
  private userSessions: Map<string, AppSession> = new Map(); // Track active sessions for TTS

  constructor() {
    super({
      packageName: CONFIG.PACKAGE_NAME,
      apiKey: CONFIG.MENTRAOS_API_KEY,
      port: CONFIG.PORT,
    });
    this.setupMiddleware();
    this.setupWebviewRoutes();
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

    // Pre-warm the camera for instant capture
    await this.prewarmCamera(session, userId);

    // this gets called whenever a user presses a button
    session.events.onButtonPress((button) => {
      if (button.pressType === 'long') {
        // the user held the button, so we toggle the streaming mode
        this.isStreamingPhotos.set(userId, !this.isStreamingPhotos.get(userId));
        this.logger.info(`Streaming photos for user ${userId} is now ${this.isStreamingPhotos.get(userId)}`);
        return;
      } else {
        // the user pressed the button, so we take a single photo immediately
        // Use non-async call to minimize delay
        this.takePhotoImmediate(session, userId);
      }
    });

    // repeatedly check if we are in streaming mode and if we are ready to take another photo
    setInterval(async () => {
      if (this.isStreamingPhotos.get(userId) && Date.now() > (this.nextPhotoTime.get(userId) ?? 0)) {
        try {
          // set the next photos for 30 seconds from now, as a fallback if this fails
          this.nextPhotoTime.set(userId, Date.now() + 30000);

          // actually take the photo
          const photo = await session.camera.requestPhoto();

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
    session.camera.requestPhoto()
      .then(photo => {
        this.photoManager.cacheAndProcessPhoto(photo, userId, this.logger);
      })
      .catch(error => {
        this.logger.error(`Error taking photo: ${error}`);
      });
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
      this.logger.info(`Generating TTS for user ${userId}: "${text}"`);
      
      // Generate TTS audio buffer
      const audioBuffer = await elevenlabsTTS.textToSpeech(text);
      
      // Create temporary audio file
      const tempDir = '/tmp';
      const tempFileName = `tts_${userId}_${Date.now()}.mp3`;
      const tempFilePath = path.join(tempDir, tempFileName);
      
      // Write audio buffer to temporary file
      fs.writeFileSync(tempFilePath, audioBuffer);
      
      // Play audio on the glasses using the file URL
      if (session.audio && typeof session.audio.playAudio === 'function') {
        await session.audio.playAudio({
          audioUrl: tempFilePath
        });
        this.logger.info(`TTS audio played successfully for user ${userId}`);
        
        // Clean up temporary file after a delay
        setTimeout(() => {
          try {
            fs.unlinkSync(tempFilePath);
          } catch (error) {
            this.logger.warn(`Failed to cleanup temporary audio file: ${error}`);
          }
        }, 10000); // Clean up after 10 seconds
        
      } else {
        this.logger.warn(`Audio playback not supported for user ${userId}`);
        // Clean up temporary file
        try {
          fs.unlinkSync(tempFilePath);
        } catch (error) {
          this.logger.warn(`Failed to cleanup temporary audio file: ${error}`);
        }
        throw new Error('Audio playback not supported on this device');
      }
      
    } catch (error) {
      this.logger.error(`Error playing TTS for user ${userId}: ${error}`);
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
    // clean up the user's state
    this.isStreamingPhotos.set(userId, false);
    this.nextPhotoTime.delete(userId);
    this.cameraReady.delete(userId);
    this.userSessions.delete(userId); // Clean up session reference
    this.logger.info(`Session stopped for user ${userId}, reason: ${reason}`);
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