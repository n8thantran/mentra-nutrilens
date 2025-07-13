import { createUploadthing, type FileRouter } from 'uploadthing/express';
import { UploadThingError } from 'uploadthing/server';
import type { Request } from 'express';

const f = createUploadthing();

// Example auth function (replace with real auth if needed)
const auth = (req: Request) => {
  // You can extract user info from req if needed
  return { id: 'fakeId' };
};

export const uploadRouter = {
  imageUploader: f({
    image: {
      maxFileSize: '4MB',
      maxFileCount: 1,
    },
  })
    .middleware(async ({ req }) => {
      const user = await auth(req);
      if (!user) throw new UploadThingError('Unauthorized');
      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log('Upload complete for userId:', metadata.userId);
      console.log('file url', file.ufsUrl);
      return { uploadedBy: metadata.userId };
    }),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter; 