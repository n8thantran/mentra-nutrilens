import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import 'dotenv/config';

/**
 * ElevenLabs TTS Service
 * Provides text-to-speech functionality for the Mentra glasses
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
   * Convert text to speech and return audio buffer
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

  /**
   * Stream text to speech for real-time playback
   * @param text - The text to convert to speech
   * @param voiceId - Optional voice ID (uses default if not provided)
   * @returns ReadableStream<Uint8Array> - The audio stream
   */
  async streamTextToSpeech(text: string, voiceId?: string): Promise<ReadableStream<Uint8Array>> {
    try {
      return await this.client.textToSpeech.stream(
        voiceId || this.defaultVoiceId,
        {
          text,
          modelId: this.defaultModelId,
          outputFormat: 'mp3_44100_128',
        }
      );
    } catch (error) {
      console.error('Error streaming TTS:', error);
      throw new Error(`Failed to stream TTS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get list of available voices
   * @returns Promise<any> - List of available voices
   */
  async getAvailableVoices(): Promise<any> {
    try {
      return await this.client.voices.search();
    } catch (error) {
      console.error('Error fetching voices:', error);
      throw new Error(`Failed to fetch voices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export a singleton instance
export const elevenlabsTTS = new ElevenLabsTTSService();

