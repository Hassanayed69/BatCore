import { getState } from '../core/store.js';

let foods = [];

export const CATEGORIES = ['الكل', 'مصري', 'بروتين', 'كارب', 'خضار وفاكهة', 'ألبان', 'سناكس', 'فطار', 'أكلاتي'];

const normalize = (value) => String(value || '')
  .toLowerCase()
  .replace(/[\u064B-\u0652\u0640]/g, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/[^\w\u0600-\u06FF\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export async function loadFoods() {
  const response = await fetch('src/data/foods.json');
  if (!response.ok) throw new Error('تعذر تحميل قاعدة الأكل');
  const data = await response.json();
  foods = Array.isArray(data.foods) ? data.foods : [];
  return foods;
}

export function allFoods() {
  return [...foods, ...(getState().customFoods || [])];
}

export function getFoodById(id) {
  return allFoods().find((food) => food.id === id) || null;
}

export function searchFoods(query = '', category = 'الكل', limit = 40) {
  const terms = normalize(query).split(' ').filter(Boolean);
  let list = allFoods();
  if (category && category !== 'الكل') list = list.filter((food) => food.cat === category);

  if (!terms.length) return list.slice(0, limit);

  return list
    .map((food) => {
      const name = normalize(food.name);
      const alias = normalize(food.alias);
      const en = normalize(food.en);
      const haystack = `${name} ${alias} ${en}`;
      if (!terms.every((term) => haystack.includes(term))) return null;
      let score = 3;
      if (name === normalize(query)) score = 0;
      else if (name.startsWith(normalize(query))) score = 1;
      else if (name.includes(normalize(query))) score = 2;
      else if (alias.includes(normalize(query))) score = 3;
      return { food, score };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score || a.food.name.length - b.food.name.length)
    .slice(0, limit)
    .map((item) => item.food);
}

export function favoriteFoods() {
  const ids = getState().favorites || [];
  return ids.map((id) => getFoodById(id)).filter(Boolean);
}

export function recentFoods(limit = 10) {
  const state = getState();
  const dates = Object.keys(state.diary).sort().reverse();
  const seen = new Set();
  const result = [];
  for (const date of dates) {
    const meals = state.diary[date]?.meals || {};
    for (const meal of ['snacks', 'dinner', 'lunch', 'breakfast']) {
      for (const entry of [...(meals[meal] || [])].reverse()) {
        if (!entry.foodId || seen.has(entry.foodId)) continue;
        const food = getFoodById(entry.foodId);
        if (!food) continue;
        seen.add(entry.foodId);
        result.push(food);
        if (result.length >= limit) return result;
      }
    }
  }
  return result;
}

export async function fetchByBarcode(code) {
  const value = String(code || '').trim();
  if (!/^\d{8,14}$/.test(value)) throw new Error('الباركود لازم يكون من 8 لـ 14 رقم');
  const fields = 'product_name,product_name_ar,brands,nutriments,serving_size,image_front_small_url';
  const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${value}.json?fields=${fields}`);
  if (!response.ok) throw new Error('تعذر الاتصال بقاعدة البيانات. جرّب تكتب الرقم يدوي.');
  const data = await response.json();
  if (data.status !== 1 || !data.product) return null;
  const product = data.product;
  const nutriments = product.nutriments || {};
  const kcal = Number(nutriments['energy-kcal_100g']) || Math.round((Number(nutriments.energy_100g) || 0) / 4.184);
  const name = product.product_name_ar || product.product_name || 'منتج بدون اسم';
  return {
    id: `barcode-${value}`,
    barcode: value,
    name,
    en: product.brands || '',
    portion: '100 جم',
    grams: 100,
    kcal: Math.round(kcal),
    p: Number((Number(nutriments.proteins_100g) || 0).toFixed(1)),
    c: Number((Number(nutriments.carbohydrates_100g) || 0).toFixed(1)),
    f: Number((Number(nutriments.fat_100g) || 0).toFixed(1)),
    cat: 'باركود',
    image: product.image_front_small_url || ''
  };
}
