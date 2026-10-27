import {
  currentStreak,
  getState,
  getTarget,
  getWeights,
  loggedDays,
  weightChange,
  workoutCount,
  workoutsInWeek
} from '../core/store.js';
import { dayName, lastDays, shortDate, todayKey } from '../core/dates.js';
import { fmt } from '../core/calc.js';
import { getPlans, getPlan } from '../services/plans.js';
import { sessionStats } from '../core/workout.js';
import { barChart, lineChart } from './charts.js';
import { esc, icon, progress } from './dom.js';

function statCard({ iconName, label, value, unit, sub, tone = '' }) {
  return `<article class="card stat-card ${tone}">
    <span class="stat-icon">${icon(iconName)}</span>
    <span class="stat-label">${esc(label)}</span>
    <strong class="stat-value">${value}${unit ? `<small>${esc(unit)}</small>` : ''}</strong>
    <span class="stat-sub">${sub}</span>
  </article>`;
}

function weightSection() {
  const weights = getWeights();
  const change = weightChange(30);
  const data = weights.slice(-30).map((item) => ({
    label: shortDate(item.date),
    short: shortDate(item.date),
    value: item.kg
  }));
  const tone = change.delta < 0 ? 'down' : change.delta > 0 ? 'up' : '';
  return `<article class="card chart-panel">
    <header class="card-head">
      <div><p class="eyebrow">متابعة الوزن</p><h3>تطور الوزن</h3></div>
      <button class="btn btn-soft btn-sm" type="button" data-open-weight>${icon('plus')} سجّل وزن</button>
    </header>
    ${data.length
      ? lineChart({ data, unit: 'كجم' })
      : `<div class="chart-empty"><span>${icon('scale')}</span><strong>ابدأ بمتابعة وزنك</strong><p>سجّل وزنك مرة كل أسبوع في نفس الوقت.</p><button class="btn btn-soft btn-sm" type="button" data-open-weight>${icon('plus')} أول قياس</button></div>`}
    <div class="chart-foot">
      <div><span>آخر وزن</span><strong>${weights.length ? weights[weights.length - 1].kg : getState().profile.weight}</strong><small>كجم</small></div>
      <div><span>التغيير</span><strong class="${tone}">${change.count > 1 ? `${change.delta > 0 ? '+' : ''}${change.delta}` : '—'}</strong><small>كجم / 30 يوم</small></div>
      <div><span>عدد القياسات</span><strong>${weights.length}</strong><small>قياس</small></div>
    </div>
  </article>`;
}

function calorieSection(target) {
  const days = lastDays(14);
  const history = loggedDays(14);
  const data = days.map((date) => ({
    label: shortDate(date),
    short: dayName(date, true),
    value: history.find((item) => item.date === date)?.kcal || 0,
    active: date === todayKey()
  }));
  const logged = data.filter((item) => item.value > 0);
  const average = logged.length ? Math.round(logged.reduce((sum, item) => sum + item.value, 0) / logged.length) : 0;
  const within = logged.filter((item) => Math.abs(item.value - target.kcal) <= target.kcal * 0.1).length;
  return `<article class="card chart-panel">
    <header class="card-head">
      <div><p class="eyebrow">آخر 14 يوم</p><h3>السعرات اليومية</h3></div>
      <span class="badge badge-muted">${icon('target')} ${target.kcal} هدف</span>
    </header>
    ${barChart({ data, target: target.kcal, unit: 'سعرة' })}
    <div class="chart-foot">
      <div><span>متوسط السعرات</span><strong>${average ? fmt(average) : '—'}</strong><small>سعرة/يوم</small></div>
      <div><span>أيام مسجلة</span><strong>${logged.length}</strong><small>من 14</small></div>
      <div><span>على الهدف</span><strong>${within}</strong><small>يوم ±10%</small></div>
    </div>
  </article>`;
}

function achievements() {
  const state = getState();
  const target = getTarget();
  const weights = getWeights();
  const diaryDates = Object.keys(state.diary);
  const foodDays = diaryDates.filter((date) => {
    const meals = state.diary[date]?.meals || {};
    return ['breakfast', 'lunch', 'dinner', 'snacks'].some((meal) => (meals[meal] || []).length);
  }).length;
  const onTargetDays = diaryDates.filter((date) => {
    const meals = state.diary[date]?.meals || {};
    const calories = ['breakfast', 'lunch', 'dinner', 'snacks'].reduce((total, meal) => (
      total + (meals[meal] || []).reduce((sum, entry) => sum + (Number(entry.kcal) || 0), 0)
    ), 0);
    return calories > 0 && Math.abs(calories - target.kcal) <= target.kcal * 0.1;
  }).length;
  const workouts = workoutCount();
  const streak = currentStreak();

  const list = [
    { iconName: 'bolt', title: 'أول خطوة', desc: 'سجّل أول وجبة', value: foodDays, goal: 1 },
    { iconName: 'calendar', title: '7 أيام متابعة', desc: '7 أيام من تسجيل الأكل', value: foodDays, goal: 7 },
    { iconName: 'dumbbell', title: '10 تمارين', desc: 'أنهيت 10 تمارين', value: workouts, goal: 10 },
    { iconName: 'flame', title: 'سلسلة 7 أيام', desc: '7 أيام متابعة متتالية', value: streak, goal: 7 },
    { iconName: 'scale', title: '5 قياسات وزن', desc: 'سجّل وزنك بانتظام', value: weights.length, goal: 5 },
    { iconName: 'target', title: 'أسبوع على الهدف', desc: '5 أيام داخل 10% من هدفك', value: onTargetDays, goal: 5 }
  ];

  return `<article class="card achievements">
    <header class="card-head"><div><p class="eyebrow">إنجازاتك</p><h3>كمّل وافتح الجاي</h3></div><span class="badge badge-accent">${list.filter((item) => item.value >= item.goal).length} / ${list.length}</span></header>
    <div class="achievement-grid">
      ${list.map((item) => {
        const unlocked = item.value >= item.goal;
        return `<div class="achievement${unlocked ? ' is-unlocked' : ''}">
          <span class="achievement-icon">${icon(unlocked ? 'trophy' : item.iconName)}</span>
          <div class="achievement-text"><strong>${item.title}</strong><small>${item.desc}</small></div>
          ${unlocked ? `<span class="achievement-check">${icon('check')}</span>` : `<span class="achievement-count">${Math.min(item.value, item.goal)}/${item.goal}</span>`}
          ${unlocked ? '' : progress(item.value, item.goal)}
        </div>`;
      }).join('')}
    </div>
  </article>`;
}

