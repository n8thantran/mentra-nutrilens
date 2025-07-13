/**
 * Photo management service for handling photo storage and processing
 */

import { PhotoData } from '@mentra/sdk';
import { StoredPhoto } from '../types';
import { uploadPhotoToUploadThing } from './uploadthing';
import { analyzeNutritionFacts } from './nutrition-analysis';
import { sendToDiscord } from './discord';
import { insertNutritionData } from './supabase';

// Audio playback callback type
type AudioPlaybackCallback = (userId: string, audioUrl: string) => Promise<void>;

export class PhotoManager {
  private photos: Map<string, StoredPhoto> = new Map(); // Store photos by userId
  private latestPhotoTimestamp: Map<string, number> = new Map(); // Track latest photo timestamp per user
  private audioPlaybackCallback?: AudioPlaybackCallback; // Callback for audio playback

  /**
   * Set the audio playback callback
   */
  setAudioPlaybackCallback(callback: AudioPlaybackCallback): void {
    this.audioPlaybackCallback = callback;
  }

  /**
   * Cache a photo for display and process it (upload, analyze, send to Discord)
   */
  async cacheAndProcessPhoto(photo: PhotoData, userId: string, logger: any): Promise<void> {
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

    // Process the photo asynchronously (non-blocking)
    this.processPhoto(cachedPhoto, logger).catch(error => {
      logger.error(`Error processing photo: ${error}`);
    });
  }

  /**
   * Process photo: upload to UploadThing, analyze nutrition, send to Discord
   */
  private async processPhoto(photo: StoredPhoto, logger: any): Promise<void> {
    try {
      logger.info(`Uploading photo to UploadThing for user ${photo.userId}`);
      
      // 🎵 Play audio after photo request is sent/logged
      if (this.audioPlaybackCallback) {
        try {
          const audioUrl = 'https://p70oi85l49.ufs.sh/f/nh2RhlWG3N8JdhLgZNdJUzAnxuO94lXyfcDtQHhpJgCwiVWK';
          await this.audioPlaybackCallback(photo.userId, audioUrl);
          logger.info(`Audio played for user ${photo.userId} after photo request`);
        } catch (audioError) {
          logger.error(`Failed to play audio for user ${photo.userId}: ${audioError}`);
        }
      }
      
      // Upload to UploadThing (nutrilens bucket)
      const uploadedFile = await uploadPhotoToUploadThing(
        photo.buffer,
        photo.filename,
        photo.mimeType,
        photo.userId,
        photo.requestId
      );

      logger.info(`Photo uploaded to UploadThing successfully:`);
      logger.info(`  CDN URL: ${uploadedFile.url}`);
      logger.info(`  File Key: ${uploadedFile.key}`);
      logger.info(`  File Size: ${uploadedFile.size} bytes`);

      // Analyze nutrition facts using Claude Vision API
      const nutritionAnalysis = await analyzeNutritionFacts(uploadedFile.url);

      // Save nutrition data to Supabase with image URL
      if (nutritionAnalysis) {
        // Add the CDN URL to the nutrition data
        const nutritionDataWithImage = {
          ...nutritionAnalysis,
          imgURL: uploadedFile.url
        };
        await insertNutritionData(nutritionDataWithImage);
      }

      // Send to Discord with nutrition analysis
      await sendToDiscord(photo, uploadedFile.url, uploadedFile.key, uploadedFile.size, nutritionAnalysis);

      logger.info(`Photo sent to Discord successfully for user ${photo.userId} via UploadThing`);
    } catch (error) {
      logger.error(`Error uploading photo or sending to Discord: ${error}`);
    }
  }

  /**
   * Get a cached photo for the given user
   */
  getPhoto(userId: string): StoredPhoto | undefined {
    return this.photos.get(userId);
  }

  /**
   * Get the timestamp of the latest photo for a user
   */
  getLatestPhotoTimestamp(userId: string): number | undefined {
    return this.latestPhotoTimestamp.get(userId);
  }

  /**
   * Check if user has a cached photo
   */
  hasPhoto(userId: string): boolean {
    return this.photos.has(userId);
  }
} 