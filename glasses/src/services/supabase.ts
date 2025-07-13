/**
 * Supabase service for database operations
 */

import { createClient } from '@supabase/supabase-js';
import { CONFIG } from '../config/environment';
import { NutritionAnalysis } from '../types';

// Initialize Supabase client
const supabase = createClient(
  CONFIG.NEXT_PUBLIC_SUPABASE_URL,
  CONFIG.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Insert nutrition analysis data into the nutrition_facts table
 */
export async function insertNutritionData(nutritionData: NutritionAnalysis): Promise<boolean> {
  try {
    console.log('💾 Saving nutrition data to Supabase...');
    
    // Prepare data for insertion (filter out undefined values)
    const insertData = {
      calories: nutritionData.calories || null,
      fats: nutritionData.fats || null,
      protein: nutritionData.protein || null,
      carbs: nutritionData.carbs || null,
      sugar: nutritionData.sugar || null,
      cholesterol: nutritionData.cholesterol || null,
      vitamin_a: nutritionData.vitamin_a || null,
      vitamin_c: nutritionData.vitamin_c || null,
      vitamin_d: nutritionData.vitamin_d || null,
      vitamin_e: nutritionData.vitamin_e || null,
      vitamin_k: nutritionData.vitamin_k || null,
      vitamin_b1: nutritionData.vitamin_b1 || null,
      vitamin_b2: nutritionData.vitamin_b2 || null,
      vitamin_b3: nutritionData.vitamin_b3 || null,
      vitamin_b5: nutritionData.vitamin_b5 || null,
      vitamin_b6: nutritionData.vitamin_b6 || null,
      vitamin_b7: nutritionData.vitamin_b7 || null,
      vitamin_b9: nutritionData.vitamin_b9 || null,
      vitamin_b12: nutritionData.vitamin_b12 || null,
      potassium: nutritionData.potassium || null,
      calcium: nutritionData.calcium || null,
      iron: nutritionData.iron || null,
      sodium: nutritionData.sodium || null,
      imgURL: nutritionData.imgURL || null,
      timestamp: new Date().toISOString(),
    };

    console.log('📊 Inserting nutrition data:', insertData);

    const { data, error } = await supabase
      .from('nutrition_facts')
      .insert([insertData])
      .select();

    if (error) {
      console.error('❌ Error inserting nutrition data:', error);
      return false;
    }

    console.log('✅ Nutrition data saved successfully:', data);
    return true;

  } catch (error) {
    console.error('❌ Unexpected error saving nutrition data:', error);
    return false;
  }
}

/**
 * Get recent nutrition facts entries
 */
export async function getRecentNutritionData(limit: number = 10) {
  try {
    const { data, error } = await supabase
      .from('nutrition_facts')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Error fetching nutrition data:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ Unexpected error fetching nutrition data:', error);
    return null;
  }
} 