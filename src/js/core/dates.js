const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const AR_DAYS_SHORT = ['حد', 'اتنين', 'تلات', 'أربع', 'خميس', 'جمعة', 'سبت'];
const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5]; // السبت أول الأسبوع

export function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseKey(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(key, amount) {
  const d = parseKey(key);
  d.setDate(d.getDate() + amount);
  return dateKey(d);
}

export function todayKey() {
  return dateKey();
}

export function weekIndex(dateOrKey) {
  const d = typeof dateOrKey === 'string' ? parseKey(dateOrKey) : dateOrKey;
  return (d.getDay() + 1) % 7; // السبت = 0 ... الجمعة = 6
}

export function weekDates(key) {
  return Array.from({ length: 7 }, (_, i) => addDays(key, i - weekIndex(key)));
}

export function startOfWeek(key) {
  return addDays(key, -weekIndex(key));
}

export function dayName(dateOrKey, short = false) {
  const d = typeof dateOrKey === 'string' ? parseKey(dateOrKey) : dateOrKey;
  return (short ? AR_DAYS_SHORT : AR_DAYS)[d.getDay()];
}

export function dayNumber(key) {
  return parseKey(key).getDate();
}

export function monthName(key) {
  return AR_MONTHS[parseKey(key).getMonth()];
}

export function shortDate(key) {
  return `${dayNumber(key)} ${monthName(key)}`;
}

export function longDate(key) {
  return `${dayName(key)} ${dayNumber(key)} ${monthName(key)}`;
}

export function isToday(key) {
  return key === todayKey();
}

export function isFuture(key) {
  return key > todayKey();
}

export function isPast(key) {
  return key < todayKey();
}

export function relativeDay(key) {
  if (isToday(key)) return 'النهارده';
  if (key === addDays(todayKey(), -1)) return 'امبارح';
  if (key === addDays(todayKey(), 1)) return 'بكرة';
  return longDate(key);
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'سهران لسه؟';
  if (h < 12) return 'صباح الخير';
  if (h < 17) return 'نهارك سعيد';
  if (h < 21) return 'مساء الخير';
  return 'مساء الخير';
}

export function minutesLabel(minutes) {
  if (!minutes) return '—';
  if (minutes < 60) return `${minutes} دقيقة`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} ساعة و${m} دقيقة` : `${h} ساعة`;
}

export function lastDays(count, endKey = todayKey()) {
  return Array.from({ length: count }, (_, i) => addDays(endKey, i - count + 1));
}
