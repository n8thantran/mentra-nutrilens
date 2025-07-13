/**
 * Claude dietary analysis service for answering questions based on images and user dietary profile
 * Uses entire users table data instead of parsing dietary restrictions locally
 */

import Anthropic from '@anthropic-ai/sdk';
import { CONFIG } from '../config/environment';
import { createClient } from '@supabase/supabase-js';
import { elevenlabsTTS } from './elevenlabs.mts';

// Initialize Supabase client (reusing the same pattern as supabase.ts)
const supabase = createClient(
  CONFIG.NEXT_PUBLIC_SUPABASE_URL,
  CONFIG.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Claude client for dietary analysis
const claude = new Anthropic({
  apiKey: CONFIG.CLAUDE_KEY,
});

/**
 * Analyze dietary questions based on image and username using entire users table
 */
export async function analyzeDietaryQuestion(
  question: string,
  imageUrl: string,
  username: string = 'Nathan'
): Promise<string> {
  try {
    console.log(`🤖 Analyzing dietary question for user ${username}: "${question}"`);
    console.log(`📷 Image: ${imageUrl}`);
    
    // Get ALL user data as raw JSON - let Claude handle the parsing
    const { data: allUsers, error } = await supabase
      .from('users')
      .select('*');

    if (error) {
      console.error('❌ Error fetching users table:', error);
      throw new Error(`Failed to fetch user data: ${error.message}`);
    }

    console.log(`📊 Raw users table data:`, allUsers);

    // Find the specific user in the data
    const targetUser = allUsers?.find(user => user.username === username);
    
    if (!targetUser) {
      console.error(`❌ Could not find user ${username} in users table`);
      throw new Error(`User ${username} not found in database`);
    }

    console.log(`👤 Target user found:`, targetUser);

    const response = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are a helpful dietary assistant. A user has asked a question about food in an image. Please analyze the image and answer their question while taking their dietary profile into account.

Here is the complete user data from our database:
${JSON.stringify(allUsers, null, 2)}

The current user asking the question is: ${username}

User's question: "${question}"

Please:
1. Find the user "${username}" in the provided data
2. Parse their dietary restrictions from the diet_restrictions field (it's in JSON format like {"restrictions": "red meat"})
3. Analyze the food in the image considering their specific restrictions and diet_preference
4. Provide a helpful, accurate answer that considers:
   - What you can see in the image
   - The user's dietary preferences and restrictions
   - Nutritional information if relevant
   - Any recommendations or warnings based on their profile
   - If the user has dietary restrictions, specifically mention if the food contains any restricted ingredients

Keep your response conversational and personalized for ${username}. Keep your response down to a max of 1 paragraph`
            },
            {
              type: 'image',
              source: {
                type: 'url',
                url: imageUrl
              }
            }
          ]
        }
      ]
    });

    const analysis = response.content[0].type === 'text' ? response.content[0].text : 'Unable to analyze the image.';
    
    console.log(`✅ Claude dietary analysis completed for ${username}`);
    return analysis;

  } catch (error) {
    console.error('❌ Error analyzing dietary question with Claude:', error);
    throw new Error(`Failed to analyze dietary question: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Analyze dietary question and convert response to audio using ElevenLabs + UploadThing
 */
export async function analyzeDietaryQuestionWithAudio(
  question: string,
  imageUrl: string,
  username: string = 'Nathan',
  voiceId?: string
): Promise<{
  analysis: string;
  audioUrl: string;
  audioKey: string;
  audioCustomId: string | null;
}> {
  try {
    console.log(`🎵 Starting dietary analysis with audio generation for ${username}`);
    
    // Step 1: Get Claude's dietary analysis
    const analysis = await analyzeDietaryQuestion(question, imageUrl, username);
    
    console.log(`📝 Analysis complete, converting to audio...`);
    
    // Step 2: Convert analysis text to audio using ElevenLabs
    const audioResult = await elevenlabsTTS.generateAndUploadTTS(
      analysis,
      username,
      voiceId
    );
    
    console.log(`🔊 Audio generated and uploaded successfully!`);
    console.log(`📊 Analysis: ${analysis.substring(0, 100)}...`);
    console.log(`🎧 Audio URL: ${audioResult.url}`);
    
    return {
      analysis,
      audioUrl: audioResult.url,
      audioKey: audioResult.key,
      audioCustomId: audioResult.customId
    };

  } catch (error) {
    console.error('❌ Error in dietary analysis with audio:', error);
    throw new Error(`Failed to analyze dietary question with audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Analyze dietary question and convert response to audio using ElevenLabs + UploadThing
 */
export async function analyzeDietaryQuestionWithAudioForGlasses(
  question: string,
  imageUrl: string,
  username: string,
  mentraSession?: any // MentraOS session object
): Promise<{ analysis: string; audioUrl: string }> {
  try {
    // Get the regular analysis with audio
    const result = await analyzeDietaryQuestionWithAudio(question, imageUrl, username);
    
    // If MentraOS session is provided, display on glasses
    if (mentraSession) {
      // Display the analysis text prominently
      mentraSession.layouts.showTextWall(result.analysis, { durationMs: 10000 });
      
      // After text display, show audio access info
      setTimeout(() => {
        mentraSession.layouts.showReferenceCard(
          "🎧 Audio Available",
          `Analysis available as audio at:\n${result.audioUrl}\n\nScan QR code or visit link on phone`,
          { durationMs: 8000 }
        );
      }, 10000);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error in glasses dietary analysis:', error);
    
    // Show error on glasses if session available
    if (mentraSession) {
      mentraSession.layouts.showTextWall("❌ Analysis failed. Please try again.", { durationMs: 5000 });
    }
    
    throw error;
  }
}

/**
 * Enhanced dietary analysis with session integration for optimal glasses display
 */
export async function analyzeDietaryQuestionWithSession(
  question: string,
  imageUrl: string,
  username: string = 'Nathan',
  session?: any, // MentraOS session object
  voiceId?: string
): Promise<{
  analysis: string;
  audioUrl: string;
  audioKey: string;
  audioCustomId: string | null;
}> {
  try {
    // Get the regular analysis with audio
    const result = await analyzeDietaryQuestionWithAudio(question, imageUrl, username, voiceId);
    
    // If MentraOS session is provided, display optimally on glasses
    if (session && session.layouts) {
      // 1. Show analysis text prominently for 12 seconds
      session.layouts.showTextWall(result.analysis, { durationMs: 12000 });
      
      // 2. After text, show reference card with audio access info
      setTimeout(() => {
        session.layouts.showReferenceCard(
          "🎧 Audio Analysis Ready",
          `Your dietary analysis is available as audio.\n\n📱 Audio URL:\n${result.audioUrl}\n\nCopy this link to your phone or browser to listen.`,
          { durationMs: 10000 }
        );
      }, 12000);
      
      // 3. Show final confirmation
      setTimeout(() => {
        session.layouts.showTextWall(
          "✅ Analysis Complete!\n\nAudio URL copied to terminal.\nCheck your console for the full link.",
          { durationMs: 5000 }
        );
      }, 22000);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error in session-integrated dietary analysis:', error);
    
    // Show error on glasses if session available
    if (session && session.layouts) {
      session.layouts.showTextWall("❌ Analysis failed. Please try again.", { durationMs: 5000 });
    }
    
    throw error;
  }
}

/**
 * Convert any text to audio and upload to UploadThing
 * Utility function for converting Claude responses to audio
 */
export async function convertTextToAudio(
  text: string,
  userId: string,
  voiceId?: string
): Promise<{
  audioUrl: string;
  audioKey: string;
  audioCustomId: string | null;
}> {
  try {
    console.log(`🔊 Converting text to audio for user ${userId}`);
    console.log(`📝 Text: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
    
    const audioResult = await elevenlabsTTS.generateAndUploadTTS(
      text,
      userId,
      voiceId
    );
    
    console.log(`✅ Text-to-audio conversion complete: ${audioResult.url}`);
    
    return {
      audioUrl: audioResult.url,
      audioKey: audioResult.key,
      audioCustomId: audioResult.customId
    };

  } catch (error) {
    console.error('❌ Error converting text to audio:', error);
    throw new Error(`Failed to convert text to audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 

// QR code functionality removed - using normal audio URLs with session integration