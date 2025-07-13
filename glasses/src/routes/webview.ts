/**
 * Webview routes for photo display and API endpoints
 */

import { Express, Request, Response } from 'express';
import * as ejs from 'ejs';
import * as path from 'path';
import { AuthenticatedRequest } from '@mentra/sdk';
import { uploadthingHandlers } from '../services/uploadthing';
import { PhotoManager } from '../services/photo-manager';
import { 
  createNathanUser, 
  initializeExampleUsers, 
  getAllUsers, 
  upsertUser,
  parseDietaryRestrictions 
} from '../services/supabase';
import { convertTextToAudio, analyzeDietaryQuestionWithAudio } from '../services/claude-dietary-analysis';

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

  // API endpoint to test hardcoded TTS and upload to UploadThing
  app.post('/api/tts/test-upload', async (req: any, res: any) => {
    const userId = (req as AuthenticatedRequest).authUserId;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (!glassesApp) {
      res.status(500).json({ error: 'Glasses app not available' });
      return;
    }

    try {
      const hardcodedText = "Hold the image still for 5 seconds";
      await glassesApp.playTTSForUser(userId, hardcodedText);
      res.json({ 
        success: true, 
        message: 'Hardcoded TTS generated and uploaded to UploadThing successfully',
        text: hardcodedText
      });
    } catch (error) {
      console.error('Error generating and uploading hardcoded TTS:', error);
      res.status(500).json({ 
        error: 'Failed to generate and upload TTS', 
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

  // API endpoints for user management and database utilities
  
  // Create Nathan user with default dietary restrictions
  app.post('/api/users/create-nathan', async (req: any, res: any) => {
    try {
      console.log('🆕 API request to create Nathan user...');
      const user = await createNathanUser();
      
      if (user) {
        res.json({ 
          success: true, 
          message: 'Nathan user created/updated successfully',
          user: {
            ...user,
            parsedRestrictions: parseDietaryRestrictions(user.diet_restrictions)
          }
        });
      } else {
        res.status(500).json({ 
          success: false, 
          error: 'Failed to create Nathan user' 
        });
      }
    } catch (error) {
      console.error('❌ Error creating Nathan user:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to create Nathan user', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Initialize example users
  app.post('/api/users/init-examples', async (req: any, res: any) => {
    try {
      console.log('🚀 API request to initialize example users...');
      const users = await initializeExampleUsers();
      
      res.json({ 
        success: true, 
        message: `Initialized ${users.length} example users successfully`,
        users: (users as any[]).map((user: any) => ({
          ...user,
          parsedRestrictions: parseDietaryRestrictions(user.diet_restrictions)
        }))
      });
    } catch (error) {
      console.error('❌ Error initializing example users:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to initialize example users', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Get all users
  app.get('/api/users', async (req: any, res: any) => {
    try {
      console.log('👥 API request to get all users...');
      const users = await getAllUsers();
      
      res.json({ 
        success: true, 
        users: (users as any[]).map((user: any) => ({
          ...user,
          parsedRestrictions: parseDietaryRestrictions(user.diet_restrictions)
        }))
      });
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch users', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Create or update a user
  app.post('/api/users', async (req: any, res: any) => {
    try {
      const { username, diet_preference, restrictions } = req.body;
      
      if (!username) {
        res.status(400).json({ 
          success: false, 
          error: 'Username is required' 
        });
        return;
      }

      console.log(`🔄 API request to upsert user: ${username}`);
      const user = await upsertUser(username, { diet_preference, restrictions });
      
      if (user) {
        res.json({ 
          success: true, 
          message: `User ${username} created/updated successfully`,
          user: {
            id: user.id,
            username: user.username,
            diet_preference: user.diet_preference,
            diet_restrictions: user.diet_restrictions,
            created_at: user.created_at,
            updated_at: user.updated_at,
            parsedRestrictions: parseDietaryRestrictions(user.diet_restrictions)
          }
        });
      } else {
        res.status(500).json({ 
          success: false, 
          error: `Failed to create/update user ${username}` 
        });
      }
    } catch (error) {
      console.error('❌ Error creating/updating user:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to create/update user', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
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

  // ✨ NEW AUDIO FEATURES ✨

  // Test endpoint: Convert text to audio
  app.post('/api/audio/text-to-speech', async (req: Request, res: Response) => {
    try {
      const { text, userId, voiceId } = req.body;

      if (!text) {
        res.status(400).json({ error: 'Text is required' });
        return;
      }

      if (!userId) {
        res.status(400).json({ error: 'UserId is required' });
        return;
      }

      console.log(`🎤 Converting text to audio for user ${userId}`);
      
      const audioResult = await convertTextToAudio(text, userId, voiceId);
      
      res.json({
        success: true,
        message: 'Text converted to audio successfully',
        data: audioResult
      });

    } catch (error) {
      console.error('❌ Error in text-to-speech endpoint:', error);
      res.status(500).json({ 
        error: 'Failed to convert text to audio',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Test endpoint: Full dietary analysis with audio
  app.post('/api/audio/dietary-analysis', async (req: Request, res: Response) => {
    try {
      const { question, imageUrl, username, voiceId } = req.body;

      if (!question) {
        res.status(400).json({ error: 'Question is required' });
        return;
      }

      if (!imageUrl) {
        res.status(400).json({ error: 'Image URL is required' });
        return;
      }

      console.log(`🔍 Analyzing dietary question with audio for ${username || 'Nathan'}`);
      
      const result = await analyzeDietaryQuestionWithAudio(
        question, 
        imageUrl, 
        username || 'Nathan', 
        voiceId
      );
      
      res.json({
        success: true,
        message: 'Dietary analysis with audio completed successfully',
        data: result
      });

    } catch (error) {
      console.error('❌ Error in dietary analysis with audio endpoint:', error);
      res.status(500).json({ 
        error: 'Failed to analyze dietary question with audio',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
} 