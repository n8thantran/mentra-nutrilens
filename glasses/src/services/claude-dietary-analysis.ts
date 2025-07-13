/**
 * Claude dietary analysis service for answering questions based on images and user dietary profile
 * Uses entire users table data instead of parsing dietary restrictions locally
 */

import Anthropic from '@anthropic-ai/sdk';
import { CONFIG } from '../config/environment';
import { createClient } from '@supabase/supabase-js';

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

Keep your response conversational and personalized for ${username}.`
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