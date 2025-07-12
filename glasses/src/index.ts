import { AppServer, AppSession, ViewType, AuthenticatedRequest, PhotoData } from '@mentra/sdk';
import { Request, Response } from 'express';
import * as ejs from 'ejs';
import * as path from 'path';

/**
 * Interface representing a stored photo with metadata
 */
interface StoredPhoto {
  requestId: string;
  buffer: Buffer;
  timestamp: Date;
  userId: string;
  mimeType: string;
  filename: string;
  size: number;
}

const PACKAGE_NAME = process.env.PACKAGE_NAME ?? (() => { throw new Error('PACKAGE_NAME is not set in .env file'); })();
const MENTRAOS_API_KEY = process.env.MENTRAOS_API_KEY ?? (() => { throw new Error('MENTRAOS_API_KEY is not set in .env file'); })();
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL ?? (() => { throw new Error('DISCORD_WEBHOOK_URL is not set in .env file'); })();
const PORT = parseInt(process.env.PORT || '3000');

/**
 * Photo Taker App with webview functionality for displaying photos
 * Extends AppServer to provide photo taking and webview display capabilities
 */
class ExampleMentraOSApp extends AppServer {
  private photos: Map<string, StoredPhoto> = new Map(); // Store photos by userId
  private latestPhotoTimestamp: Map<string, number> = new Map(); // Track latest photo timestamp per user
  private isStreamingPhotos: Map<string, boolean> = new Map(); // Track if we are streaming photos for a user
  private nextPhotoTime: Map<string, number> = new Map(); // Track next photo time for a user
  private cameraReady: Map<string, boolean> = new Map(); // Track if camera is pre-warmed for user

  constructor() {
    super({
      packageName: PACKAGE_NAME,
      apiKey: MENTRAOS_API_KEY,
      port: PORT,
    });
    this.setupWebviewRoutes();
  }


  /**
   * Handle new session creation and button press events
   */
  protected async onSession(session: AppSession, sessionId: string, userId: string): Promise<void> {
    // this gets called whenever a user launches the app
    this.logger.info(`Session started for user ${userId}`);

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

          // cache the photo for display
          this.cachePhoto(photo, userId);
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
        this.cachePhoto(photo, userId);
      })
      .catch(error => {
        this.logger.error(`Error taking photo: ${error}`);
      });
  }

  protected async onStop(sessionId: string, userId: string, reason: string): Promise<void> {
    // clean up the user's state
    this.isStreamingPhotos.set(userId, false);
    this.nextPhotoTime.delete(userId);
    this.cameraReady.delete(userId);
    this.logger.info(`Session stopped for user ${userId}, reason: ${reason}`);
  }

  /**
   * Cache a photo for display and send to Discord webhook
   */
  private async cachePhoto(photo: PhotoData, userId: string) {
    // create a new stored photo object which includes the photo data and the user id
    const cachedPhoto: StoredPhoto = {
      requestId: photo.requestId,
      buffer: photo.buffer,
      timestamp: photo.timestamp,
      userId: userId,
      mimeType: photo.mimeType,
      filename: photo.filename,
      size: photo.size
    };

    // cache the photo for display immediately
    this.photos.set(userId, cachedPhoto);
    // update the latest photo timestamp
    this.latestPhotoTimestamp.set(userId, cachedPhoto.timestamp.getTime());

    // Send the photo to Discord webhook asynchronously (non-blocking)
    this.sendToDiscord(cachedPhoto).catch(error => {
      this.logger.error(`Error sending photo to Discord: ${error}`);
    });
  }

  /**
   * Send photo to Discord webhook
   */
  private async sendToDiscord(photo: StoredPhoto) {
    try {
      // Create FormData for Discord webhook
      const formData = new FormData();
      
      // Create a Blob from the buffer
      const blob = new Blob([photo.buffer], { type: photo.mimeType });
      
      // Add the image file to the form data
      formData.append('file', blob, photo.filename);
      
      // Add a message with photo metadata
      const message = {
        content: `📸 New photo from user ${photo.userId}`,
        embeds: [{
          title: "Photo Details",
          fields: [
            { name: "Timestamp", value: photo.timestamp.toISOString(), inline: true },
            { name: "File Size", value: `${(photo.size / 1024).toFixed(2)} KB`, inline: true },
            { name: "MIME Type", value: photo.mimeType, inline: true }
          ],
          timestamp: photo.timestamp.toISOString(),
          color: 0x00ff00
        }]
      };
      
      formData.append('payload_json', JSON.stringify(message));

      // Send to Discord webhook
      const response = await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        this.logger.info(`Photo sent to Discord successfully for user ${photo.userId}`);
      } else {
        this.logger.error(`Failed to send photo to Discord: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      this.logger.error(`Error sending photo to Discord: ${error}`);
    }
  }


  /**
 * Set up webview routes for photo display functionality
 */
  private setupWebviewRoutes(): void {
    const app = this.getExpressApp();

    // API endpoint to get the latest photo for the authenticated user
    app.get('/api/latest-photo', (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;

      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const photo = this.photos.get(userId);
      if (!photo) {
        res.status(404).json({ error: 'No photo available' });
        return;
      }

      res.json({
        requestId: photo.requestId,
        timestamp: photo.timestamp.getTime(),
        hasPhoto: true
      });
    });

    // API endpoint to get photo data
    app.get('/api/photo/:requestId', (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;
      const requestId = req.params.requestId;

      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const photo = this.photos.get(userId);
      if (!photo || photo.requestId !== requestId) {
        res.status(404).json({ error: 'Photo not found' });
        return;
      }

      res.set({
        'Content-Type': photo.mimeType,
        'Cache-Control': 'no-cache'
      });
      res.send(photo.buffer);
    });

    // Main webview route - displays the photo viewer interface
    app.get('/webview', async (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;

      if (!userId) {
        res.status(401).send(`
          <html>
            <head><title>Photo Viewer - Not Authenticated</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>Please open this page from the MentraOS app</h1>
            </body>
          </html>
        `);
        return;
      }

      const templatePath = path.join(process.cwd(), 'views', 'photo-viewer.ejs');
      const html = await ejs.renderFile(templatePath, {});
      res.send(html);
    });
  }
}



// Start the server
// DEV CONSOLE URL: https://console.mentra.glass/
// Get your webhook URL from ngrok (or whatever public URL you have)
const app = new ExampleMentraOSApp();

app.start().catch(console.error);