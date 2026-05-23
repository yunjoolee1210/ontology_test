/**
 * CKD 환자를 위한 영양 정보 Knowledge Base
 * 모든 이미지는 로컬 정적 파일 사용 (public/food/)
 */

export interface FoodItem {
  name: string;
  name_en: string;
  potassium?: number;
  phosphorus?: number;
  category: string;
  image: string;
}

// =============================================================================
// 칼륨 (Potassium) 관련 데이터
// =============================================================================

export const LOW_POTASSIUM_INGREDIENTS: FoodItem[] = [
  { name: '귀리', name_en: 'oats', potassium: 383, category: 'grain', image: '/food/귀리.jpg' },
  { name: '메밀국수', name_en: 'buckwheat_noodles', potassium: 12, category: 'grain', image: '/food/메밀국수.jpg' },
  { name: '백미', name_en: 'white_rice', potassium: 81, category: 'grain', image: '/food/백미.jpg' },
  { name: '기장', name_en: 'millet', potassium: 83, category: 'grain', image: '/food/기장.jpg' },
  { name: '메밀묵', name_en: 'buckwheat_jelly', potassium: 48, category: 'grain', image: '/food/메밀묵.jpg' },
  { name: '양배추', name_en: 'cabbage', potassium: 170, category: 'vegetable', image: '/food/양배추.jpg' },
  { name: '오이', name_en: 'cucumber', potassium: 147, category: 'vegetable', image: '/food/오이.jpg' },
  { name: '가지', name_en: 'eggplant', potassium: 230, category: 'vegetable', image: '/food/가지.jpg' },
  { name: '상추', name_en: 'lettuce', potassium: 194, category: 'vegetable', image: '/food/상추.jpg' },
  { name: '양파', name_en: 'onion', potassium: 146, category: 'vegetable', image: '/food/양파.jpg' },
];

export const HIGH_POTASSIUM_INGREDIENTS: FoodItem[] = [
  { name: '시금치', name_en: 'spinach', potassium: 839, category: 'vegetable', image: '/food/시금치.jpg' },
  { name: '감자', name_en: 'potato', potassium: 738, category: 'vegetable', image: '/food/감자.jpg' },
  { name: '고구마', name_en: 'sweet_potato', potassium: 542, category: 'vegetable', image: '/food/고구마.jpg' },
  { name: '바나나', name_en: 'banana', potassium: 422, category: 'fruit', image: '/food/바나나.jpg' },
  { name: '흰콩', name_en: 'white_beans', potassium: 595, category: 'legume', image: '/food/흰콩.jpg' },
  { name: '조개', name_en: 'clam', potassium: 534, category: 'seafood', image: '/food/조개.jpg' },
  { name: '광어', name_en: 'flounder', potassium: 490, category: 'seafood', image: '/food/광어.jpg' },
  { name: '아보카도', name_en: 'avocado', potassium: 487, category: 'fruit', image: '/food/아보카도.jpg' },
  { name: '미나리', name_en: 'water_parsley', potassium: 525, category: 'vegetable', image: '/food/미나리.jpg' },
  { name: '브로콜리', name_en: 'broccoli', potassium: 291, category: 'vegetable', image: '/food/브로콜리.jpg' },
];

export const LOW_POTASSIUM_PROCESSED: FoodItem[] = [
  { name: '캐러멜팝콘', name_en: 'caramel_popcorn', potassium: 143, category: 'snack', image: '/food/캐러멜팝콘.jpg' },
  { name: '팝콘', name_en: 'popcorn', potassium: 219, category: 'snack', image: '/food/팝콘.jpg' },
  { name: '도넛', name_en: 'donut', potassium: 67, category: 'snack', image: '/food/도넛.jpg' },
  { name: '꽈배기', name_en: 'twisted_donut', potassium: 112, category: 'snack', image: '/food/꽈배기.jpg' },
  { name: '시루떡', name_en: 'rice_cake', potassium: 195, category: 'snack', image: '/food/시루떡.jpg' },
];

