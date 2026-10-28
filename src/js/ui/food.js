import {
  MEALS,
  copyDayFoods,
  getDay,
  getState,
  getTarget,
  removeFood,
  repeatEntry,
  totalsFor
} from '../core/store.js';
import { fmt } from '../core/calc.js';
import { addDays, isFuture, isToday, relativeDay, shortDate, todayKey } from '../core/dates.js';
import { esc, icon, progress, toast } from './dom.js';
import { openAiDialog } from './ai.js';
import { openFoodDialog } from './food-dialog.js';
import { openScanner } from './scan.js';

let viewDate = todayKey();

const mealMeta = {
  breakfast: { label: 'الفطار', icon: 'sun', hint: 'ابدأ يومك صح' },
  lunch: { label: 'الغدا', icon: 'food', hint: 'الوجبة الرئيسية' },
  dinner: { label: 'العشا', icon: 'moon', hint: 'خفيف ومتوازن' },
  snacks: { label: 'سناكس', icon: 'star', hint: 'سناك ذكي' }
};

function entryRow(entry, mealId) {
  const qtyLabel = entry.qty && entry.qty !== 1 ? `${entry.qty} × ` : '';
  return `<div class="diary-entry">
    <span class="entry-dot"></span>
    <div class="entry-main">
      <strong>${esc(entry.name)}</strong>
      <small>${esc(qtyLabel)}${esc(entry.portion)}</small>
      <div class="entry-macros"><span>P ${fmt(entry.p, 1)}</span><span>C ${fmt(entry.c, 1)}</span><span>F ${fmt(entry.f, 1)}</span></div>
    </div>
    <span class="entry-kcal">${fmt(entry.kcal)}<small>سعرة</small></span>
    <div class="entry-actions">
      <button type="button" class="icon-btn icon-btn-xs" data-action="repeat" data-meal="${mealId}" data-id="${esc(entry.id)}" aria-label="كرر ${esc(entry.name)}">${icon('undo')}</button>
      <button type="button" class="icon-btn icon-btn-xs danger" data-action="delete" data-meal="${mealId}" data-id="${esc(entry.id)}" aria-label="احذف ${esc(entry.name)}">${icon('trash')}</button>
    </div>
  </div>`;
}

function mealCard(meal) {
  const day = getDay(viewDate);
  const entries = day.meals[meal.id] || [];
  const kcal = entries.reduce((total, entry) => total + (Number(entry.kcal) || 0), 0);
  return `<article class="card meal-card">
    <header class="meal-card-head">
      <span class="meal-icon">${icon(mealMeta[meal.id].icon)}</span>
      <div class="meal-card-title">
        <h3>${mealMeta[meal.id].label}</h3>
        <small>${entries.length ? `${entries.length} عنصر · ${fmt(kcal)} سعرة` : mealMeta[meal.id].hint}</small>
      </div>
      <button class="btn btn-soft btn-sm" type="button" data-add-food data-meal="${meal.id}" data-date="${viewDate}">${icon('plus')} أضف</button>
    </header>
    <div class="diary-entries">
      ${entries.length
        ? entries.map((entry) => entryRow(entry, meal.id)).join('')
        : `<div class="meal-empty"><span>${icon('plus')}</span> مفيش حاجة هنا — اضغط «أضف» وسجّل أول أكلة.</div>`}
    </div>
  </article>`;
}

function summaryCard(target) {
  const totals = totalsFor(viewDate);
  const left = Math.round(target.kcal - totals.kcal);
  const over = left < 0;
  const caloriesPct = Math.min(100, Math.round((totals.kcal / (target.kcal || 1)) * 100));
  return `<div class="card food-summary">
    <div class="food-summary-main">
      <div class="food-summary-head">
        <div>
          <p class="eyebrow">${esc(relativeDay(viewDate))}</p>
          <h2>${fmt(totals.kcal)} <small>/ ${fmt(target.kcal)} سعرة</small></h2>
        </div>
        <div class="food-summary-actions">
          <button class="btn btn-ghost btn-sm" type="button" id="food-open-ai"><svg class="icon"><use href="#i-camera"/></svg> تحليل صورة بالذكاء الاصطناعي</button>
          <div class="summary-left ${over ? 'is-over' : ''}">
            <span>${over ? 'زيادة' : 'باقي'}</span>
            <strong>${fmt(Math.abs(left))}</strong>
          </div>
        </div>
      </div>
      ${progress(totals.kcal, target.kcal, over ? 'progress-coral' : '', 'تقدم السعرات')}
      <div class="summary-macros">
        <span><i class="dot dot-p"></i> بروتين <strong>${Math.round(totals.p)} / ${target.protein}</strong></span>
        <span><i class="dot dot-c"></i> كارب <strong>${Math.round(totals.c)} / ${target.carbs}</strong></span>
        <span><i class="dot dot-f"></i> دهون <strong>${Math.round(totals.f)} / ${target.fat}</strong></span>
        <span class="summary-percent">${caloriesPct}%</span>
      </div>
    </div>
    <div class="summary-actions">
      <button class="btn btn-primary" type="button" data-add-food data-date="${viewDate}">${icon('plus')} أضف أكلة</button>
      <button class="btn btn-soft" type="button" id="food-scan-page">${icon('barcode')} باركود</button>
      <button class="btn btn-soft" type="button" id="food-ai-page">${icon('camera')} صوّر أكلك</button>
    </div>
  </div>`;
}

