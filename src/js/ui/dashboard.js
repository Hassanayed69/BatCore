import {
  currentStreak,
  getDay,
  getSession,
  getState,
  getTarget,
  getWater,
  latestWeight,
  setWater,
  totalsFor,
  weightChange
} from '../core/store.js';
import { ACTIVITIES, GOALS, fmt } from '../core/calc.js';
import {
  dayName,
  lastDays,
  relativeDay,
  shortDate,
  todayKey
} from '../core/dates.js';
import { getPlan, dayForDate } from '../services/plans.js';
import { sessionStats } from '../core/workout.js';
import { barChart, sparkline } from './charts.js';
import { esc, icon, pct, progress, ringStyle } from './dom.js';

const $ = (selector, root = document) => root.querySelector(selector);

function macroRow(label, value, target, tone) {
  return `<div class="macro-row">
    <div class="macro-row-head"><span>${label}</span><strong>${Math.round(value)} <small>/ ${target} جم</small></strong></div>
    ${progress(value, target, `progress-${tone}`, label)}
  </div>`;
}

function calorieCard(target, totals, profile) {
  const left = Math.round(target.kcal - totals.kcal);
  const over = left < 0;
  const usedPct = Math.min(100, Math.round(pct(totals.kcal, target.kcal)));
  return `<article class="card calorie-card">
    <header class="card-head">
      <div><p class="eyebrow">ملخص النهارده</p><h2>سعراتك</h2></div>
      <span class="badge badge-accent">${icon('target')} ${esc(GOALS[profile.goal]?.label || 'ثبات')}</span>
    </header>
    <div class="calorie-main">
      <div class="calorie-ring${over ? ' is-over' : ''}">
        <svg viewBox="0 0 150 150" aria-hidden="true">
          <circle class="ring-track" cx="75" cy="75" r="62"/>
          <circle class="ring-value" cx="75" cy="75" r="62" style="${ringStyle(totals.kcal, target.kcal, 62)}"/>
        </svg>
        <div class="ring-center">
          <span>${over ? 'زيادة' : 'باقي'}</span>
          <strong>${fmt(Math.abs(left))}</strong>
          <small>سعرة</small>
        </div>
      </div>
      <div class="calorie-numbers">
        <div><span>اتاكل</span><strong>${fmt(totals.kcal)}</strong><small>سعرة</small></div>
        <div><span>هدفك</span><strong>${fmt(target.kcal)}</strong><small>سعرة</small></div>
        <div><span>الإنجاز</span><strong>${usedPct}%</strong><small>من الهدف</small></div>
      </div>
    </div>
    <div class="macro-list">
      ${macroRow('بروتين', totals.p, target.protein, 'protein')}
      ${macroRow('كارب', totals.c, target.carbs, 'carb')}
      ${macroRow('دهون', totals.f, target.fat, 'fat')}
    </div>
    <div class="calorie-foot">
      <span>${icon('info')} محسوب على نشاط ${esc(ACTIVITIES[profile.activity]?.label || 'متوسط')}</span>
      <button type="button" class="link-btn" data-nav="profile">عدّل هدفك</button>
    </div>
  </article>`;
}

