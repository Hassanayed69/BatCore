import { addDays, todayKey, weekDates } from './dates.js';
import { calcTarget, clamp, round } from './calc.js';

const STORAGE_KEY = 'batcore.state.v2';

export const MEALS = [
  { id: 'breakfast', name: 'الفطار', icon: 'sun', time: '6:00 – 11:00' },
  { id: 'lunch', name: 'الغدا', icon: 'food', time: '12:00 – 16:00' },
  { id: 'dinner', name: 'العشا', icon: 'moon', time: '18:00 – 22:00' },
  { id: 'snacks', name: 'سناكس', icon: 'star', time: 'طول اليوم' }
];

const emptyMeals = () => ({ breakfast: [], lunch: [], dinner: [], snacks: [] });

const DEFAULT_STATE = {
  version: 2,
  onboardingDone: false,
  profile: {
    name: '',
    sex: 'male',
    age: 25,
    height: 175,
    weight: 80,
    activity: 'moderate',
    goal: 'cut',
    pace: 'moderate'
  },
  settings: { theme: 'auto' },
  diary: {},
  weights: [],
  customFoods: [],
  favorites: [],
  workouts: {},
  planState: { activePlan: 'ppl-5' },
  study: {
    timetable: [],
    assignments: [],
    exams: [],
    courses: [],
    gpa: { grades: [], target: 4.0 }
  }
};

const clone = (value) => JSON.parse(JSON.stringify(value));

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function merge(base, extra) {
  if (!isObject(extra)) return base;
  Object.keys(extra).forEach((key) => {
    const value = extra[key];
    if (isObject(base[key]) && isObject(value)) merge(base[key], value);
    else if (value !== undefined) base[key] = value;
  });
  return base;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(DEFAULT_STATE);
    const parsed = merge(clone(DEFAULT_STATE), JSON.parse(raw));
    if (!parsed.study) parsed.study = clone(DEFAULT_STATE.study);
    if (!parsed.study.timetable) parsed.study.timetable = [];
    if (!parsed.study.assignments) parsed.study.assignments = [];
    if (!parsed.study.exams) parsed.study.exams = [];
    if (!parsed.study.courses) parsed.study.courses = [];
    if (!parsed.study.gpa) parsed.study.gpa = { grades: [], target: 4.0 };
    return parsed;
  } catch {
    return clone(DEFAULT_STATE);
  }
}

let state = load();
const listeners = new Set();

export function getState() {
  return state;
}

export function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* التخزين ممتلئ أو ممنوع */
  }
}

