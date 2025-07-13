import { UTApi, UTFile } from "uploadthing/server";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../../.env") });

const utapi = new UTApi({ token: process.env.UPLOADTHING_TOKEN });

/**
 * Upload a photo buffer to UploadThing.
 * @param buffer - The photo buffer (e.g., from session.camera.requestPhoto().buffer)
 * @param filename - The filename to use for the upload
 * @param mimeType - The MIME type of the file (e.g., "image/jpeg")
 * @param customId - (Optional) A custom identifier for the file
 * @returns The UploadThing file response
 */
export async function uploadPhotoBufferToUploadThing(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  customId?: string
) {
  const file = new UTFile([buffer], filename, { type: mimeType, customId });
  const response = await utapi.uploadFiles([file]);
  return response;
} 