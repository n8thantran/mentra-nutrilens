/**
 * Photo management service for handling photo storage and processing
 */

import { PhotoData } from '@mentra/sdk';
import { StoredPhoto } from '../types';
import { uploadPhotoToUploadThing } from './uploadthing';
import { analyzeNutritionFacts } from './nutrition-analysis';
import { sendToDiscord } from './discord';
import { insertNutritionData } from './supabase';

export class PhotoManager {
  private photos: Map<string, StoredPhoto> = new Map(); // Store photos by userId
  private latestPhotoTimestamp: Map<string, number> = new Map(); // Track latest photo timestamp per user

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
   * Get cached photo for a user
   */
  getPhoto(userId: string): StoredPhoto | undefined {
    return this.photos.get(userId);
  }

  /**
   * Get latest photo timestamp for a user
   */
  getLatestPhotoTimestamp(userId: string): number | undefined {
    return this.latestPhotoTimestamp.get(userId);
  }

  /**
   * Check if photo exists for a user
   */
  hasPhoto(userId: string): boolean {
    return this.photos.has(userId);
  }
} 