function workoutCard() {
  const state = getState();
  const plan = getPlan(state.planState.activePlan);
  const today = todayKey();
  if (!plan) {
    return `<article class="card workout-card">
      <header class="card-head"><div><p class="eyebrow">التمرين</p><h2>مفيش خطة لسه</h2></div></header>
      <p class="muted">اختار جدول تمرين من صفحة التمرين وابدأ.</p>
      <button class="btn btn-soft btn-block" type="button" data-nav="train">${icon('dumbbell')} اختار جدول</button>
    </article>`;
  }
  const { day } = dayForDate(plan, today);
  const session = getSession(today);
  const stats = sessionStats(session, day);
  const completed = session?.completed;
  const isRest = !day;

  if (isRest) {
    return `<article class="card workout-card is-rest">
      <header class="card-head">
        <div><p class="eyebrow">تمرين النهارده</p><h2>يوم راحة</h2></div>
        <span class="badge badge-muted">${icon('moon')} استشفاء</span>
      </header>
      <div class="rest-visual">${icon('dumbbell')}</div>
      <p class="muted">الجسم بيبني العضل وإنت مرتاح. مشي خفيف 20 دقيقة وتمدّد كفاية.</p>
      <button class="btn btn-ghost btn-block" type="button" data-nav="train">${icon('calendar')} شوف الأسبوع</button>
    </article>`;
  }

  const preview = (day.ex || []).slice(0, 3).map((exercise) => {
    if (exercise.en) {
      return `<span class="mini-tag"><strong>${esc(exercise.en)}</strong><small>${esc(exercise.name)}</small></span>`;
    }
    return `<span class="mini-tag is-ar-only"><strong>${esc(exercise.name)}</strong></span>`;
  }).join('');
  return `<article class="card workout-card${completed ? ' is-done' : ''}">
    <header class="card-head">
      <div><p class="eyebrow">تمرين النهارده · ${esc(plan.name.split('—')[0].trim())}</p><h2>${esc(day.label)}</h2></div>
      <span class="badge ${completed ? 'badge-success' : 'badge-muted'}">${completed ? `${icon('check')} خلصت` : esc(plan.level)}</span>
    </header>
    <p class="workout-focus">${esc(day.focus || '')}</p>
    <div class="workout-meta">
      <span>${icon('dumbbell')} ${stats.exerciseCount} تمرين</span>
      <span>${icon('clock')} ${plan.duration} دقيقة</span>
      <span>${icon('target')} ${stats.totalSets} مجموعة</span>
    </div>
    <div class="mini-tags">${preview}</div>
    <div class="workout-progress">
      <div class="workout-progress-head"><span>${completed ? 'تمرين مكتمل' : `${stats.doneSets} من ${stats.totalSets} مجموعة`}</span><strong>${stats.percent}%</strong></div>
      ${progress(stats.percent, 100, completed ? 'progress-success' : '', 'إنجاز التمرين')}
    </div>
    <button class="btn ${completed ? 'btn-soft' : 'btn-primary'} btn-block" type="button" data-nav="train">
      ${completed ? icon('chart') + ' شوف تفاصيل التمرين' : icon('play') + (stats.doneSets ? ' كمّل التمرين' : ' ابدأ التمرين')}
    </button>
  </article>`;
}

function waterCard(target) {
  const water = getWater(todayKey());
  const goal = target.water;
  const cups = Math.max(8, Math.round(goal / 250));
  const filled = Math.min(cups, Math.round(water / 250));
  return `<article class="card water-card">
    <header class="card-head">
      <div><p class="eyebrow">المية</p><h2>${(water / 1000).toFixed(1)} <small>/ ${(goal / 1000).toFixed(1)} لتر</small></h2></div>
      <span class="water-badge">${icon('drop')}</span>
    </header>
    <div class="water-glasses" style="--cups:${cups}">
      ${Array.from({ length: cups }, (_, index) => `<button type="button" class="water-glass${index < filled ? ' is-filled' : ''}" data-water-set="${(index + 1) * 250}" aria-label="اضبط المية على ${(index + 1) * 250} مل"></button>`).join('')}
    </div>
    <div class="water-foot">
      <span>${filled} من ${cups} كوب</span>
      <div class="water-actions">
        <button type="button" class="btn btn-xs btn-soft" data-water-add>${icon('plus')} كوب</button>
        <button type="button" class="link-btn" data-water-reset>تصفير</button>
      </div>
    </div>
  </article>`;
}

