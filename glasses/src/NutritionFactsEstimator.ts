import axios from 'axios';
import { Anthropic } from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Explicitly load .env from the project root
dotenv.config({ path: resolve(__dirname, '../../.env') });

export class NutritionFactsEstimator {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY || ''
    });
  }

  async downloadAndEncodeImage(imageUrl: string): Promise<string> {
    try {
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const imageBase64 = Buffer.from(response.data, 'binary').toString('base64');
      return imageBase64;
    } catch (error: any) {
      throw new Error(`Failed to download image: ${error.message}`);
    }
  }

  async analyzeNutritionFacts(imageBase64: string): Promise<any> {
    const imageType = 'image/jpeg'; // You may want to detect this dynamically
    const prompt = `
Please analyze this food image and estimate the nutritional information based on what you can see.

Look at the food items, portion sizes, ingredients, and cooking methods visible in the image to make educated estimates.

Return the data as a JSON object with the following structure:
{
    "food_description": "brief description of what you see",
    "estimated_serving_size": "your estimate of serving size",
    "calories": estimated_numeric_value,
    "fats": estimated_numeric_value_in_grams,
    "protein": estimated_numeric_value_in_grams,
    "carbs": estimated_numeric_value_in_grams,
    "sugar": estimated_numeric_value_in_grams,
    "cholesterol": estimated_numeric_value_in_milligrams,
    "vitamin_a": estimated_numeric_value_in_grams,
    "vitamin_c": estimated_numeric_value_in_grams,
    "vitamin_d": estimated_numeric_value_in_grams,
    "vitamin_e": estimated_numeric_value_in_grams,
    "vitamin_k": estimated_numeric_value_in_grams,
    "vitamin_b1": estimated_numeric_value_in_grams,
    "vitamin_b2": estimated_numeric_value_in_grams,
    "vitamin_b3": estimated_numeric_value_in_grams,
    "vitamin_b5": estimated_numeric_value_in_grams,
    "vitamin_b6": estimated_numeric_value_in_grams,
    "vitamin_b7": estimated_numeric_value_in_grams,
    "vitamin_b9": estimated_numeric_value_in_grams,
    "vitamin_b12": estimated_numeric_value_in_grams,
    "confidence_level": "high/medium/low based on how clearly you can see the food"
}

IMPORTANT UNIT CONVERSIONS:
- ALL VITAMIN VALUES must be converted to and expressed in GRAMS
- If you estimate vitamin B12 as 150 micrograms, convert to grams: 150 μg = 0.00015 g
- If you estimate vitamin C as 50 milligrams, convert to grams: 50 mg = 0.05 g
- For very small amounts, use scientific notation (e.g., 1.5e-6 for 1.5 micrograms)
- Macronutrients (fats, protein, carbs, sugar) should be in grams
- Cholesterol should remain in milligrams
- Calories should be the numeric value only

Base your estimates on standard nutritional data for similar foods and visible portion sizes.
If you cannot make a reasonable estimate for a vitamin, use null.

IMPORTANT: Return ONLY the JSON object, no additional text, explanations, or reasoning.
`;

    try {
      const message = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: imageType,
                  data: imageBase64
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ]
      });

      // Parse the JSON response
      const responseText = (message.content as any)[0].text.trim();
      return JSON.parse(responseText);
    } catch (error: any) {
      throw new Error(`Failed to analyze image with Claude: ${error.message}`);
    }
  }

  async processImageUrl(imageUrl: string): Promise<any> {
    console.log(`Processing image from: ${imageUrl}`);
    // Step 1: Download and encode image
    console.log('Downloading and encoding image...');
    const imageBase64 = await this.downloadAndEncodeImage(imageUrl);
    // Step 2: Analyze with Claude
    console.log('Analyzing nutrition facts with Claude...');
    const nutritionData = await this.analyzeNutritionFacts(imageBase64);
    console.log('Analysis complete!');
    return nutritionData;
  }
}

// Example usage (uncomment to test)
// (async () => {
//   const estimator = new NutritionFactsEstimator();
//   const result = await estimator.processImageUrl('https://example.com/nutrition-facts.jpg');
//   console.log(JSON.stringify(result, null, 2));
// })(); 