export const HIGH_POTASSIUM_PROCESSED: FoodItem[] = [
  { name: '감자수프', name_en: 'potato_soup', potassium: 461, category: 'soup', image: '/food/감자수프.jpg' },
  { name: '옥수수수프', name_en: 'corn_soup', potassium: 532, category: 'soup', image: '/food/옥수수수프.jpg' },
  { name: '치즈버거', name_en: 'cheeseburger', potassium: 248, category: 'fast_food', image: '/food/치즈버거.jpg' },
  { name: '연어스테이크', name_en: 'salmon_steak', potassium: 247, category: 'main_dish', image: '/food/연어스테이크.jpg' },
  { name: '찹스테이크', name_en: 'chop_steak', potassium: 246, category: 'main_dish', image: '/food/찹스테이크.jpg' },
];

export const LOW_POTASSIUM_DISHES: FoodItem[] = [
  { name: '크로켓', name_en: 'croquette', potassium: 300, category: 'side_dish', image: '/food/크로켓.jpg' },
  { name: '불고기피자', name_en: 'bulgogi_pizza', potassium: 162, category: 'main_dish', image: '/food/불고기피자.jpg' },
  { name: '콤비네이션피자', name_en: 'combination_pizza', potassium: 123, category: 'main_dish', image: '/food/콤비네이션피자.jpg' },
  { name: '핫도그', name_en: 'hotdog', potassium: 124, category: 'fast_food', image: '/food/핫도그.jpg' },
  { name: '햄버거', name_en: 'burger', potassium: 234, category: 'fast_food', image: '/food/햄버거.jpg' },
  { name: '채소버거', name_en: 'veggie_burger', potassium: 174, category: 'fast_food', image: '/food/채소버거.jpg' },
  { name: '순대', name_en: 'sundae', potassium: 44, category: 'korean', image: '/food/순대.jpg' },
  { name: '찹쌀떡', name_en: 'rice_cake', potassium: 43, category: 'snack', image: '/food/찹쌀떡.jpg' },
  { name: '볶음밥', name_en: 'fried_rice', potassium: 67, category: 'main_dish', image: '/food/볶음밥.jpg' },
  { name: '김치볶음밥', name_en: 'kimchi_rice', potassium: 136, category: 'main_dish', image: '/food/김치볶음밥.jpg' },
];

export const HIGH_POTASSIUM_DISHES: FoodItem[] = [
  { name: '시금치볶음', name_en: 'spinach_dish', potassium: 839, category: 'side_dish', image: '/food/시금치볶음.jpg' },
  { name: '감자전', name_en: 'potato_pancake', potassium: 738, category: 'side_dish', image: '/food/감자전.jpg' },
  { name: '고구마구이', name_en: 'roasted_potato', potassium: 542, category: 'snack', image: '/food/고구마구이.jpg' },
  { name: '바나나스무디', name_en: 'banana_smoothie', potassium: 422, category: 'beverage', image: '/food/바나나스무디.jpg' },
  { name: '흰콩스튜', name_en: 'bean_stew', potassium: 595, category: 'main_dish', image: '/food/흰콩스튜.jpg' },
  { name: '조개탕', name_en: 'clam_soup', potassium: 534, category: 'soup', image: '/food/조개탕.jpg' },
  { name: '광어구이', name_en: 'grilled_fish', potassium: 490, category: 'main_dish', image: '/food/광어구이.jpg' },
  { name: '아보카도토스트', name_en: 'avocado_toast', potassium: 487, category: 'breakfast', image: '/food/아보카도토스트.jpg' },
  { name: '미나리무침', name_en: 'parsley_dish', potassium: 525, category: 'side_dish', image: '/food/미나리무침.jpg' },
  { name: '브로콜리수프', name_en: 'broccoli_soup', potassium: 291, category: 'soup', image: '/food/브로콜리수프.jpg' },
];


// =============================================================================
// 인 (Phosphorus) 관련 데이터
// =============================================================================

