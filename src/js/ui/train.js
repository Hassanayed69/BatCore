import {
  addCustomExercise,
  deleteWorkout,
  ensureLog,
  getSession,
  getState,
  removeCustomExercise,
  setActivePlan,
  setSessionDay,
  setSetLog,
  setWorkoutDone
} from '../core/store.js';
import {
  dayName,
  dayNumber,
  addDays,
  isToday,
  relativeDay,
  shortDate,
  todayKey,
  weekDates
} from '../core/dates.js';
import {
  customExerciseKey,
  planExerciseKey,
  sessionStats
} from '../core/workout.js';
import { getPlan, getPlans, dayForDate } from '../services/plans.js';
import { esc, icon, openDialog, closeDialog, progress, toast } from './dom.js';

let selectedDate = todayKey();
let pickerFor = null;
let dialogContext = null;
let restTimer = null;
let restDeadline = 0;
let restTotal = 0;

const REST_C = 2 * Math.PI * 18;

function planSelect(plan) {
  return `<select id="plan-select" aria-label="اختار خطة التمرين">
    ${getPlans().map((item) => `<option value="${esc(item.id)}" ${item.id === plan?.id ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}
  </select>`;
}

function weekStrip(plan) {
  const dates = weekDates(selectedDate);
  const today = todayKey();
  const nextWeekDate = addDays(selectedDate, 7);
  const canNext = nextWeekDate <= today;

  const days = dates.map((date) => {
    const future = date > today;
    const { day, free, stored } = sessionState(plan, date);
    const done = Boolean(stored?.completed && stored.planId === plan.id);
    const classes = [
      'week-day',
      future ? 'is-future' : '',
      date === selectedDate ? 'is-selected' : '',
      isToday(date) ? 'is-today' : '',
      day || free ? '' : 'is-rest',
      done ? 'is-done' : ''
    ].filter(Boolean).join(' ');
    return `<button type="button" class="${classes}" data-day-date="${date}" ${future ? 'disabled' : ''} aria-pressed="${date === selectedDate}">
      <span class="week-day-name">${esc(dayName(date, true))}</span>
      <strong>${dayNumber(date)}</strong>
      <small>${done ? icon('check') : free ? 'حر' : day ? 'تمرين' : 'مفتوح'}</small>
    </button>`;
  }).join('');

  return `<div class="week-nav">
    <button type="button" class="icon-btn icon-btn-sm" data-week-step="-1" aria-label="الأسبوع السابق">${icon('chevron-right')}</button>
    <span>${esc(shortDate(dates[0]))} — ${esc(shortDate(dates[6]))}</span>
    <button type="button" class="icon-btn icon-btn-sm" data-week-step="1" aria-label="الأسبوع التالي" ${canNext ? '' : 'disabled'}>${icon('chevron-left')}</button>
  </div>
  <div class="week-strip">${days}</div>`;
}

function previousWeight(plan, dayIndex, key, setIndex) {
  const state = getState();
  const dates = Object.keys(state.workouts)
    .filter((date) => date < selectedDate)
    .sort()
    .reverse();
  for (const date of dates) {
    const session = state.workouts[date];
    if (session?.planId !== plan.id || session?.dayIndex !== dayIndex) continue;
    const value = session.logs?.[key]?.[setIndex]?.w;
    if (value) return value;
  }
  return '';
}

function exerciseCard(exercise, index, plan, dayIndex, session) {
  const key = planExerciseKey(index);
  const logs = session?.logs?.[key] || [];
  const allDone = logs.length >= exercise.sets && logs.slice(0, exercise.sets).every((set) => set?.done);
  const prev = previousWeight(plan, dayIndex, key, 0);
  const setRows = Array.from({ length: exercise.sets }, (_, setIndex) => {
    const log = logs[setIndex] || {};
    const previous = previousWeight(plan, dayIndex, key, setIndex);
    return `<div class="set-row${log.done ? ' is-done' : ''}">
      <span class="set-num">${setIndex + 1}</span>
      <input type="number" inputmode="decimal" min="0" max="500" step="0.5" value="${esc(log.w ?? '')}" placeholder="${esc(previous || '0')}" data-set-field="w" data-key="${key}" data-set="${setIndex}" data-total="${exercise.sets}" aria-label="وزن المجموعة ${setIndex + 1} — ${esc(exercise.name)}">
      <input type="number" inputmode="numeric" min="0" max="100" step="1" value="${esc(log.r ?? '')}" placeholder="${esc(exercise.reps)}" data-set-field="r" data-key="${key}" data-set="${setIndex}" data-total="${exercise.sets}" aria-label="عدات المجموعة ${setIndex + 1} — ${esc(exercise.name)}">
      <button type="button" class="set-check${log.done ? ' is-done' : ''}" data-set-toggle data-key="${key}" data-set="${setIndex}" data-total="${exercise.sets}" data-rest="${exercise.rest || 60}" data-exercise="${esc(exercise.name)}" aria-pressed="${Boolean(log.done)}" aria-label="المجموعة ${setIndex + 1} ${log.done ? 'خلصت' : 'لسه'}">${icon('check')}</button>
    </div>`;
  }).join('');

  return `<article class="exercise-card${allDone ? ' is-done' : ''}">
    <header class="exercise-head">
      <span class="ex-number">${String(index + 1).padStart(2, '0')}</span>
      <div class="ex-title">
        <h3>${esc(exercise.en || exercise.name)}</h3>
        <span>${esc(exercise.en ? exercise.name : '')}</span>
      </div>
      <span class="tag">${esc(exercise.muscle || 'عام')}</span>
      <div class="ex-prescription">
        <strong>${exercise.sets} × ${esc(exercise.reps)}</strong>
        <small>${exercise.rest || 60} ث راحة</small>
      </div>
    </header>
    <div class="set-table">
      <div class="set-head"><span>#</span><span>الوزن (كجم)</span><span>العدات</span><span>تم</span></div>
      ${setRows}
    </div>
    <footer class="exercise-foot">
      <span>${icon('info')} ${prev ? `آخر مرة: ${esc(prev)} كجم` : 'سجّل وزنك عشان تتابع تقدمك'}</span>
      ${allDone ? `<span class="done-label">${icon('check')} مكتمل</span>` : ''}
    </footer>
  </article>`;
}

function customExerciseCard(exercise, plan, dayIndex, session) {
  const key = customExerciseKey(exercise.id);
  const logs = session?.logs?.[key] || [];
  const allDone = logs.length >= exercise.sets && logs.slice(0, exercise.sets).every((set) => set?.done);
  const setRows = Array.from({ length: exercise.sets }, (_, setIndex) => {
    const log = logs[setIndex] || {};
    return `<div class="set-row${log.done ? ' is-done' : ''}">
      <span class="set-num">${setIndex + 1}</span>
      <input type="number" inputmode="decimal" min="0" max="500" step="0.5" value="${esc(log.w ?? '')}" placeholder="0" data-set-field="w" data-key="${key}" data-set="${setIndex}" data-total="${exercise.sets}" aria-label="وزن ${esc(exercise.name)} مجموعة ${setIndex + 1}">
      <input type="number" inputmode="numeric" min="0" max="100" step="1" value="${esc(log.r ?? '')}" placeholder="${esc(exercise.reps)}" data-set-field="r" data-key="${key}" data-set="${setIndex}" data-total="${exercise.sets}" aria-label="عدات ${esc(exercise.name)} مجموعة ${setIndex + 1}">
      <button type="button" class="set-check${log.done ? ' is-done' : ''}" data-set-toggle data-key="${key}" data-set="${setIndex}" data-total="${exercise.sets}" data-rest="${exercise.rest || 60}" data-exercise="${esc(exercise.name)}" aria-pressed="${Boolean(log.done)}" aria-label="المجموعة ${setIndex + 1}">${icon('check')}</button>
    </div>`;
  }).join('');
  const customEn = exercise.en || exercise.name;
  const customAr = exercise.en ? exercise.name : 'تمرين مخصص';
  return `<article class="exercise-card custom${allDone ? ' is-done' : ''}">
    <header class="exercise-head">
      <span class="ex-number">${icon('dumbbell')}</span>
      <div class="ex-title"><h3>${esc(customEn)}</h3><span>${esc(customAr)}</span></div>
      <span class="tag tag-mine">إضافي</span>
      <div class="ex-prescription"><strong>${exercise.sets} × ${esc(exercise.reps)}</strong><small>${exercise.rest || 60} ث راحة</small></div>
      <button type="button" class="icon-btn icon-btn-xs danger" data-remove-custom="${esc(exercise.id)}" aria-label="احذف ${esc(exercise.name)}">${icon('trash')}</button>
    </header>
    <div class="set-table">
      <div class="set-head"><span>#</span><span>الوزن (كجم)</span><span>العدات</span><span>تم</span></div>
      ${setRows}
    </div>
  </article>`;
}

/* حالة اليوم: خطة اليوم الافتراضية، أو اليوم اللي المستخدم اختاره، أو تمرين حر */
const hasExercises = (day) => Boolean(day && (day.ex || []).length);

function sessionState(plan, date) {
  const stored = getSession(date);
  const samePlan = Boolean(stored && stored.planId === plan.id);

  if (samePlan && stored.dayPicked) {
    const index = Number(stored.dayIndex);
    if (Number.isInteger(index) && index >= 0 && index < (plan.days?.length || 0) && hasExercises(plan.days[index])) {
      return { stored, index, day: plan.days[index], picked: true, free: false, mismatch: false };
    }
    return { stored, index: -1, day: null, picked: true, free: true, mismatch: false };
  }

  const scheduled = dayForDate(plan, date);
  const day = hasExercises(scheduled.day) ? scheduled.day : null;
  const mismatch = Boolean(stored && (!samePlan || stored.dayIndex !== scheduled.index));
  return { stored, index: scheduled.index, day, picked: false, free: false, mismatch };
}

function dayPicker(plan, date, { hasSession = false } = {}) {
  const options = (plan.days || [])
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => hasExercises(item));

  return `<article class="card day-picker">
    <div class="day-picker-head">
      <span class="day-picker-icon">${icon('dumbbell')}</span>
      <div>
        <p class="eyebrow">${esc(relativeDay(date))} · انت اللي تختار</p>
        <h2>اختار تمرين النهارده</h2>
      </div>
    </div>
    <p class="day-picker-hint">مفيش يوم راحة مفروض عليك. اختار أي يوم من الجدول، أو ابدأ تمرين حر وضيف تمارينك بنفسك — الخطط مجرد مصدر للتمارين.</p>
    ${hasSession ? `<button class="back-link" type="button" data-close-picker>${icon('chevron-right')} رجع للتمرين المسجل</button>` : ''}
    <div class="day-picker-grid">
      ${options.map(({ item, index }, order) => `<button class="day-choice" type="button" data-pick-day="${index}">
        <span class="day-choice-num">${String(order + 1).padStart(2, '0')}</span>
        <span class="day-choice-text">
          <strong>${esc(item.label)}</strong>
          <small>${esc(item.focus || '')}</small>
        </span>
        <span class="day-choice-count">${(item.ex || []).length} تمارين</span>
      </button>`).join('')}
    </div>
    <button class="btn btn-soft btn-block day-free-btn" type="button" data-pick-day="-1">${icon('bolt')} تمرين حر — أنا هحدد التمارين</button>
    <p class="fine-print">${icon('info')} اختيارك بيتحفظ لليوم ده بس، وباقي الأيام مش بتتغير.</p>
  </article>`;
}

function workoutPanel(plan, date) {
  const view = sessionState(plan, date);
  if (!view.day && !view.free) return dayPicker(plan, date, { hasSession: Boolean(view.stored) });

  const { index, day, free } = view;
  const session = view.mismatch ? null : view.stored;
  const stats = sessionStats(session, day);
  const completed = Boolean(session?.completed);
  const allCustom = session?.custom || [];
  const exerciseCount = (day?.ex || []).length + allCustom.length;
  const title = day ? day.label : 'تمرين حر';
  const focus = day ? (day.focus || '') : 'تمارينك اللي اخترتها — ضيف اللي انت عايزه';

  return `<article class="card workout-panel">
    <header class="workout-head">
      <div>
        <p class="eyebrow">${esc(relativeDay(date))} · ${esc(plan.name)}${view.picked ? ' · اختيارك' : ''}</p>
        <h2>${esc(title)}</h2>
        <p class="workout-focus">${esc(focus)}</p>
      </div>
      <span class="badge ${completed ? 'badge-success' : 'badge-accent'}">${completed ? `${icon('check')} مكتمل` : day ? esc(plan.level) : 'حر'}</span>
    </header>

    <div class="workout-stat-row">
      <div><span>تمارين</span><strong>${stats.exerciseCount}</strong></div>
      <div><span>مجاميع</span><strong>${stats.doneSets}/${stats.totalSets}</strong></div>
      <div><span>وقت متوقع</span>${day ? `<strong>${plan.duration}<small>د</small></strong>` : '<strong>—</strong>'}</div>
      <div><span>الإنجاز</span><strong>${stats.percent}%</strong></div>
    </div>
    ${progress(stats.percent, 100, completed ? 'progress-success' : '', 'إنجاز التمرين')}

    ${view.mismatch ? `<div class="notice locked">
      ${icon('info')}
      <div><strong>في سجل لخطة تانية محفوظ في اليوم ده</strong><p>امسحه لو عايز تبدأ بخطة «${esc(plan.name)}» النهارده.</p></div>
      <button type="button" class="btn btn-soft btn-sm" data-reset-session>امسح وابدأ</button>
    </div>` : ''}

    ${view.mismatch ? '' : `
    ${completed ? `<div class="completed-banner">${icon('trophy')} <div><strong>تمرين مكتمل — كده تمام!</strong><span>سجّل وزنك في صفحة التقدم ومتابعة الأكل عشان تشوف النتيجة.</span></div></div>` : ''}

    ${exerciseCount ? `<div class="exercise-list">
      ${(day?.ex || []).map((exercise, exIndex) => exerciseCard(exercise, exIndex, plan, index, session)).join('')}
      ${allCustom.map((exercise) => customExerciseCard(exercise, plan, index, session)).join('')}
    </div>` : `<div class="exercise-empty">
      <span>${icon('dumbbell')}</span>
      <strong>مفيش تمارين لسه</strong>
      <p>ضيف تمرينك الأول بالزر تحت — انت اللي بتحدد تشتغل إيه النهارده.</p>
    </div>`}

    <div class="workout-actions">
      <button class="btn btn-soft" type="button" id="add-exercise" ${completed ? 'disabled' : ''}>${icon('plus')} تمرين إضافي</button>
      <button class="btn btn-soft" type="button" data-change-day>${icon('edit')} غيّر التمرين</button>
      ${completed
        ? `<button class="btn btn-ghost" type="button" id="reopen-workout">${icon('undo')} إعادة فتح التمرين</button>
           <button class="btn btn-ghost danger-text" type="button" id="delete-workout">${icon('trash')} حذف السجل</button>`
        : `<button class="btn btn-primary" type="button" id="complete-workout" ${stats.doneSets ? '' : 'disabled'}>${icon('check')} إنهاء التمرين</button>`}
    </div>
    ${stats.doneSets && !completed ? `<p class="hint workout-hint">خلصت ${stats.doneSets} من ${stats.totalSets} مجموعة. تقدر تكمّل الباقي أو تنهي التمرين هنا.</p>` : ''}`}
  </article>`;
}

function weekSummary(plan, date) {
  const dates = weekDates(date);
  const items = dates.map((day) => {
    const view = sessionState(plan, day);
    return {
      date: day,
      ...view,
      completed: Boolean(view.stored?.completed && view.stored.planId === plan.id)
    };
  });
  const target = items.filter((item) => item.day || item.free);
  const completed = target.filter((item) => item.completed).length;
  const pct = target.length ? Math.round((completed / target.length) * 100) : 0;
  const labelFor = (item) => (item.free ? 'تمرين حر' : item.day ? item.day.label : 'مفتوح');

  return `<article class="card week-summary">
    <header class="card-head"><div><p class="eyebrow">أسبوعك</p><h3>الالتزام بالتمرين</h3></div><span class="badge badge-accent">${completed}/${target.length}</span></header>
    ${progress(pct, 100, 'progress-success', 'إنجاز الأسبوع')}
    <div class="week-summary-list">
      ${items.map((item) => `<div class="week-summary-row${isToday(item.date) ? ' is-today' : ''}">
          <span>${esc(dayName(item.date, true))} ${dayNumber(item.date)}</span>
          <strong>${esc(labelFor(item))}</strong>
          <span class="status-dot ${item.completed ? 'is-done' : item.day || item.free ? 'is-planned' : ''}">${item.completed ? icon('check') : ''}</span>
        </div>`).join('')}
    </div>
    <p class="hint">${!target.length ? 'اختار تمرينك النهارده وابدأ.' : pct >= 100 ? 'أسبوع كامل — استمر!' : pct >= 50 ? 'أكثر من النص، تمام.' : 'لسه فاضل أيام — كمّل.'}</p>
  </article>`;
}

function planInfo(plan) {
  return `<article class="card plan-info">
    <header class="card-head"><div><p class="eyebrow">الخطة الحالية</p><h3>${esc(plan.name)}</h3></div><span class="tag">${esc(plan.level)}</span></header>
    <p>${esc(plan.description || '')}</p>
    <div class="plan-meta">
      <span>${icon('calendar')} ${plan.daysPerWeek} أيام/أسبوع</span>
      <span>${icon('clock')} ${plan.duration} دقيقة</span>
    </div>
  </article>`;
}

function bind(root, plan, date, dayIndex) {
  root.querySelector('#plan-select')?.addEventListener('change', (event) => {
    pickerFor = null;
    setActivePlan(event.target.value);
  });

  root.querySelectorAll('[data-week-step]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = addDays(selectedDate, Number(button.dataset.weekStep) * 7);
      if (next > todayKey()) return;
      selectedDate = next;
      pickerFor = null;
      renderTrain();
    });
  });

  root.querySelectorAll('[data-day-date]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedDate = button.dataset.dayDate;
      pickerFor = null;
      renderTrain();
    });
  });

  root.querySelectorAll('[data-pick-day]').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.pickDay);
      const existing = getSession(selectedDate);
      const same = existing && existing.planId === plan.id && Number(existing.dayIndex) === index;
      const hasWork = existing && ((existing.custom || []).length || Object.keys(existing.logs || {}).length);
      if (!same && hasWork && !window.confirm('تغيير التمرين هيمسح المجاميع والتمارين المسجلة النهارده. تمام؟')) return;

      pickerFor = null;
      setSessionDay(selectedDate, plan.id, index);
      const label = index >= 0 ? plan.days?.[index]?.label || 'تمرين' : 'تمرين حر';
      toast(`تمام — ${label} النهارده`, { type: 'success', duration: 2200 });
    });
  });

  root.querySelector('[data-close-picker]')?.addEventListener('click', () => {
    pickerFor = null;
    renderTrain();
  });

  root.querySelector('[data-change-day]')?.addEventListener('click', () => {
    pickerFor = selectedDate;
    renderTrain();
  });

  root.querySelectorAll('[data-set-field]').forEach((input) => {
    input.addEventListener('input', () => {
      const total = Number(input.dataset.total) || 1;
      setSetLog(selectedDate, plan.id, dayIndex, input.dataset.key, Number(input.dataset.set), {
        [input.dataset.setField]: input.value
      }, total);
    });
    input.addEventListener('focus', () => input.select?.());
  });

  root.querySelectorAll('[data-set-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const total = Number(button.dataset.total) || 1;
      const setIndex = Number(button.dataset.set);
      const logs = ensureLog(selectedDate, plan.id, dayIndex, button.dataset.key, total);
      const nextDone = !logs[setIndex]?.done;
      setSetLog(selectedDate, plan.id, dayIndex, button.dataset.key, setIndex, { done: nextDone }, total);
      if (nextDone) {
        navigator.vibrate?.(10);
        startRest(Number(button.dataset.rest) || 60, button.dataset.exercise || '');
      }
      const updated = getSession(selectedDate);
      renderTrain();
      const stats = sessionStats(updated, sessionState(plan, selectedDate).day);
      if (nextDone && stats.doneSets === stats.totalSets && stats.totalSets) {
        toast('خلصت كل المجاميع — اضغط «إنهاء التمرين»', { type: 'success', duration: 2800 });
      }
    });
  });

  root.querySelector('#add-exercise')?.addEventListener('click', () => {
    dialogContext = { date: selectedDate, planId: plan.id, dayIndex };
    const form = document.getElementById('exercise-form');
    form?.reset();
    openDialog('exercise-dialog');
    requestAnimationFrame(() => form?.elements.en?.focus());
  });

  root.querySelectorAll('[data-remove-custom]').forEach((button) => {
    button.addEventListener('click', () => {
      removeCustomExercise(selectedDate, button.dataset.removeCustom);
      toast('التمرين الإضافي اتحذف', { type: 'info', duration: 1800 });
    });
  });

  root.querySelector('#complete-workout')?.addEventListener('click', () => {
    setWorkoutDone(selectedDate, true);
    hideRestTimer();
    toast('تمرين مكتمل 💪 سجّل أكلك وارتاح كفاية', { type: 'success', duration: 3200 });
  });

  root.querySelector('#reopen-workout')?.addEventListener('click', () => {
    setWorkoutDone(selectedDate, false);
    toast('التمرين اتفتح تاني — كمّل براحتك', { type: 'info', duration: 2200 });
  });

  root.querySelector('#delete-workout')?.addEventListener('click', () => {
    if (!window.confirm('متأكد إنك عايز تمسح سجل التمرين ده؟')) return;
    deleteWorkout(selectedDate);
    toast('سجل التمرين اتحذف', { type: 'info' });
  });

  root.querySelector('[data-reset-session]')?.addEventListener('click', () => {
    if (!window.confirm('هتمسح السجل القديم وتبدأ بالخطة الحالية. تمام؟')) return;
    deleteWorkout(selectedDate);
    toast('السجل القديم اتمسح', { type: 'info' });
  });
}

export function renderTrain() {
  const root = document.getElementById('view-train');
  if (!root) return;
  const plan = getPlan();
  if (!plan) {
    root.innerHTML = `<div class="empty-state card">
      <span class="empty-icon">${icon('dumbbell')}</span>
      <strong>مفيش خطط تمرين متاحة</strong>
      <p>تأكد إن الموقع شغال من خلال سيرفر محلي عشان ملفات الخطط تتحمل.</p>
    </div>`;
    return;
  }

  if (selectedDate > todayKey()) selectedDate = todayKey();
  const view = sessionState(plan, selectedDate);
  const showPicker = pickerFor === selectedDate;

  root.innerHTML = `<div class="train-page">
    <header class="page-head">
      <div><p class="eyebrow">خطط جاهزة · وانت اللي تختار</p><h2>التمرين</h2></div>
      <div class="page-actions">${planSelect(plan)}</div>
    </header>
    ${weekStrip(plan)}
    <div class="train-layout">
      <div class="train-main">${showPicker ? dayPicker(plan, selectedDate, { hasSession: Boolean(view.stored) }) : workoutPanel(plan, selectedDate)}</div>
      <aside class="train-side">
        ${weekSummary(plan, selectedDate)}
        ${planInfo(plan)}
        <article class="card coach-tip">
          <span class="tip-icon">${icon('bulb')}</span>
          <h3>قواعد التمرين</h3>
          <ul>
            <li>انت اللي تختار تتمارن إمتى — مفيش يوم راحة مفروض عليك.</li>
            <li>سخّن 5–10 دقايق قبل أول تمرين.</li>
            <li>خلّي آخر مجموعة قريبة من الإجهاد مش للفشل.</li>
            <li>زوّد الوزن لما تعدّي الحد الأعلى للعدات.</li>
          </ul>
        </article>
      </aside>
    </div>
  </div>`;

  bind(root, plan, selectedDate, view.index);
}

function paintRest() {
  const remaining = Math.max(0, Math.ceil((restDeadline - Date.now()) / 1000));
  const count = document.getElementById('rest-count');
  const ring = document.getElementById('rest-progress');
  if (count) count.textContent = remaining >= 60 ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : String(remaining);
  if (ring) {
    ring.style.strokeDasharray = String(REST_C);
    ring.style.strokeDashoffset = String(REST_C * (1 - remaining / Math.max(1, restTotal)));
  }
  if (remaining <= 0) {
    hideRestTimer();
    toast('الراحة خلصت — يلا المجموعة الجاية', { type: 'info', duration: 2600 });
  }
}

function startRest(seconds, exercise) {
  clearInterval(restTimer);
  restTotal = Math.max(1, Number(seconds) || 60);
  restDeadline = Date.now() + restTotal * 1000;
  const bar = document.getElementById('rest-timer');
  const name = document.getElementById('rest-exercise');
  if (name) name.textContent = exercise ? `${exercise} — استعد` : 'استعد للمجموعة الجاية';
  if (bar) {
    bar.hidden = false;
    bar.classList.add('is-running');
  }
  paintRest();
  restTimer = window.setInterval(paintRest, 500);
}

export function hideRestTimer() {
  clearInterval(restTimer);
  restTimer = null;
  const bar = document.getElementById('rest-timer');
  if (bar) {
    bar.hidden = true;
    bar.classList.remove('is-running');
  }
}

export function initTrainDialog() {
  document.getElementById('rest-skip')?.addEventListener('click', hideRestTimer);

  document.getElementById('exercise-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!dialogContext) return;
    const data = Object.fromEntries(new FormData(event.target));
    try {
      addCustomExercise(dialogContext.date, dialogContext.planId, dialogContext.dayIndex, data);
      closeDialog('exercise-dialog');
      toast('التمرين الإضافي اتضاف', { type: 'success' });
    } catch (error) {
      toast(error.message || 'اكتب اسم التمرين', { type: 'error' });
    }
  });
}
