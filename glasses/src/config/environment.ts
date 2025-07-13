/**
 * Environment configuration and validation for the nutrition lens application
 */

export const CONFIG = {
  PACKAGE_NAME: process.env.PACKAGE_NAME ?? (() => { 
    throw new Error('PACKAGE_NAME is not set in .env file'); 
  })(),
  
  MENTRAOS_API_KEY: process.env.MENTRAOS_API_KEY ?? (() => { 
    throw new Error('MENTRAOS_API_KEY is not set in .env file'); 
  })(),
  
  DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL ?? (() => { 
    throw new Error('DISCORD_WEBHOOK_URL is not set in .env file'); 
  })(),
  
  CLAUDE_KEY: process.env.CLAUDE_KEY ?? (() => { 
    throw new Error('CLAUDE_KEY is not set in .env file'); 
  })(),
  
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? (() => { 
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set in .env file'); 
  })(),
  
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? (() => { 
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set in .env file'); 
  })(),
  
  PORT: parseInt(process.env.PORT || '3000'),
  
  // UploadThing automatically uses UPLOADTHING_TOKEN from environment
  // No explicit validation needed as UTApi handles this internally
} as const; 