export const LOW_PHOSPHORUS_INGREDIENTS: FoodItem[] = [
  { name: '메밀국수', name_en: 'buckwheat_noodles', phosphorus: 30, category: 'grain', image: '/food/메밀국수.jpg' },
  { name: '메밀냉면', name_en: 'cold_noodles', phosphorus: 40, category: 'grain', image: '/food/메밀냉면.jpg' },
  { name: '메밀묵', name_en: 'buckwheat_jelly', phosphorus: 37, category: 'grain', image: '/food/메밀묵.jpg' },
  { name: '백미', name_en: 'white_rice', phosphorus: 97, category: 'grain', image: '/food/백미.jpg' },
  { name: '기장', name_en: 'millet', phosphorus: 107, category: 'grain', image: '/food/기장.jpg' },
  { name: '가래떡', name_en: 'rice_cake', phosphorus: 36, category: 'grain', image: '/food/가래떡.jpg' },
  { name: '수세미수액', name_en: 'loofah_sap', phosphorus: 32, category: 'beverage', image: '/food/수세미수액.jpg' },
  { name: '솔잎추출', name_en: 'pine_extract', phosphorus: 4, category: 'beverage', image: '/food/솔잎추출.jpg' },
  { name: '대나무추출', name_en: 'bamboo_extract', phosphorus: 1, category: 'beverage', image: '/food/대나무추출.jpg' },
  { name: '고로쇠수액', name_en: 'maple_sap', phosphorus: 0, category: 'beverage', image: '/food/고로쇠수액.jpg' },
];

export const HIGH_PHOSPHORUS_INGREDIENTS: FoodItem[] = [
  { name: '귀리(생)', name_en: 'raw_oats', phosphorus: 361, category: 'grain', image: '/food/귀리(생).jpg' },
  { name: '쌀귀리', name_en: 'rice_oats', phosphorus: 409, category: 'grain', image: '/food/쌀귀리.jpg' },
  { name: '찰기장', name_en: 'glutinous_millet', phosphorus: 354, category: 'grain', image: '/food/찰기장.jpg' },
  { name: '메밀(생)', name_en: 'raw_buckwheat', phosphorus: 453, category: 'grain', image: '/food/메밀(생).jpg' },
  { name: '메밀가루', name_en: 'buckwheat_flour', phosphorus: 435, category: 'grain', image: '/food/메밀가루.jpg' },
  { name: '단백질보충제', name_en: 'protein_powder', phosphorus: 643, category: 'supplement', image: '/food/단백질보충제.jpg' },
  { name: '화분', name_en: 'bee_pollen', phosphorus: 480, category: 'supplement', image: '/food/화분.jpg' },
  { name: '치즈', name_en: 'cheese', phosphorus: 512, category: 'dairy', image: '/food/치즈.jpg' },
  { name: '우유', name_en: 'milk', phosphorus: 247, category: 'dairy', image: '/food/우유.jpg' },
  { name: '요거트', name_en: 'yogurt', phosphorus: 135, category: 'dairy', image: '/food/요거트.jpg' },
];

export const LOW_PHOSPHORUS_PROCESSED: FoodItem[] = [
  { name: '채소크로켓', name_en: 'veggie_croquette', phosphorus: 52, category: 'side_dish', image: '/food/채소크로켓.jpg' },
  { name: '크림크로켓', name_en: 'cream_croquette', phosphorus: 63, category: 'side_dish', image: '/food/크림크로켓.jpg' },
  { name: '감자크로켓', name_en: 'potato_croquette', phosphorus: 62, category: 'side_dish', image: '/food/감자크로켓.jpg' },
  { name: '핫도그', name_en: 'hotdog', phosphorus: 165, category: 'fast_food', image: '/food/핫도그.jpg' },
  { name: '햄버거', name_en: 'burger', phosphorus: 134, category: 'fast_food', image: '/food/햄버거.jpg' },
];

export const HIGH_PHOSPHORUS_PROCESSED: FoodItem[] = [
  { name: '불고기피자', name_en: 'bulgogi_pizza', phosphorus: 201, category: 'main_dish', image: '/food/불고기피자.jpg' },
  { name: '콤비네이션피자', name_en: 'pizza', phosphorus: 186, category: 'main_dish', image: '/food/콤비네이션피자.jpg' },
  { name: '옥수수수프', name_en: 'corn_soup', phosphorus: 254, category: 'soup', image: '/food/옥수수수프.jpg' },
  { name: '치즈스틱', name_en: 'cheese_stick', phosphorus: 339, category: 'snack', image: '/food/치즈스틱.jpg' },
  { name: '콩미트볼', name_en: 'soy_meatball', phosphorus: 344, category: 'main_dish', image: '/food/콩미트볼.jpg' },
];

