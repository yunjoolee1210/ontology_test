// Recipe API (Supabase) — 레시피 코치 (저염·저칼륨·저인 대체 레시피 30선)
// 사전세팅: supabase_recipe_setup.sql (recipes 테이블 + 30개 시드)

import { supabase } from '../lib/supabase';

export interface RecipeNutrients {
  kcal: number; protein: number; sodium: number; potassium: number; phosphorus: number;
}
export interface Recipe {
  id: string;
  recipeNo: number;
  slug: string;
  name: string;            // 대체 레시피명
  originalDish: string;    // 원래 요리
  category: 'soup' | 'main' | 'side' | string;
  categoryLabel: string;
  tags: string[];          // 저나트륨/저칼륨/저인
  substitutePoint: string; // 대체 포인트(질환식 핵심)
  ingredients: string[];
  nutrients: RecipeNutrients;
  steps: string[];
  imageUrl: string;
}

const CAT_LABEL: Record<string, string> = { soup: '국·탕·찌개', main: '메인요리', side: '반찬·김치·샐러드' };

const rowToRecipe = (r: any): Recipe => ({
  id: r.id,
  recipeNo: r.recipe_no,
  slug: r.slug,
  name: r.name,
  originalDish: r.original_dish || '',
  category: r.category || 'main',
  categoryLabel: CAT_LABEL[r.category] || '요리',
  tags: r.substitute_tags || [],
  substitutePoint: r.substitute_point || '',
  ingredients: r.ingredients || [],
  nutrients: r.nutrients || { kcal: 0, protein: 0, sodium: 0, potassium: 0, phosphorus: 0 },
  steps: r.steps || [],
  imageUrl: r.image_url || '',
});

export const listRecipes = async (): Promise<Recipe[]> => {
  const { data, error } = await supabase.from('recipes').select('*').order('recipe_no', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map(rowToRecipe);
};

export const getRecipeBySlug = async (slug: string): Promise<Recipe | null> => {
  const { data, error } = await supabase.from('recipes').select('*').eq('slug', slug).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToRecipe(data) : null;
};
