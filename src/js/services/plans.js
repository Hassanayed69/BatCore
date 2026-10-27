import { addDays, weekIndex } from '../core/dates.js';
import { getState } from '../core/store.js';

let plans = [];

export async function loadPlans() {
  const response = await fetch('src/data/plans.json');
  if (!response.ok) throw new Error('تعذر تحميل جداول التمرين');
  const data = await response.json();
  plans = Array.isArray(data.plans) ? data.plans : [];
  return plans;
}

export function getPlans() {
  return plans;
}

export function getPlan(id = getState().planState.activePlan) {
  return plans.find((plan) => plan.id === id) || plans[0] || null;
}

export function dayForDate(plan, date) {
  if (!plan) return { index: -1, day: null };
  const index = plan.schedule?.[weekIndex(date)] ?? -1;
  return { index, day: index >= 0 ? plan.days[index] : null };
}

export function nextTrainingDay(plan, fromDate) {
  if (!plan) return null;
  for (let offset = 1; offset <= 7; offset += 1) {
    const key = addDays(fromDate, offset);
    const { index, day } = dayForDate(plan, key);
    if (day) return { offset, index, day };
  }
  return null;
}