export const LOW_PHOSPHORUS_DISHES: FoodItem[] = [
  { name: '크로켓', name_en: 'croquette', phosphorus: 57, category: 'side_dish', image: '/food/크로켓.jpg' },
  { name: '핫도그', name_en: 'hotdog', phosphorus: 165, category: 'fast_food', image: '/food/핫도그.jpg' },
  { name: '햄버거', name_en: 'hamburger', phosphorus: 134, category: 'fast_food', image: '/food/햄버거.jpg' },
  { name: '순대', name_en: 'sundae', phosphorus: 232, category: 'korean', image: '/food/순대.jpg' },
  { name: '찹쌀떡', name_en: 'rice_cake', phosphorus: 38, category: 'snack', image: '/food/찹쌀떡.jpg' },
  { name: '크림수프', name_en: 'cream_soup', phosphorus: 49, category: 'soup', image: '/food/크림수프.jpg' },
  { name: '볶음밥', name_en: 'fried_rice', phosphorus: 67, category: 'main_dish', image: '/food/볶음밥.jpg' },
  { name: '김치볶음밥', name_en: 'kimchi_rice', phosphorus: 136, category: 'main_dish', image: '/food/김치볶음밥.jpg' },
  { name: '전복죽', name_en: 'abalone_porridge', phosphorus: 17, category: 'main_dish', image: '/food/전복죽.jpg' },
  { name: '감자샐러드', name_en: 'potato_salad', phosphorus: 52, category: 'side_dish', image: '/food/감자샐러드.jpg' },
];

export const HIGH_PHOSPHORUS_DISHES: FoodItem[] = [
  { name: '오트밀죽', name_en: 'oatmeal', phosphorus: 381, category: 'breakfast', image: '/food/오트밀죽.jpg' },
  { name: '메밀소바', name_en: 'soba', phosphorus: 453, category: 'main_dish', image: '/food/메밀소바.jpg' },
  { name: '오트피자', name_en: 'oat_pizza', phosphorus: 380, category: 'main_dish', image: '/food/오트피자.jpg' },
  { name: '기장죽', name_en: 'millet_porridge', phosphorus: 354, category: 'main_dish', image: '/food/기장죽.jpg' },
  { name: '단백질바', name_en: 'protein_bar', phosphorus: 643, category: 'snack', image: '/food/단백질바.jpg' },
  { name: '단백질스무디', name_en: 'protein_smoothie', phosphorus: 643, category: 'beverage', image: '/food/단백질스무디.jpg' },
  { name: '치즈오믈렛', name_en: 'cheese_omelette', phosphorus: 450, category: 'breakfast', image: '/food/치즈오믈렛.jpg' },
  { name: '그릭요거트볼', name_en: 'yogurt_bowl', phosphorus: 320, category: 'breakfast', image: '/food/그릭요거트볼.jpg' },
  { name: '치즈파스타', name_en: 'cheese_pasta', phosphorus: 380, category: 'main_dish', image: '/food/치즈파스타.jpg' },
  { name: '화분요거트', name_en: 'pollen_yogurt', phosphorus: 480, category: 'breakfast', image: '/food/화분요거트.jpg' },
];


// =============================================================================
// 유틸리티 함수
// =============================================================================

export const getPotassiumLevel = (value: number): { label: string; color: string; bgColor: string } => {
  if (value < 150) return { label: '매우 안전', color: '#1B5E20', bgColor: '#C8E6C9' };
  if (value < 250) return { label: '안전', color: '#2E7D32', bgColor: '#E8F5E9' };
  if (value < 400) return { label: '주의', color: '#F57C00', bgColor: '#FFF3E0' };
  return { label: '위험', color: '#C62828', bgColor: '#FFEBEE' };
};

export const getPhosphorusLevel = (value: number): { label: string; color: string; bgColor: string } => {
  if (value < 100) return { label: '매우 안전', color: '#1B5E20', bgColor: '#C8E6C9' };
  if (value < 200) return { label: '안전', color: '#2E7D32', bgColor: '#E8F5E9' };
  if (value < 350) return { label: '주의', color: '#F57C00', bgColor: '#FFF3E0' };
  return { label: '위험', color: '#C62828', bgColor: '#FFEBEE' };
};
