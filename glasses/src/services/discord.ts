/**
 * Discord webhook integration service
 */

import { CONFIG } from '../config/environment';
import { StoredPhoto, NutritionAnalysis } from '../types';

/**
 * Send photo and nutrition analysis to Discord webhook
 */
export async function sendToDiscord(
  photo: StoredPhoto, 
  uploadedFileUrl: string, 
  uploadedFileKey: string, 
  uploadedFileSize: number,
  nutritionAnalysis: NutritionAnalysis | null
): Promise<void> {
  try {
    const embedFields = [
      { name: "Timestamp", value: photo.timestamp.toISOString(), inline: true },
      { name: "File Size", value: `${(photo.size / 1024).toFixed(2)} KB`, inline: true },
      { name: "MIME Type", value: photo.mimeType, inline: true },
      { name: "Storage", value: "UploadThing (nutrilens)", inline: true },
      { name: "CDN URL", value: uploadedFileUrl, inline: false },
      { name: "File Key", value: uploadedFileKey, inline: true }
    ];

    // Add nutrition analysis fields if available
    if (nutritionAnalysis) {
      embedFields.push(
        { name: "🍽️ Food Description", value: nutritionAnalysis.description || "N/A", inline: false }
      );
      
      // Add macronutrients
      const macros: string[] = [];
      if (nutritionAnalysis.calories) macros.push(`🔥 Calories: ${nutritionAnalysis.calories}`);
      if (nutritionAnalysis.protein) macros.push(`🥩 Protein: ${nutritionAnalysis.protein}g`);
      if (nutritionAnalysis.carbs) macros.push(`🍞 Carbs: ${nutritionAnalysis.carbs}g`);
      if (nutritionAnalysis.fats) macros.push(`🥑 Fats: ${nutritionAnalysis.fats}g`);
      if (nutritionAnalysis.sugar) macros.push(`🍯 Sugar: ${nutritionAnalysis.sugar}g`);
      if (nutritionAnalysis.cholesterol) macros.push(`🧈 Cholesterol: ${nutritionAnalysis.cholesterol}mg`);
      
      if (macros.length > 0) {
        embedFields.push({ name: "📊 Macronutrients", value: macros.join('\n'), inline: true });
      }

      // Add vitamins (only if present)
      const vitamins: string[] = [];
      if (nutritionAnalysis.vitamin_a) vitamins.push(`A: ${nutritionAnalysis.vitamin_a}µg`);
      if (nutritionAnalysis.vitamin_c) vitamins.push(`C: ${nutritionAnalysis.vitamin_c}mg`);
      if (nutritionAnalysis.vitamin_d) vitamins.push(`D: ${nutritionAnalysis.vitamin_d}µg`);
      if (nutritionAnalysis.vitamin_e) vitamins.push(`E: ${nutritionAnalysis.vitamin_e}mg`);
      if (nutritionAnalysis.vitamin_k) vitamins.push(`K: ${nutritionAnalysis.vitamin_k}µg`);
      if (nutritionAnalysis.vitamin_b1) vitamins.push(`B1: ${nutritionAnalysis.vitamin_b1}mg`);
      if (nutritionAnalysis.vitamin_b2) vitamins.push(`B2: ${nutritionAnalysis.vitamin_b2}mg`);
      if (nutritionAnalysis.vitamin_b3) vitamins.push(`B3: ${nutritionAnalysis.vitamin_b3}mg`);
      if (nutritionAnalysis.vitamin_b5) vitamins.push(`B5: ${nutritionAnalysis.vitamin_b5}mg`);
      if (nutritionAnalysis.vitamin_b6) vitamins.push(`B6: ${nutritionAnalysis.vitamin_b6}mg`);
      if (nutritionAnalysis.vitamin_b7) vitamins.push(`B7: ${nutritionAnalysis.vitamin_b7}µg`);
      if (nutritionAnalysis.vitamin_b9) vitamins.push(`B9: ${nutritionAnalysis.vitamin_b9}µg`);
      if (nutritionAnalysis.vitamin_b12) vitamins.push(`B12: ${nutritionAnalysis.vitamin_b12}µg`);
      
      if (vitamins.length > 0) {
        embedFields.push({ name: "💊 Vitamins", value: vitamins.join('\n'), inline: true });
      }
    } else {
      embedFields.push({ name: "🤖 AI Analysis", value: "❌ Nutrition analysis failed", inline: false });
    }

    const message = {
      content: `📸 New photo from user ${photo.userId}${nutritionAnalysis ? ' 🧠 Nutrition analysis completed!' : ''}`,
      embeds: [{
        title: nutritionAnalysis ? "📱 Photo + 🧠 AI Nutrition Analysis" : "📱 Photo Details",
        fields: embedFields,
        image: {
          url: uploadedFileUrl
        },
        timestamp: photo.timestamp.toISOString(),
        color: nutritionAnalysis ? 0x00ff00 : 0xffaa00
      }]
    };

    // Send to Discord webhook (no file attachment, just embed with image URL)
    const response = await fetch(CONFIG.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`Failed to send photo to Discord: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    throw new Error(`Error sending to Discord: ${error}`);
  }
} 