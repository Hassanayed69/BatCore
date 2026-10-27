export const ACTIVITIES = {
  sedentary: { label: 'قليل الحركة', hint: 'شغل مكتبي أغلب اليوم', factor: 1.2 },
  light: { label: 'نشاط خفيف', hint: 'تمرين 1–3 أيام أسبوعياً', factor: 1.375 },
  moderate: { label: 'نشاط متوسط', hint: 'تمرين 3–5 أيام أسبوعياً', factor: 1.55 },
  high: { label: 'نشاط عالي', hint: 'تمرين 6–7 أيام أسبوعياً', factor: 1.725 },
  athlete: { label: 'رياضي', hint: 'مجهود بدني عالي شبه يومي', factor: 1.9 }
};

export const GOALS = {
  cut: { label: 'تنشيف', hint: 'نقص تدريجي في الدهون' },
  maintain: { label: 'ثبات', hint: 'الحفاظ على الوزن الحالي' },
  bulk: { label: 'بناء', hint: 'زيادة عضلية بتحكم' }
};

export const PACES = {
  slow: { label: 'هادية', kg: 0.25, delta: 250 },
  moderate: { label: 'متوسطة', kg: 0.5, delta: 500 },
  aggressive: { label: 'سريعة', kg: 0.75, delta: 750 }
};

export function calcTarget(profile = {}) {
  const sex = profile.sex === 'female' ? 'female' : 'male';
  const weight = Number(profile.weight) || 80;
  const height = Number(profile.height) || 175;
  const age = Number(profile.age) || 25;
  const activity = ACTIVITIES[profile.activity] ? profile.activity : 'moderate';
  const goal = GOALS[profile.goal] ? profile.goal : 'maintain';
  const pace = PACES[profile.pace] ? profile.pace : 'moderate';

  const bmr = 10 * weight + 6.25 * height - 5 * age + (sex === 'male' ? 5 : -161);
  const tdee = bmr * ACTIVITIES[activity].factor;
  const paceDelta = PACES[pace].delta;
  const delta = goal === 'cut' ? -paceDelta : goal === 'bulk' ? Math.round(paceDelta * 0.6) : 0;
  const floor = sex === 'female' ? 1200 : 1500;
  const kcal = Math.max(floor, Math.round((tdee + delta) / 10) * 10);

  const proteinPerKg = goal === 'cut' ? 2.2 : goal === 'bulk' ? 2 : 1.8;
  const protein = Math.round(weight * proteinPerKg);
  const fat = Math.max(Math.round(weight * 0.6), Math.round((kcal * 0.27) / 9));
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));

  return {
    kcal,
    protein,
    carbs,
    fat,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    delta: kcal - Math.round(tdee),
    water: Math.max(1500, Math.round((weight * 35) / 250) * 250),
    proteinPerKg,
    goal,
    activity,
    pace
  };
}

export function macroCalories(target) {
  return {
    p: target.protein * 4,
    c: target.carbs * 4,
    f: target.fat * 9
  };
}

export function macroPercents(target) {
  const cal = macroCalories(target);
  const total = cal.p + cal.c + cal.f || 1;
  return {
    p: Math.round((cal.p / total) * 100),
    c: Math.round((cal.c / total) * 100),
    f: Math.round((cal.f / total) * 100)
  };
}

export function bmiInfo(weight, heightCm) {
  const h = (Number(heightCm) || 175) / 100;
  const value = (Number(weight) || 80) / (h * h);
  let label = 'وزن صحي';
  let tone = 'good';
  if (value < 18.5) { label = 'نقص في الوزن'; tone = 'warn'; }
  else if (value < 25) { label = 'وزن صحي'; tone = 'good'; }
  else if (value < 30) { label = 'زيادة في الوزن'; tone = 'warn'; }
  else { label = 'سمنة'; tone = 'bad'; }
  return { value: Math.round(value * 10) / 10, label, tone };
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function round(value, digits = 0) {
  const p = 10 ** digits;
  return Math.round(Number(value) * p) / p;
}

export function fmt(value, digits = 0) {
  if (!Number.isFinite(Number(value))) return '0';
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: digits });
}