function dateNav() {
  const canNext = !isFuture(addDays(viewDate, 1));
  return `<div class="date-nav" role="group" aria-label="التنقل بين الأيام">
    <button type="button" class="icon-btn" data-date-step="-1" aria-label="اليوم السابق">${icon('chevron-right')}</button>
    <button type="button" class="date-pill${isToday(viewDate) ? ' is-today' : ''}" id="date-today">
      ${icon('calendar')} <span>${esc(relativeDay(viewDate))}</span><small>${esc(shortDate(viewDate))}</small>
    </button>
    <button type="button" class="icon-btn" data-date-step="1" aria-label="اليوم التالي" ${canNext ? '' : 'disabled'}>${icon('chevron-left')}</button>
  </div>`;
}

function copyBanner() {
  const yesterday = addDays(viewDate, -1);
  const hasToday = totalsFor(viewDate).kcal > 0;
  const hasYesterday = totalsFor(yesterday).kcal > 0;
  if (hasToday || !hasYesterday) return '';
  return `<div class="copy-banner">
    <span>${icon('undo')} عايز تبدأ بنفس وجبات امبارح؟</span>
    <button type="button" class="link-btn" id="copy-yesterday">انسخ وجبات ${esc(relativeDay(yesterday))}</button>
  </div>`;
}

function bind(root) {
  root.querySelectorAll('[data-date-step]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = addDays(viewDate, Number(button.dataset.dateStep));
      if (isFuture(next)) return;
      viewDate = next;
      renderFood();
    });
  });
  root.querySelector('#date-today')?.addEventListener('click', () => {
    viewDate = todayKey();
    renderFood();
  });
  root.querySelector('#food-scan-page')?.addEventListener('click', () => {
    openScanner((food) => {
      if (food) openFoodDialog({ date: viewDate, meal: 'breakfast', food });
    });
  });
  root.querySelector('#food-ai-page')?.addEventListener('click', () => {
    openAiDialog({ date: viewDate });
  });
  root.querySelector('#copy-yesterday')?.addEventListener('click', () => {
    copyDayFoods(addDays(viewDate, -1), viewDate);
    toast('وجبات امبارح اتنسخت — تقدر تعدّل براحتك', { type: 'success' });
  });

  root.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const day = getDay(viewDate);
      const entry = (day.meals[button.dataset.meal] || []).find((item) => item.id === button.dataset.id);
      if (!entry) return;
      if (button.dataset.action === 'delete') {
        removeFood(viewDate, button.dataset.meal, entry.id);
        toast(`${entry.name} اتحذفت من ${mealMeta[button.dataset.meal].label}`, { type: 'info', duration: 2200 });
      } else if (button.dataset.action === 'repeat') {
        repeatEntry(viewDate, button.dataset.meal, entry);
        toast(`تم تكرار ${entry.name}`, { type: 'success', duration: 2200 });
      }
    });
  });
}

export function renderFood() {
  const root = document.getElementById('view-food');
  if (!root) return;
  if (isFuture(viewDate)) viewDate = todayKey();
  const target = getTarget();
  const state = getState();

  root.innerHTML = `<div class="food-page">
    <header class="page-head">
      <div>
        <p class="eyebrow">سجّل كل حاجة بتاكلها</p>
        <h2>يوميات الأكل</h2>
      </div>
      ${dateNav()}
      <button class="btn btn-ghost btn-sm food-ai-quick" id="food-ai-quick" type="button">
        <svg class="icon"><use href="#i-camera"/></svg>
        <span>صوّر أكلك بالـAI</span>
      </button>
    </header>
    ${summaryCard(target)}
    ${copyBanner()}
    <div class="meal-grid">
      ${MEALS.map(mealCard).join('')}
    </div>
    <div class="food-tip">
      <span>${icon('bulb')}</span>
      <p><strong>${state.profile.name ? `يا ${esc(state.profile.name)}, ` : ''}خليك واقعي.</strong> سجّل الأكل قبل ما تاكله، وده هيخليك تختار أحسن وانت مش جعان.</p>
    </div>
    <p class="fine-print">${icon('info')} القيم تقديرية، والأكل المطبوخ خارج البيت ممكن يختلف حسب الزيت والمكونات.</p>
  </div>`;

  bind(root);
  root.querySelector('#food-open-ai')?.addEventListener('click', () => openAiDialog({ date: viewDate }));
  root.querySelector('#food-ai-quick')?.addEventListener('click', () => openAiDialog({ date: viewDate }));
  root.querySelector('#food-ai-page')?.addEventListener('click', () => openAiDialog({ date: viewDate }));

  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = isToday(viewDate) ? 'يوميات الأكل' : `يوميات ${relativeDay(viewDate)}`;
}