function weightCard() {
  const latest = latestWeight();
  const change = weightChange(30);
  const list = [...getState().weights].sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
  const values = list.map((item) => item.kg);
  const deltaTone = change.delta < 0 ? 'down' : change.delta > 0 ? 'up' : '';
  return `<article class="card weight-card">
    <header class="card-head">
      <div><p class="eyebrow">الوزن</p><h2>${latest.kg} <small>كجم</small></h2></div>
      <button type="button" class="icon-btn icon-btn-sm" data-open-weight aria-label="سجّل الوزن">${icon('plus')}</button>
    </header>
    ${values.length > 1 ? sparkline(values) : `<div class="weight-empty">${icon('scale')} سجّل وزنك للمتابعة</div>`}
    <div class="weight-foot">
      <span class="weight-delta ${deltaTone}">${change.count > 1 ? `${change.delta > 0 ? '+' : ''}${change.delta} كجم` : 'أول قياس'}</span>
      <span>${change.count > 1 ? 'آخر 30 يوم' : 'ابدأ المتابعة'}</span>
    </div>
  </article>`;
}

function mealsCard() {
  const state = getState();
  const day = getDay(todayKey());
  const rows = [
    { id: 'breakfast', label: 'الفطار', icon: 'sun' },
    { id: 'lunch', label: 'الغدا', icon: 'food' },
    { id: 'dinner', label: 'العشا', icon: 'moon' },
    { id: 'snacks', label: 'سناكس', icon: 'star' }
  ].map((meal) => {
    const entries = day.meals[meal.id] || [];
    const kcal = entries.reduce((total, entry) => total + (Number(entry.kcal) || 0), 0);
    const names = entries.map((entry) => entry.name).join('، ');
    return `<button class="meal-row" type="button" data-add-food data-meal="${meal.id}">
      <span class="meal-icon">${icon(meal.icon)}</span>
      <span class="meal-text"><strong>${meal.label}</strong><small>${entries.length ? esc(names) : 'لسه مفيش حاجة مسجلة'}</small></span>
      <span class="meal-kcal">${kcal ? `${fmt(kcal)} <small>سعرة</small>` : '<small>أضف</small>'}</span>
      <span class="meal-plus">${icon('plus')}</span>
    </button>`;
  }).join('');
  const totals = totalsFor(todayKey());
  return `<article class="card meals-card">
    <header class="card-head">
      <div><p class="eyebrow">${esc(relativeDay(todayKey()))}</p><h2>وجبات النهارده <small>${fmt(totals.kcal)} سعرة</small></h2></div>
      <button class="btn btn-soft btn-sm" type="button" data-add-food>${icon('plus')} أضف</button>
    </header>
    <div class="meal-list">${rows}</div>
  </article>`;
}

function weekChartCard(target) {
  const days = lastDays(7);
  const data = days.map((date) => {
    const totals = totalsFor(date);
    return {
      label: shortDate(date),
      short: dayName(date, true),
      value: totals.kcal,
      active: date === todayKey()
    };
  });
  const logged = data.filter((item) => item.value > 0);
  const average = logged.length ? Math.round(logged.reduce((sum, item) => sum + item.value, 0) / logged.length) : 0;
  const onTarget = logged.filter((item) => Math.abs(item.value - target.kcal) <= target.kcal * 0.1).length;
  return `<article class="card chart-card">
    <header class="card-head">
      <div><p class="eyebrow">آخر 7 أيام</p><h2>إيقاع السعرات</h2></div>
      <span class="badge badge-muted">${icon('chart')} ${onTarget} يوم على الهدف</span>
    </header>
    ${barChart({ data, target: target.kcal, unit: 'سعرة' })}
    <div class="chart-foot">
      <div><span>متوسط اليوم</span><strong>${average ? fmt(average) : '—'}</strong><small>سعرة</small></div>
      <div><span>أيام مسجلة</span><strong>${logged.length}</strong><small>من 7</small></div>
      <div><span>سلسلة المتابعة</span><strong>${currentStreak()}</strong><small>يوم</small></div>
    </div>
  </article>`;
}

