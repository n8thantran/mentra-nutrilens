/**
 * UploadThing service for file uploads to the nutrilens bucket
 */

import { createUploadthing, type FileRouter, UTApi, UTFile, createRouteHandler } from 'uploadthing/server';

// UploadThing configuration
const f = createUploadthing();

export const fileRouter = {
  imageUploader: f({
    image: {
      maxFileSize: "16MB",
      maxFileCount: 1,
    },
  })
    .middleware(async () => {
      // Return metadata for the upload
      return { bucket: "nutrilens" };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload complete for bucket:", metadata.bucket);
      console.log("File URL:", file.url);
      return { uploadedTo: metadata.bucket };
    }),
  
  audioUploader: f({
    audio: {
      maxFileSize: "10MB",
      maxFileCount: 1,
    },
  })
    .middleware(async () => {
      // Return metadata for the upload
      return { bucket: "nutrilens-audio" };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Audio upload complete for bucket:", metadata.bucket);
      console.log("Audio File URL:", file.url);
      return { uploadedTo: metadata.bucket };
    }),
} satisfies FileRouter;

export type FileRouterType = typeof fileRouter;

// UTApi instance for server-side uploads  
export const utapi = new UTApi();

// Route handlers for UploadThing API
export const uploadthingHandlers = createRouteHandler({ router: fileRouter });

/**
 * Upload a photo buffer to UploadThing
 */
export async function uploadPhotoToUploadThing(
  photoBuffer: Buffer, 
  filename: string, 
  mimeType: string, 
  userId: string, 
  requestId: string
) {
  // Create UTFile from the photo buffer
  const utFile = new UTFile(
    [photoBuffer], 
    filename, 
    { 
      customId: `${userId}-${requestId}`,
      type: mimeType
    }
  );

  // Upload to UploadThing (nutrilens bucket)
  const uploadResponse = await utapi.uploadFiles([utFile]);
  
  if (!uploadResponse || uploadResponse.length === 0 || uploadResponse[0].error) {
    throw new Error(`UploadThing upload failed: ${uploadResponse[0]?.error?.message || 'Unknown error'}`);
  }

  return uploadResponse[0].data;
}

/**
 * Upload TTS audio buffer to UploadThing
 */
export async function uploadTTSAudioToUploadThing(
  audioBuffer: Buffer, 
  filename: string, 
  userId: string, 
  requestId?: string
) {
  // Create UTFile from the audio buffer
  const customId = requestId ? `${userId}-${requestId}` : `tts-${userId}-${Date.now()}`;
  const utFile = new UTFile(
    [audioBuffer], 
    filename, 
    { 
      customId,
      type: 'audio/mpeg'
    }
  );

  // Upload to UploadThing (nutrilens-audio bucket)
  const uploadResponse = await utapi.uploadFiles([utFile]);
  
  if (!uploadResponse || uploadResponse.length === 0 || uploadResponse[0].error) {
    throw new Error(`UploadThing audio upload failed: ${uploadResponse[0]?.error?.message || 'Unknown error'}`);
  }

  return uploadResponse[0].data;
} 