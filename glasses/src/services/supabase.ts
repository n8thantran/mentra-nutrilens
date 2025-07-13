/**
 * Supabase service for database operations
 */

import { createClient } from '@supabase/supabase-js';
import { CONFIG } from '../config/environment';
import { NutritionAnalysis, DietaryRestrictions, UserDietaryProfile } from '../types';

// Initialize Supabase client
const supabase = createClient(
  CONFIG.NEXT_PUBLIC_SUPABASE_URL,
  CONFIG.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Parse dietary restrictions from JSON string format
 */
export function parseDietaryRestrictions(jsonString?: string): DietaryRestrictions {
  if (!jsonString) {
    return { restrictions: 'none' };
  }

  try {
    const parsed = JSON.parse(jsonString);
    return {
      restrictions: parsed.restrictions || 'none'
    };
  } catch (error) {
    console.warn('⚠️ Failed to parse dietary restrictions JSON:', jsonString);
    return { restrictions: jsonString }; // Fallback to raw string
  }
}

/**
 * Format dietary restrictions as JSON string
 */
export function formatDietaryRestrictions(restrictions: string): string {
  return JSON.stringify({ restrictions: restrictions || 'none' });
}

/**
 * Enhanced getUserProfile that includes parsed restrictions
 */
export async function getUserProfileWithParsedRestrictions(username: string): Promise<UserDietaryProfile & { parsedRestrictions: DietaryRestrictions } | null> {
  const profile = await getUserProfile(username);
  
  if (!profile) {
    return null;
  }

  return {
    ...profile,
    parsedRestrictions: parseDietaryRestrictions(profile.diet_restrictions)
  };
}

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

/**
 * Get user profile by username, with fallback to create user if missing
 */
export async function getUserProfile(username: string) {
  try {
    console.log(`👤 Fetching user profile for: ${username}`);
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (error) {
      console.error('❌ Error fetching user profile:', error);
      
      if (error.code === 'PGRST116') {
        // User doesn't exist, try to create it
        console.log(`❓ User "${username}" not found, creating default profile...`);
        return await createDefaultUser(username);
      }
      
      return null;
    }

    if (!data) {
      // No user found, create default
      console.log(`❓ User "${username}" not found, creating default profile...`);
      return await createDefaultUser(username);
    }

    console.log('✅ User profile fetched successfully:', data);
    return data;
  } catch (error) {
    console.error('❌ Unexpected error fetching user profile:', error);
    return null;
  }
}

/**
 * Create a default user profile if one doesn't exist
 */
export async function createDefaultUser(username: string) {
  try {
    console.log(`🆕 Creating default user profile for: ${username}`);
    
    // Create user with minimal schema - only fields we know exist
    const defaultUserData = {
      username: username,
      diet_preference: 'balanced',
      diet_restrictions: formatDietaryRestrictions('none') // Use our formatting function
    };

    const { data, error } = await supabase
      .from('users')
      .insert(defaultUserData)
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating default user:', error);
      
      // If the table doesn't exist or has schema issues, log detailed info
      if (error.code === 'PGRST204') {
        console.error('📊 Schema cache issue detected. The users table may not have the expected columns.');
        console.error('💡 Suggestion: Check your database schema or create the users table with proper structure.');
        return null;
      }
      
      return null;
    }

    console.log('✅ Default user created successfully:', data);
    return data;
  } catch (error) {
    console.error('❌ Unexpected error creating default user:', error);
    return null;
  }
}

/**
 * Create or update a user with specific dietary information
 */
export async function upsertUser(username: string, dietaryInfo: {
  diet_preference?: string;
  restrictions?: string;
}) {
  try {
    console.log(`🔄 Upserting user profile for: ${username}`);
    
    const userData = {
      username: username,
      diet_preference: dietaryInfo.diet_preference || 'balanced',
      diet_restrictions: JSON.stringify({ 
        restrictions: dietaryInfo.restrictions || 'none' 
      }),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('users')
      .upsert(userData, { 
        onConflict: 'username',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error upserting user:', error);
      return null;
    }

    console.log('✅ User upserted successfully:', data);
    return data;
  } catch (error) {
    console.error('❌ Unexpected error upserting user:', error);
    return null;
  }
}

/**
 * Get all users for admin purposes
 */
export async function getAllUsers() {
  try {
    console.log('👥 Fetching all users...');
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching users:', error);
      return [];
    }

    console.log(`✅ Fetched ${data.length} users successfully`);
    return data;
  } catch (error) {
    console.error('❌ Unexpected error fetching users:', error);
    return [];
  }
} 

/**
 * Create the Nathan user with example dietary restrictions for testing
 */
export async function createNathanUser() {
  try {
    console.log('🆕 Creating Nathan user with example dietary restrictions...');
    
    // Use minimal schema - only fields we know exist
    const nathanData = {
      username: 'Nathan',
      diet_preference: 'balanced',
      diet_restrictions: formatDietaryRestrictions('red meat') // Use proper formatting
    };

    const { data, error } = await supabase
      .from('users')
      .upsert(nathanData, { 
        onConflict: 'username',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating Nathan user:', error);
      
      // Handle schema cache issues specifically
      if (error.code === 'PGRST204') {
        console.error('📊 Schema cache issue: Column not found in users table');
        console.error('💡 Try reloading the PostgREST schema cache or check table structure');
        return null;
      }
      return null;
    }

    console.log('✅ Nathan user created/updated successfully:', data);
    console.log('🍽️ Parsed restrictions:', parseDietaryRestrictions(data.diet_restrictions));
    return data;
  } catch (error) {
    console.error('❌ Unexpected error creating Nathan user:', error);
    return null;
  }
}

/**
 * Initialize database with example users for testing
 */
export async function initializeExampleUsers() {
  try {
    console.log('🚀 Initializing example users...');
    
    const exampleUsers = [
      {
        username: 'Nathan',
        diet_preference: 'balanced',
        diet_restrictions: JSON.stringify({ restrictions: 'red meat' })
      },
      {
        username: 'Alice',
        diet_preference: 'vegetarian',
        diet_restrictions: JSON.stringify({ restrictions: 'meat, fish' })
      },
      {
        username: 'Bob',
        diet_preference: 'keto',
        diet_restrictions: JSON.stringify({ restrictions: 'carbs, sugar' })
      }
    ];

    const results = [];
    for (const userData of exampleUsers) {
      const user = await upsertUser(userData.username, {
        diet_preference: userData.diet_preference,
        restrictions: JSON.parse(userData.diet_restrictions).restrictions
      });
      if (user) {
        results.push(user);
      }
    }

    console.log(`✅ Initialized ${results.length} example users`);
    return results;
  } catch (error) {
    console.error('❌ Error initializing example users:', error);
    return [];
  }
} 