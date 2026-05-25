// Recipe API (Supabase) — 레시피 코치 (저염·저칼륨·저인 대체 레시피 30선)

import { supabase } from '../lib/supabase';

export interface RecipeNutrients {
  kcal: number; protein: number; sodium: number; potassium: number; phosphorus: number;
}

export interface RecipeProduct {
  id: string;
  ingredientKeyword: string;
  productName: string;
  coupangUrl: string;
}

export interface Recipe {
  id: string;
  recipeNo: number | null;
  slug: string;
  name: string;
  originalDish: string;
  category: 'soup' | 'main' | 'side' | string;
  categoryLabel: string;
  tags: string[];
  substitutePoint: string;
  ingredients: string[];
  nutrients: RecipeNutrients;
  steps: string[];
  imageUrl: string;
  likesCount: number;
  dislikesCount: number;
  isUserSubmitted: boolean;
  submittedBy: string | null;
}

export interface NewRecipeInput {
  name: string;
  originalDish: string;
  category: 'soup' | 'main' | 'side';
  tags: string[];
  substitutePoint: string;
  ingredients: string[];
  steps: string[];
  nutrients: Partial<RecipeNutrients>;
  imageUrl?: string;
}

const CAT_LABEL: Record<string, string> = {
  soup: '국·탕·찌개',
  main: '메인요리',
  side: '반찬·김치·샐러드',
};

const rowToRecipe = (r: any): Recipe => ({
  id: r.id,
  recipeNo: r.recipe_no ?? null,
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
  // 표준 레시피(recipe_no 있음): 요리명 매칭 로컬 이미지 고정
  // 사용자 등록 레시피: DB image_url 사용
  imageUrl: r.is_user_submitted
    ? (r.image_url || '')
    : `/recipes/recipe-${r.recipe_no}.jpg`,
  likesCount: r.likes_count ?? 0,
  dislikesCount: r.dislikes_count ?? 0,
  isUserSubmitted: r.is_user_submitted ?? false,
  submittedBy: r.submitted_by ?? null,
});

export const listRecipes = async (): Promise<Recipe[]> => {
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .order('is_user_submitted', { ascending: true })
    .order('recipe_no', { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data || []).map(rowToRecipe);
};

export const getRecipeBySlug = async (slug: string): Promise<Recipe | null> => {
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToRecipe(data) : null;
};

// 재료 키워드에 매칭되는 추천 제품 목록
export const listProducts = async (): Promise<RecipeProduct[]> => {
  const { data, error } = await supabase.from('recipe_products').select('*');
  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({
    id: r.id,
    ingredientKeyword: r.ingredient_keyword,
    productName: r.product_name,
    coupangUrl: r.coupang_url,
  }));
};

// 현재 로그인 사용자의 투표 목록
export const getUserVotes = async (): Promise<Record<string, 'like' | 'dislike'>> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};
  const { data } = await supabase
    .from('recipe_votes')
    .select('recipe_id, vote_type')
    .eq('user_id', user.id);
  const map: Record<string, 'like' | 'dislike'> = {};
  (data || []).forEach((v: any) => { map[v.recipe_id] = v.vote_type; });
  return map;
};

// 좋아요 / 싫어요 토글
// 같은 타입 재클릭 → 취소, 다른 타입 → 변경
export const voteRecipe = async (
  recipeId: string,
  voteType: 'like' | 'dislike'
): Promise<'voted' | 'unvoted'> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인 필요');

  const { data: existing } = await supabase
    .from('recipe_votes')
    .select('id, vote_type')
    .eq('recipe_id', recipeId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    if (existing.vote_type === voteType) {
      await supabase.from('recipe_votes').delete().eq('id', existing.id);
      return 'unvoted';
    }
    await supabase.from('recipe_votes').update({ vote_type: voteType }).eq('id', existing.id);
    return 'voted';
  }
  await supabase.from('recipe_votes').insert({ recipe_id: recipeId, user_id: user.id, vote_type: voteType });
  return 'voted';
};

// 사용자 레시피 등록
export const submitUserRecipe = async (input: NewRecipeInput): Promise<Recipe> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인 필요');

  const slug = `user-${Date.now()}`;
  const nutrients = {
    kcal: input.nutrients.kcal ?? 0,
    protein: input.nutrients.protein ?? 0,
    sodium: input.nutrients.sodium ?? 0,
    potassium: input.nutrients.potassium ?? 0,
    phosphorus: input.nutrients.phosphorus ?? 0,
  };

  const { data, error } = await supabase
    .from('recipes')
    .insert({
      slug,
      name: input.name,
      original_dish: input.originalDish,
      category: input.category,
      substitute_tags: input.tags,
      substitute_point: input.substitutePoint,
      ingredients: input.ingredients.filter(Boolean),
      steps: input.steps.filter(Boolean),
      nutrients,
      image_url: input.imageUrl || null,
      is_user_submitted: true,
      submitted_by: user.id,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToRecipe(data);
};

// 사용자 레시피 이미지 Supabase Storage 업로드
export const uploadRecipeImage = async (file: File): Promise<string> => {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `user-recipe-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('recipe-images')
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw new Error(error.message);
  return supabase.storage.from('recipe-images').getPublicUrl(path).data.publicUrl;
};
