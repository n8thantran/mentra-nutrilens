/**
 * Shared TypeScript interfaces and types for the nutrition lens application
 */

/**
 * Interface representing nutrition analysis results from Claude Vision API
 */
export interface NutritionAnalysis {
  calories?: number;
  fats?: number;
  protein?: number;
  carbs?: number;
  sugar?: number;
  cholesterol?: number;
  vitamin_a?: number;
  vitamin_c?: number;
  vitamin_d?: number;
  vitamin_e?: number;
  vitamin_k?: number;
  vitamin_b1?: number;
  vitamin_b2?: number;
  vitamin_b3?: number;
  vitamin_b5?: number;
  vitamin_b6?: number;
  vitamin_b7?: number;
  vitamin_b9?: number;
  vitamin_b12?: number;
  potassium?: number;
  calcium?: number;
  iron?: number;
  sodium?: number;
  description?: string;
  imgURL?: string;
}

/**
 * Interface representing a stored photo with metadata
 */
export interface StoredPhoto {
  requestId: string;
  buffer: Buffer;
  timestamp: Date;
  userId: string;
  mimeType: string;
  filename: string;
  size: number;
} 