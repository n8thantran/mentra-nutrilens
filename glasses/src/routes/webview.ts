/**
 * Webview routes for photo display and API endpoints
 */

import { Express, Request, Response } from 'express';
import * as ejs from 'ejs';
import * as path from 'path';
import { AuthenticatedRequest } from '@mentra/sdk';
import { uploadthingHandlers } from '../services/uploadthing';
import { PhotoManager } from '../services/photo-manager';

/**
 * Set up webview routes for photo display functionality
 */
export function setupWebviewRoutes(app: Express, photoManager: PhotoManager, glassesApp?: any): void {
  // UploadThing API routes
  app.get('/api/uploadthing', uploadthingHandlers);
  app.post('/api/uploadthing', uploadthingHandlers);

  // API endpoint to trigger TTS on glasses
  app.post('/api/tts', async (req: any, res: any) => {
    const userId = (req as AuthenticatedRequest).authUserId;
    const { text } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (!text) {
      res.status(400).json({ error: 'Text is required' });
      return;
    }

    if (!glassesApp) {
      res.status(500).json({ error: 'Glasses app not available' });
      return;
    }

    try {
      await glassesApp.playTTSForUser(userId, text);
      res.json({ success: true, message: 'TTS played successfully' });
    } catch (error) {
      console.error('Error playing TTS:', error);
      res.status(500).json({ 
        error: 'Failed to play TTS', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // API endpoint to get the latest photo for the authenticated user
  app.get('/api/latest-photo', (req: any, res: any) => {
    const userId = (req as AuthenticatedRequest).authUserId;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const photo = photoManager.getPhoto(userId);
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

    const photo = photoManager.getPhoto(userId);
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