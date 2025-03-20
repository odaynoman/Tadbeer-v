import { supabase } from './supabase';

// معاملات التحويل للتأثير البيئي
const ENVIRONMENTAL_IMPACT = {
  CO2_PER_KG: 2.5, // كغم من CO2 لكل كغم من الطعام المهدر
  WATER_PER_KG: 1000, // لتر من الماء لكل كغم من الطعام المهدر
};

export interface FoodSaving {
  id: number;
  user_id: string;
  food_amount: number; // بالكيلوغرام
  created_at: string;
  recipe_name: string;
}

export async function addFoodSaving(
  userId: string,
  foodAmount: number,
  recipeName: string
) {
  try {
    const { data, error } = await supabase
      .from('food_savings')
      .insert([
        {
          user_id: userId,
          food_amount: foodAmount,
          recipe_name: recipeName,
        },
      ])
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving food savings:', error);
    throw error;
  }
}

export async function getUserStats(userId: string) {
  try {
    const { data, error } = await supabase
      .from('food_savings')
      .select('food_amount')
      .eq('user_id', userId);

    if (error) throw error;

    const totalSavedFood = data?.reduce((sum, item) => sum + item.food_amount, 0) || 0;
    
    return {
      savedFood: totalSavedFood,
      co2Saved: totalSavedFood * ENVIRONMENTAL_IMPACT.CO2_PER_KG,
      waterSaved: totalSavedFood * ENVIRONMENTAL_IMPACT.WATER_PER_KG,
    };
  } catch (error) {
    console.error('Error getting user stats:', error);
    throw error;
  }
} 