import { createRouteHandler } from 'uploadthing/express';
import { uploadRouter } from './uploadthing';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../.env') });

export const uploadthingHandler = createRouteHandler({
  router: uploadRouter,
  config: {
    token: process.env.UPLOADTHING_TOKEN,
  },
}); 