import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { config } from 'dotenv';
import { uploadTTSAudioToUploadThing } from './uploadthing.js';

// Load environment variables from src/.env
config({ path: './src/.env' });

/**
 * ElevenLabs TTS Service integrated with UploadThing
 */
export class ElevenLabsTTSService {
  private client: ElevenLabsClient;
  private defaultVoiceId: string = 'JBFqnCBsd6RMkjVDRZzb'; // Default voice ID
  private defaultModelId: string = 'eleven_multilingual_v2';

  constructor() {
    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is required');
    }
    
    this.client = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY
    });
  }

  /**
   * Generate TTS audio from text and upload to UploadThing
   * @param text - The text to convert to speech
   * @param userId - User identifier for the upload
   * @param voiceId - Optional voice ID (uses default if not provided)
   * @returns Promise with the uploaded file URL
   */
  async generateAndUploadTTS(
    text: string, 
    userId: string, 
    voiceId?: string
  ): Promise<{ url: string; key: string; customId: string | null }> {
    try {
      console.log(`Generating TTS for text: "${text}"`);
      
      // Generate TTS audio
      const audioStream = await this.client.textToSpeech.convert(
        voiceId || this.defaultVoiceId,
        {
          text,
          modelId: this.defaultModelId,
          outputFormat: 'mp3_44100_128',
        }
      );

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);
      
      console.log(`Generated ${audioBuffer.length} bytes of audio`);

      // Create filename based on text (truncated and sanitized)
      const sanitizedText = text
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);
      const filename = `tts-${sanitizedText}-${Date.now()}.mp3`;

      // Upload to UploadThing
      const uploadResult = await uploadTTSAudioToUploadThing(
        audioBuffer,
        filename,
        userId
      );

      console.log(`TTS audio uploaded successfully: ${uploadResult.url}`);
      
      return {
        url: uploadResult.url,
        key: uploadResult.key,
        customId: uploadResult.customId
      };
    } catch (error) {
      console.error('Error generating and uploading TTS:', error);
      throw new Error(`Failed to generate and upload TTS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate TTS audio buffer only (no upload)
   * @param text - The text to convert to speech
   * @param voiceId - Optional voice ID (uses default if not provided)
   * @returns Promise<Buffer> - The audio data as a buffer
   */
  async textToSpeech(text: string, voiceId?: string): Promise<Buffer> {
    try {
      const audioStream = await this.client.textToSpeech.convert(
        voiceId || this.defaultVoiceId,
        {
          text,
          modelId: this.defaultModelId,
          outputFormat: 'mp3_44100_128',
        }
      );

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.from(chunk));
      }
      
      return Buffer.concat(chunks);
    } catch (error) {
      console.error('Error generating TTS:', error);
      throw new Error(`Failed to generate TTS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export a singleton instance
export const elevenlabsTTS = new ElevenLabsTTSService();