function tipCard(target) {
  const tips = [
    `وزّع ${target.protein} جم بروتين على 3–4 وجبات عشان تحافظ على عضلاتك وإحساس الشبع.`,
    `اشرب ${(target.water / 1000).toFixed(1)} لتر مية على مدار اليوم — مش مرة واحدة.`,
    'النوم 7–8 ساعات بيحسّن الاستشفاء ونتايج التمرين أكتر من أي مكمل.',
    'قبل التمرين بساعة: كارب سهل الهضم + بروتين خفيف. بعد التمرين: وجبة كاملة.',
    'ثبّت مواعيد الوجبات. الالتزام 80% لمدة طويلة أفضل من كمال أسبوع واحد.',
    'خد يوم راحة كامل كل 7–10 أيام، والمشي الخفيف أفضل من الراحة السلبية.'
  ];
  const index = (new Date().getDate() + getState().weights.length) % tips.length;
  return `<article class="card tip-card">
    <span class="tip-icon">${icon('bulb')}</span>
    <div><p class="eyebrow">نصيحة النهارده</p><p>${esc(tips[index])}</p></div>
    <button type="button" class="link-btn" data-nav="profile">اهدافك ${icon('chevron-left')}</button>
  </article>`;
}

function insightStrip(target, totals, profile) {
  const left = Math.round(target.kcal - totals.kcal);
  const water = getWater(todayKey());
  let text = '';
  if (!totals.kcal && !water) text = 'لسه مفيش حاجة مسجلة النهارده — ابدأ بالفطار وسجّل أول وجبة.';
  else if (left < 0) text = `تعدّيت هدفك بـ ${fmt(Math.abs(left))} سعرة. مش مشكلة — امشي 20 دقيقة وارجع لروتينك.`;
  else if (left < 150) text = `قريب جداً من هدفك، فاضل ${fmt(left)} سعرة بس. اختار عشا خفيف.`;
  else if (water < target.water * 0.4) text = `فاضل ${fmt(left)} سعرة — ولسه محتاج ${((target.water - water) / 1000).toFixed(1)} لتر مية.`;
  else text = `فاضل لك ${fmt(left)} سعرة النهارده. كمّل بنفس الهدوء والالتزام.`;
  const name = profile.name ? `يا ${profile.name}` : 'يا صديقي';
  return `<div class="insight-strip">
    <span class="insight-icon">${icon('flame')}</span>
    <p><strong>${esc(name)}</strong> ${esc(text)}</p>
    <span class="insight-pill">${esc(GOALS[profile.goal]?.label || 'ثبات')}</span>
  </div>`;
}

function bindWater(root) {
  root.querySelectorAll('[data-water-set]').forEach((button) => {
    button.addEventListener('click', () => {
      const current = getWater(todayKey());
      const value = Number(button.dataset.waterSet);
      setWater(todayKey(), current === value ? value - 250 : value);
    });
  });
  root.querySelector('[data-water-add]')?.addEventListener('click', () => {
    setWater(todayKey(), getWater(todayKey()) + 250);
  });
  root.querySelector('[data-water-reset]')?.addEventListener('click', () => {
    setWater(todayKey(), 0);
  });
}

export function renderHome() {
  const root = document.getElementById('view-home');
  if (!root) return;
  const state = getState();
  const target = getTarget();
  const totals = totalsFor(todayKey());

  root.innerHTML = `<div class="dashboard">
    ${insightStrip(target, totals, state.profile)}
    <div class="dash-grid">
      ${calorieCard(target, totals, state.profile)}
      <div class="dash-side">
        ${workoutCard()}
        <div class="dash-mini">
          ${waterCard(target)}
          ${weightCard()}
        </div>
      </div>
    </div>
    <div class="dash-lower">
      ${mealsCard()}
      ${weekChartCard(target)}
    </div>
    ${tipCard(target)}
    <p class="fine-print dashboard-note">${icon('info')} الأرقام تقديرية مبنية على بياناتك ومعادلة Mifflin-St Jeor. استشر مختص قبل أي تغيير كبير.</p>
  </div>`;

  bindWater(root);
}
