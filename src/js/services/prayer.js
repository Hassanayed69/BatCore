import { todayKey } from '../core/dates.js';

const STORAGE_KEY = 'batcore.prayer.v1';
const PRAYERS = [
  { id: 'fajr', name: 'الفجر', en: 'Fajr' },
  { id: 'sunrise', name: 'الشروق', en: 'Sunrise' },
  { id: 'dhuhr', name: 'الظهر', en: 'Dhuhr' },
  { id: 'asr', name: 'العصر', en: 'Asr' },
  { id: 'maghrib', name: 'المغرب', en: 'Maghrib' },
  { id: 'isha', name: 'العشاء', en: 'Isha' }
];

const OBLIGATORY = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

function emptyDay() {
  return { fajr: false, dhuhr: false, asr: false, maghrib: false, isha: false };
}

function defaultState() {
  return {
    location: { lat: 30.0444, lng: 31.2357, city: 'القاهرة' },
    times: {},
    log: {},
    streak: { count: 0, lastComplete: null },
    adhkar: { morning: {}, evening: {} }
  };
}

function clone(v) { return JSON.parse(JSON.stringify(v)); }

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}

let state = load();
const listeners = new Set();

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

export function getPrayerState() { return state; }
export function getPrayers() { return PRAYERS; }
export function getObligatory() { return OBLIGATORY; }
export function onPrayerChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach((fn) => fn(state)); }

export function setLocation(loc) {
  state.location = { ...state.location, ...loc };
  persist();
  emit();
}

export function getTodayLog(date = todayKey()) {
  if (!state.log[date]) state.log[date] = emptyDay();
  return state.log[date];
}

export function markPrayer(prayer, date = todayKey(), done = true) {
  if (!OBLIGATORY.includes(prayer)) return getTodayLog(date);
  if (!state.log[date]) state.log[date] = emptyDay();
  const wasDone = state.log[date][prayer];
  state.log[date][prayer] = Boolean(done);
  if (done && !wasDone) updateStreak(date);
  persist();
  emit();
  return state.log[date];
}

function updateStreak(date) {
  const log = getTodayLog(date);
  const allDone = OBLIGATORY.every((p) => log[p]);
  if (allDone && state.streak.lastComplete !== date) {
    const yesterday = addDay(date, -1);
    if (state.streak.lastComplete === yesterday) {
      state.streak.count += 1;
    } else {
      state.streak.count = 1;
    }
    state.streak.lastComplete = date;
    persist();
  }
}

function addDay(key, days) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function getStreak() { return state.streak; }
export function getTodayCount(date = todayKey()) {
  const log = getTodayLog(date);
  return OBLIGATORY.filter((p) => log[p]).length;
}

export function setPrayerTimes(date = todayKey(), times) {
  state.times[date] = times;
  persist();
  emit();
}

export function getPrayerTimes(date = todayKey()) { return state.times[date] || null; }

// Accurate-ish calculation using standard method
function toRadians(deg) { return deg * Math.PI / 180; }
function toDegrees(rad) { return rad * 180 / Math.PI; }

function julianDay(date) {
  const a = Math.floor((14 - (date.getMonth() + 1)) / 12);
  const y = date.getFullYear() + 4800 - a;
  const m = (date.getMonth() + 1) + 12 * a - 3;
  return date.getDate() + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

function sunPosition(jd) {
  const D = jd - 2451545.0;
  const g = toRadians((357.529 + 0.98560028 * D) % 360);
  const q = (280.459 + 0.98564736 * D) % 360;
  let L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) % 360;
  const e = toRadians(23.439 - 0.00000036 * D);
  const RA = toDegrees(Math.atan2(Math.cos(e) * Math.sin(toRadians(L)), Math.cos(toRadians(L)) / 1)) / 15;
  const d = toDegrees(Math.asin(Math.sin(e) * Math.sin(toRadians(L))));
  return { declination: d, equation: q / 15 - ((RA < 0) ? RA + 24 : RA) };
}

export function calculatePrayerTimes(lat, lng, date = new Date(), method = 'egypt') {
  const jd = julianDay(date);
  const { declination, equation } = sunPosition(jd);
  const timezone = -date.getTimezoneOffset() / 60;
  
  // Egypt method approximations
  const fajrAngle = -19.5;
  const ishaAngle = -17.5;
  const asrFactor = 1;
  
  function computeTime(angle) {
    const ha = Math.acos((Math.sin(toRadians(angle)) - Math.sin(toRadians(lat)) * Math.sin(toRadians(declination))) / (Math.cos(toRadians(lat)) * Math.cos(toRadians(declination))));
    return toDegrees(ha) / 15;
  }
  
  const dhuhr = 12 + timezone - lng / 15 - equation;
  const sunriseHa = computeTime(-0.833);
  const fajrHa = computeTime(fajrAngle);
  const asrHa = Math.acos((Math.sin(toRadians(Math.atan(1 / (asrFactor + Math.tan(Math.abs(toRadians(lat) - toRadians(declination))))))) - Math.sin(toRadians(lat)) * Math.sin(toRadians(declination))) / (Math.cos(toRadians(lat)) * Math.cos(toRadians(declination))));
  const maghribHa = sunriseHa;
  const ishaHa = computeTime(ishaAngle);
  
  function toTime(hours) {
    let h = hours;
    if (h < 0) h += 24;
    if (h >= 24) h -= 24;
    const totalMins = h * 60;
    const hour = Math.floor(totalMins / 60) % 24;
    const mins = Math.round(totalMins % 60);
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, mins);
    return result;
  }
  
  return {
    fajr: toTime(dhuhr - fajrHa),
    sunrise: toTime(dhuhr - sunriseHa),
    dhuhr: toTime(dhuhr),
    asr: toTime(dhuhr + toDegrees(asrHa) / 15),
    maghrib: toTime(dhuhr + maghribHa),
    isha: toTime(dhuhr + ishaHa)
  };
}

export function formatTime(date) {
  if (!date) return '--:--';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function timeUntil(date) {
  if (!date) return { hours: 0, mins: 0, total: 0, done: true };
  const now = Date.now();
  const target = date instanceof Date ? date.getTime() : new Date(date).getTime();
  const diff = Math.max(0, target - now);
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return { hours, mins, total: diff, done: diff === 0 };
}

export function getNextPrayer(times, log = getTodayLog()) {
  const now = new Date();
  for (const p of OBLIGATORY) {
    const t = times[p];
    if (t) {
      const td = t instanceof Date ? t : new Date(t);
      if (td > now && !log[p]) {
        return { prayer: PRAYERS.find(pr => pr.id === p), time: td };
      }
    }
  }
  return null;
}

function isFriday(date = new Date()) {
  return date.getDay() === 5;
}