function emit() {
  listeners.forEach((fn) => {
    try { fn(state); } catch (error) { console.error('BatCORE listener', error); }
  });
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function update(mutator, { silent = false } = {}) {
  const result = mutator(state);
  persist();
  if (!silent) emit();
  return result;
}

export const uid = () => (crypto.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

export function getProfile() {
  return state.profile;
}

export function getTarget() {
  return calcTarget(state.profile);
}

export function saveProfile(profile) {
  update(() => {
    state.profile = { ...state.profile, ...profile };
    state.onboardingDone = true;
  });
}

export function setOnboardingDone() {
  update(() => { state.onboardingDone = true; });
}

export function getDay(date = todayKey()) {
  const day = state.diary[date];
  if (!day) return { meals: emptyMeals(), water: 0 };
  day.meals = { ...emptyMeals(), ...(day.meals || {}) };
  return day;
}

function ensureDay(date) {
  if (!state.diary[date]) state.diary[date] = { meals: emptyMeals(), water: 0 };
  state.diary[date].meals = { ...emptyMeals(), ...state.diary[date].meals };
  return state.diary[date];
}

export function addFood(date, meal, food, qty = 1) {
  return update(() => {
    const day = ensureDay(date);
    const q = Math.max(0.1, Number(qty) || 1);
    const entry = {
      id: uid(),
      foodId: food.id || 'custom',
      name: food.name,
      portion: food.portion || 'حصة',
      qty: q,
      kcal: Math.round((Number(food.kcal) || 0) * q),
      p: round((Number(food.p) || 0) * q, 1),
      c: round((Number(food.c) || 0) * q, 1),
      f: round((Number(food.f) || 0) * q, 1),
      meal,
      addedAt: Date.now()
    };
    const target = day.meals[meal] ? day.meals[meal] : day.meals.snacks;
    target.push(entry);
    return entry;
  });
}

export function removeFood(date, meal, id) {
  update(() => {
    const day = ensureDay(date);
    day.meals[meal] = (day.meals[meal] || []).filter((entry) => entry.id !== id);
  });
}

export function repeatEntry(date, meal, entry) {
  update(() => {
    const day = ensureDay(date);
    day.meals[meal].push({ ...entry, id: uid(), addedAt: Date.now() });
  });
}

export function copyDayFoods(from, to) {
  update(() => {
    const source = state.diary[from];
    if (!source) return;
    const target = ensureDay(to);
    MEALS.forEach((meal) => {
      const entries = source.meals?.[meal.id] || [];
      entries.forEach((entry) => {
        target.meals[meal.id].push({ ...entry, id: uid(), addedAt: Date.now() });
      });
    });
  });
}

export function allEntries(date) {
  const day = getDay(date);
  return MEALS.flatMap((meal) => day.meals[meal.id] || []);
}

export function totalsFor(date) {
  return allEntries(date).reduce((total, entry) => ({
    kcal: total.kcal + (Number(entry.kcal) || 0),
    p: total.p + (Number(entry.p) || 0),
    c: total.c + (Number(entry.c) || 0),
    f: total.f + (Number(entry.f) || 0)
  }), { kcal: 0, p: 0, c: 0, f: 0 });
}

export function mealTotals(date, meal) {
  const day = getDay(date);
  return (day.meals[meal] || []).reduce((total, entry) => ({
    kcal: total.kcal + (Number(entry.kcal) || 0),
    p: total.p + (Number(entry.p) || 0),
    c: total.c + (Number(entry.c) || 0),
    f: total.f + (Number(entry.f) || 0)
  }), { kcal: 0, p: 0, c: 0, f: 0 });
}

export function setWater(date, ml) {
  update(() => {
    const day = ensureDay(date);
    day.water = clamp(Math.round(Number(ml) || 0), 0, 12000);
  });
}

export function getWater(date) {
  return getDay(date).water || 0;
}

export function getWeights() {
  return [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
}

export function addWeight(kg, date = todayKey()) {
  const weight = round(Number(kg), 1);
  if (!Number.isFinite(weight) || weight < 30 || weight > 300) throw new Error('وزن غير صالح');
  update(() => {
    const existing = state.weights.find((item) => item.date === date);
    if (existing) existing.kg = weight;
    else state.weights.push({ date, kg: weight });
    state.weights.sort((a, b) => a.date.localeCompare(b.date));
    const latest = state.weights[state.weights.length - 1];
    if (latest) state.profile.weight = latest.kg;
  });
}

export function deleteWeight(date) {
  update(() => {
    state.weights = state.weights.filter((item) => item.date !== date);
    const latest = state.weights[state.weights.length - 1];
    if (latest) state.profile.weight = latest.kg;
  });
}

export function latestWeight() {
  const list = getWeights();
  return list.length ? list[list.length - 1] : { date: todayKey(), kg: state.profile.weight };
}

export function weightChange(days = 30) {
  const from = addDays(todayKey(), -days);
  const list = getWeights().filter((item) => item.date >= from);
  if (list.length < 2) return { delta: 0, first: list[0] || null, last: list[list.length - 1] || null, count: list.length };
  return {
    delta: round(list[list.length - 1].kg - list[0].kg, 1),
    first: list[0],
    last: list[list.length - 1],
    count: list.length
  };
}

export function toggleFavorite(foodId) {
  update(() => {
    if (state.favorites.includes(foodId)) state.favorites = state.favorites.filter((id) => id !== foodId);
    else state.favorites.push(foodId);
  });
}

export function addCustomFood(food) {
  const entry = {
    id: `custom-${uid()}`,
    name: String(food.name || '').trim(),
    portion: String(food.portion || 'حصة').trim(),
    kcal: Math.max(0, Math.round(Number(food.kcal) || 0)),
    p: Math.max(0, round(Number(food.p) || 0, 1)),
    c: Math.max(0, round(Number(food.c) || 0, 1)),
    f: Math.max(0, round(Number(food.f) || 0, 1)),
    cat: 'أكلاتي',
    custom: true
  };
  if (!entry.name) throw new Error('اكتب اسم الأكلة');
  update(() => { state.customFoods.push(entry); });
  return entry;
}

export function setActivePlan(planId) {
  update(() => { state.planState.activePlan = planId; });
}

export function getSession(date) {
  return state.workouts[date] || null;
}

export function ensureSession(date, planId, dayIndex) {
  if (!state.workouts[date]) {
    state.workouts[date] = { planId, dayIndex, logs: {}, custom: [], completed: false };
  } else {
    state.workouts[date].planId = planId;
    state.workouts[date].dayIndex = dayIndex;
  }
  persist();
  return state.workouts[date];
}

/**
 * بيحدد تمرين اليوم باختيار المستخدم (يوم من الخطة أو -1 لتمرين حر).
 * تغيير اليوم بيمسح المجاميع القديمة عشان متتداخلش مع تمارين اليوم الجديد.
 */
export function setSessionDay(date, planId, dayIndex) {
  return update(() => {
    const index = Number.isInteger(Number(dayIndex)) ? Number(dayIndex) : -1;
    const existing = state.workouts[date];
    const same = existing && existing.planId === planId && Number(existing.dayIndex) === index;
    if (same) {
      existing.dayPicked = true;
      return existing;
    }
    state.workouts[date] = {
      planId,
      dayIndex: index,
      dayPicked: true,
      logs: {},
      custom: [],
      completed: false,
      startedAt: Date.now()
    };
    return state.workouts[date];
  });
}

export function ensureLog(date, planId, dayIndex, key, totalSets) {
  const session = ensureSession(date, planId, dayIndex);
  if (!session.logs[key]) {
    session.logs[key] = Array.from({ length: totalSets }, () => ({ w: '', r: '', done: false }));
  }
  while (session.logs[key].length < totalSets) session.logs[key].push({ w: '', r: '', done: false });
  session.logs[key] = session.logs[key].slice(0, totalSets);
  persist();
  return session.logs[key];
}

export function setSetLog(date, planId, dayIndex, key, setIndex, patch, totalSets) {
  const logs = ensureLog(date, planId, dayIndex, key, totalSets);
  logs[setIndex] = { ...logs[setIndex], ...patch };
  persist();
  return logs[setIndex];
}

export function setWorkoutDone(date, done) {
  update(() => {
    if (state.workouts[date]) {
      state.workouts[date].completed = done;
      state.workouts[date].completedAt = done ? Date.now() : null;
    }
  });
}

export function addCustomExercise(date, planId, dayIndex, exercise) {
  update(() => {
    const session = ensureSession(date, planId, dayIndex);
    session.custom = session.custom || [];
    const en = String(exercise.en || '').trim();
    const name = String(exercise.name || '').trim() || en;
    if (!en && !name) throw new Error('اكتب اسم التمرين');
    session.custom.push({
      id: uid(),
      name,
      en,
      sets: clamp(Number(exercise.sets) || 3, 1, 8),
      reps: String(exercise.reps || '8-12').trim() || '8-12',
      rest: 60
    });
  });
}

export function removeCustomExercise(date, id) {
  update(() => {
    const session = state.workouts[date];
    if (!session) return;
    session.custom = (session.custom || []).filter((item) => item.id !== id);
    delete session.logs[`custom:${id}`];
  });
}

export function deleteWorkout(date) {
  update(() => { delete state.workouts[date]; });
}

function hasActivity(date) {
  const day = state.diary[date];
  const food = day && MEALS.some((meal) => (day.meals?.[meal.id] || []).length);
  const water = (day?.water || 0) > 0;
  const workout = state.workouts[date];
  return Boolean(food || water || workout?.completed);
}

export function currentStreak() {
  let cursor = hasActivity(todayKey()) ? todayKey() : addDays(todayKey(), -1);
  let count = 0;
  while (hasActivity(cursor) && count < 3650) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export function loggedDays(count = 30, end = todayKey()) {
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(end, i - count + 1);
    const totals = totalsFor(date);
    return { date, ...totals, hasFood: allEntries(date).length > 0 };
  });
}

export function workoutsInWeek(date = todayKey()) {
  return weekDates(date)
    .map((key) => ({ date: key, session: state.workouts[key] }))
    .filter((item) => item.session?.completed);
}

export function workoutCount() {
  return Object.values(state.workouts).filter((session) => session?.completed).length;
}

export function getSettings() {
  return state.settings;
}

export function setTheme(theme) {
  update(() => { state.settings.theme = theme; });
}

export function exportJSON() {
  return JSON.stringify(state, null, 2);
}

export function importJSON(text) {
  const data = JSON.parse(text);
  if (!isObject(data) || !isObject(data.profile)) throw new Error('ملف غير صالح');
  state = merge(clone(DEFAULT_STATE), data);
  state.onboardingDone = true;
  persist();
  emit();
}

export function resetAll() {
  state = clone(DEFAULT_STATE);
  persist();
  emit();
}