function workoutHistory() {
  const state = getState();
  const plans = getPlans();
  const sessions = Object.entries(state.workouts)
    .filter(([, session]) => session?.completed)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 6);
  return `<article class="card history-card">
    <header class="card-head"><div><p class="eyebrow">السجل</p><h3>آخر التمارين</h3></div><button class="link-btn" type="button" data-nav="train">افتح الخطة ${icon('chevron-left')}</button></header>
    ${sessions.length ? `<div class="history-list">
      ${sessions.map(([date, session]) => {
        const plan = plans.find((item) => item.id === session.planId);
        const day = plan?.days?.[session.dayIndex];
        const stats = sessionStats(session, day);
        return `<button type="button" class="history-row" data-nav="train">
          <span class="history-date"><strong>${date.split('-')[2]}</strong><small>${shortDate(date).split(' ')[1]}</small></span>
          <span class="history-main"><strong>${esc(day?.label || 'تمرين')}</strong><small>${esc(plan?.name || '')} · ${stats.doneSets} مجموعة</small></span>
          <span class="history-check">${icon('check')}</span>
        </button>`;
      }).join('')}
    </div>` : `<div class="chart-empty"><span>${icon('dumbbell')}</span><strong>مفيش تمارين مكتملة لسه</strong><p>ابدأ أول تمرين من خطتك.</p><button class="btn btn-soft btn-sm" type="button" data-nav="train">${icon('play')} افتح التمرين</button></div>`}
  </article>`;
}

export function renderProgress() {
  const root = document.getElementById('view-progress');
  if (!root) return;
  const state = getState();
  const target = getTarget();
  const plan = getPlan();
  const weights = getWeights();
  const change = weightChange(30);
  const last14 = loggedDays(14);
  const logged = last14.filter((item) => item.kcal > 0);
  const average = logged.length ? Math.round(logged.reduce((sum, item) => sum + item.kcal, 0) / logged.length) : 0;
  const weekWorkouts = workoutsInWeek(todayKey()).length;
  const streak = currentStreak();
  const weightTone = change.delta < 0 ? 'down' : change.delta > 0 ? 'up' : '';

  root.innerHTML = `<div class="progress-page">
    <header class="page-head">
      <div><p class="eyebrow">أرقامك بتحكي</p><h2>التقدم</h2></div>
      <span class="badge badge-accent">${icon('chart')} آخر 30 يوم</span>
    </header>

    <div class="stats-grid">
      ${statCard({
        iconName: 'scale',
        label: 'وزنك الحالي',
        value: weights.length ? weights[weights.length - 1].kg : state.profile.weight,
        unit: 'كجم',
        sub: change.count > 1 ? `<span class="${weightTone}">${change.delta > 0 ? '+' : ''}${change.delta} كجم</span> في 30 يوم` : 'سجّل وزنك للمتابعة'
      })}
      ${statCard({
        iconName: 'flame',
        label: 'متوسط السعرات',
        value: average ? fmt(average) : '—',
        unit: 'سعرة',
        sub: logged.length ? (logged.length === 1 ? 'آخر يوم مسجل' : logged.length === 2 ? 'آخر يومين مسجلين' : `آخر ${logged.length} يوم مسجل`) : 'لسه مفيش تسجيل'
      })}
      ${statCard({
        iconName: 'dumbbell',
        label: 'تمارين الأسبوع',
        value: weekWorkouts,
        unit: plan ? `من ${plan.daysPerWeek}` : '',
        sub: weekWorkouts ? 'كمّل بنفس الالتزام' : 'ابدأ أول تمرين'
      })}
      ${statCard({
        iconName: 'flame',
        label: 'سلسلة المتابعة',
        value: streak,
        unit: 'يوم',
        sub: streak >= 7 ? 'سلسلة قوية جداً 🔥' : 'الاستمرارية هي السر'
      })}
    </div>

    <div class="progress-charts">
      ${weightSection()}
      ${calorieSection(target)}
    </div>

    ${achievements()}
    ${workoutHistory()}

    <p class="fine-print">${icon('info')} التغيير الحقيقي محتاج وقت. راقب الاتجاه على 3–4 أسابيع، مش رقم يوم واحد.</p>
  </div>`;
}
