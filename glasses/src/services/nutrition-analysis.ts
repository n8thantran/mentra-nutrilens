/**
 * Nutrition analysis service using Claude Vision API
 */

import Anthropic from '@anthropic-ai/sdk';
import { CONFIG } from '../config/environment';
import { NutritionAnalysis } from '../types';

// Claude client for nutrition analysis
const claude = new Anthropic({
  apiKey: CONFIG.CLAUDE_KEY,
});

/**
 * Analyze nutrition facts from an image using Claude Vision API
 */
export async function analyzeNutritionFacts(imageUrl: string): Promise<NutritionAnalysis | null> {
  try {
    console.log(`🧠 Analyzing nutrition facts from image: ${imageUrl}`);
    
    const response = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze and estimate the nutrition facts of all the food present in this image and return ONLY a valid JSON object with nutrition data. Do not include any explanatory text, comments, or formatting - just the raw JSON.

Extract visible nutrition values or estimate them and return this exact structure:
{
  "calories": number or null,
  "fats": number or null,
  "protein": number or null,
  "carbs": number or null,
  "sugar": number or null,
  "cholesterol": number or null,
  "vitamin_a": number or null,
  "vitamin_c": number or null,
  "vitamin_d": number or null,
  "vitamin_e": number or null,
  "vitamin_k": number or null,
  "vitamin_b1": number or null,
  "vitamin_b2": number or null,
  "vitamin_b3": number or null,
  "vitamin_b5": number or null,
  "vitamin_b6": number or null,
  "vitamin_b7": number or null,
  "vitamin_b9": number or null,
  "vitamin_b12": number or null,
  "potassium": number or null,
  "calcium": number or null,
  "iron": number or null,
  "sodium": number or null,
  "description": "brief food description"
}

Rules:
- Return ONLY the JSON object, no other text
- Convert units to grams for macros and vitamins
- Estimate based on typical serving sizes`
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

    // Extract text from all content blocks
    let responseText = '';
    for (const contentBlock of response.content) {
      if (contentBlock.type === 'text') {
        responseText += contentBlock.text;
      }
    }

    console.log('🧠 Full Claude response text:', responseText);

    // Clean and parse JSON from the response
    let jsonString = responseText.trim();
    
    // If the response doesn't start with {, try to extract JSON
    if (!jsonString.startsWith('{')) {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }
      jsonString = jsonMatch[0];
    }

    const nutritionData: NutritionAnalysis = JSON.parse(jsonString);
    
    console.log('✅ Nutrition analysis completed successfully');
    logNutritionData(nutritionData);

    return nutritionData;

  } catch (error) {
    console.error(`❌ Error analyzing nutrition facts: ${error}`);
    return null;
  }
}

/**
 * Log nutrition data in a formatted way
 */
function logNutritionData(nutritionData: NutritionAnalysis) {
  console.log('📊 PARSED JSON RESULT:');
  console.log('=====================================');
  console.log(JSON.stringify(nutritionData, null, 2));
  console.log('=====================================');
  console.log('📊 FORMATTED NUTRITION ANALYSIS:');
  console.log('=====================================');
  console.log(`📖 Description: ${nutritionData.description || 'N/A'}`);
  console.log(`🔥 Calories: ${nutritionData.calories || 'N/A'}`);
  console.log(`🥑 Fats: ${nutritionData.fats || 'N/A'}g`);
  console.log(`🥩 Protein: ${nutritionData.protein || 'N/A'}g`);
  console.log(`🍞 Carbs: ${nutritionData.carbs || 'N/A'}g`);
  console.log(`🍯 Sugar: ${nutritionData.sugar || 'N/A'}g`);
  console.log(`🧈 Cholesterol: ${nutritionData.cholesterol || 'N/A'}mg`);
  console.log('💊 VITAMINS:');
  console.log(`  Vitamin A: ${nutritionData.vitamin_a || 'N/A'}µg`);
  console.log(`  Vitamin C: ${nutritionData.vitamin_c || 'N/A'}mg`);
  console.log(`  Vitamin D: ${nutritionData.vitamin_d || 'N/A'}µg`);
  console.log(`  Vitamin E: ${nutritionData.vitamin_e || 'N/A'}mg`);
  console.log(`  Vitamin K: ${nutritionData.vitamin_k || 'N/A'}µg`);
  console.log(`  Vitamin B1: ${nutritionData.vitamin_b1 || 'N/A'}mg`);
  console.log(`  Vitamin B2: ${nutritionData.vitamin_b2 || 'N/A'}mg`);
  console.log(`  Vitamin B3: ${nutritionData.vitamin_b3 || 'N/A'}mg`);
  console.log(`  Vitamin B5: ${nutritionData.vitamin_b5 || 'N/A'}mg`);
  console.log(`  Vitamin B6: ${nutritionData.vitamin_b6 || 'N/A'}mg`);
  console.log(`  Vitamin B7: ${nutritionData.vitamin_b7 || 'N/A'}µg`);
  console.log(`  Vitamin B9: ${nutritionData.vitamin_b9 || 'N/A'}µg`);
  console.log(`  Vitamin B12: ${nutritionData.vitamin_b12 || 'N/A'}µg`);
  console.log('🧂 MINERALS:');
  console.log(`  Potassium: ${nutritionData.potassium || 'N/A'}mg`);
  console.log(`  Calcium: ${nutritionData.calcium || 'N/A'}mg`);
  console.log(`  Iron: ${nutritionData.iron || 'N/A'}mg`);
  console.log(`  Sodium: ${nutritionData.sodium || 'N/A'}mg`);
  console.log('=====================================');
} 