import { MEALS, addFood, addCustomFood, getState, removeFood, toggleFavorite } from '../core/store.js';
import { fmt, round } from '../core/calc.js';
import { relativeDay, todayKey } from '../core/dates.js';
import { CATEGORIES, favoriteFoods, getFoodById, recentFoods, searchFoods } from '../services/food.js';
import { closeDialog, esc, icon, openDialog, toast } from './dom.js';
import { openAiDialog } from './ai.js';
import { openScanner } from './scan.js';

const BODY = () => document.getElementById('food-dialog-body');
const KICKER = () => document.getElementById('food-dialog-kicker');
const TITLE = () => document.getElementById('food-dialog-title');

let ctx = {
  date: '',
  meal: 'breakfast',
  query: '',
  category: 'الكل',
  selected: null,
  qty: 1,
  mode: 'search'
};

function mealName(id) {
  return MEALS.find((meal) => meal.id === id)?.name || 'وجبة';
}

function updateHeader() {
  const kicker = KICKER();
  if (kicker) kicker.textContent = `${mealName(ctx.meal)} · ${relativeDay(ctx.date)}`;
  const title = TITLE();
  if (title) {
    title.textContent = ctx.mode === 'custom'
      ? 'أكلة مخصصة'
      : ctx.selected ? 'حدد الكمية' : ctx.query ? 'نتائج البحث' : 'اختار أكلة';
  }
}

function foodThumb(food) {
  if (food.image && /^https?:\/\//.test(food.image)) {
    return `<img class="food-thumb" src="${esc(food.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
  }
  const letter = (food.name || '؟').trim().charAt(0);
  return `<span class="food-thumb food-thumb-text" aria-hidden="true">${esc(letter)}</span>`;
}

function foodRow(food) {
  return `<button class="food-row" type="button" data-food-id="${esc(food.id)}" aria-label="اختار ${esc(food.name)}">
    ${foodThumb(food)}
    <span class="food-row-main">
      <strong>${esc(food.name)} ${food.custom ? '<i class="tag tag-mine">أكلاتي</i>' : ''}</strong>
      <small>${esc(food.portion)} · بروتين ${fmt(food.p, 1)} · كارب ${fmt(food.c, 1)} · دهون ${fmt(food.f, 1)}</small>
    </span>
    <span class="food-row-kcal"><strong>${fmt(food.kcal)}</strong><small>سعرة</small></span>
    <span class="food-row-plus">${icon('plus')}</span>
  </button>`;
}

function resultsSection(title, foods, empty = '') {
  if (!foods.length) return empty;
  return `<p class="results-title">${esc(title)}</p><div class="food-list">${foods.map(foodRow).join('')}</div>`;
}

function renderResults() {
  const root = document.getElementById('food-results');
  if (!root) return;
  const query = ctx.query.trim();
  let html = '';

  if (query) {
    const found = searchFoods(query, ctx.category);
    html = found.length
      ? `<p class="results-title">${found.length} نتيجة لـ «${esc(query)}»</p><div class="food-list">${found.map(foodRow).join('')}</div>`
      : `<div class="empty-state compact"><span class="empty-icon">${icon('search')}</span><strong>مفيش نتيجة للاسم ده</strong><p>جرّب كلمة تانية أو ضيف الأكلة بنفسك.</p></div>`;
  } else if (ctx.category !== 'الكل') {
    const found = searchFoods('', ctx.category, 60);
    html = found.length
      ? `<div class="food-list">${found.map(foodRow).join('')}</div>`
      : `<div class="empty-state compact"><span class="empty-icon">${icon('food')}</span><strong>مفيش أكلات هنا لسه</strong><p>ضيف أكلتك المخصصة واختار تصنيفها.</p></div>`;
  } else {
    const favorites = favoriteFoods();
    const recent = recentFoods(8);
    const used = new Set([...favorites, ...recent].map((food) => food.id));
    const suggestions = searchFoods('', 'مصري', 60).filter((food) => !used.has(food.id)).slice(0, 8);
    html = [
      resultsSection('المفضلة', favorites),
      resultsSection('استخدمتها قريب', recent),
      resultsSection('من المطبخ المصري', suggestions)
    ].join('');
    if (!html) {
      html = `<div class="empty-state compact"><span class="empty-icon">${icon('bulb')}</span><strong>ابدأ أول أكلة</strong><p>دوّر فوق على أي أكلة أو اكتب اسم الأكلة.</p></div>`;
    }
  }
  root.innerHTML = html;
}

function renderSearch(focus = true) {
  ctx.mode = 'search';
  ctx.selected = null;
  updateHeader();
  const body = BODY();
  body.innerHTML = `
    <div class="food-search">
      ${icon('search')}
      <input id="food-search-input" type="search" placeholder="دوّر: كشري، فراخ، شوفان…" value="${esc(ctx.query)}" autocomplete="off" aria-label="بحث عن أكلة">
      <button type="button" class="clear-search" id="clear-search" aria-label="مسح البحث">${icon('x')}</button>
    </div>
    <div class="chip-row" role="tablist" aria-label="تصنيفات الأكل">
      ${CATEGORIES.map((category) => `<button class="chip${category === ctx.category ? ' is-active' : ''}" type="button" data-category="${esc(category)}" role="tab" aria-selected="${category === ctx.category}">${esc(category)}</button>`).join('')}
    </div>
    <div id="food-results" class="food-results"></div>
    <div class="food-dialog-foot">
      <div class="btn-row">
        <button class="btn btn-soft" type="button" id="open-custom-food">${icon('plus')} أكلة مخصصة</button>
        <button class="btn btn-soft" type="button" id="open-ai-food">${icon('camera')} حلّل صورة</button>
      </div>
    </div>`;

  renderResults();

  const input = document.getElementById('food-search-input');
  input?.addEventListener('input', () => {
    ctx.query = input.value;
    updateHeader();
    renderResults();
    document.getElementById('clear-search')?.classList.toggle('is-visible', Boolean(ctx.query));
  });
  document.getElementById('clear-search')?.addEventListener('click', () => {
    ctx.query = '';
    if (input) { input.value = ''; input.focus(); }
    updateHeader();
    renderResults();
    document.getElementById('clear-search')?.classList.remove('is-visible');
  });
  document.querySelectorAll('[data-category]').forEach((button) => {
    button.addEventListener('click', () => {
      ctx.category = button.dataset.category;
      renderSearch(false);
      document.getElementById('food-search-input')?.focus({ preventScroll: true });
    });
  });
  document.getElementById('food-results')?.addEventListener('click', (event) => {
    const row = event.target.closest('[data-food-id]');
    if (!row) return;
    const food = getFoodById(row.dataset.foodId);
    if (food) renderDetail(food);
  });
  document.getElementById('open-custom-food')?.addEventListener('click', renderCustom);
  document.getElementById('open-ai-food')?.addEventListener('click', () => {
    const { date, meal } = ctx;
    closeDialog('food-dialog');
    openAiDialog({ date, meal });
  });
  document.getElementById('clear-search')?.classList.toggle('is-visible', Boolean(ctx.query));

  if (focus) {
    requestAnimationFrame(() => {
      input?.focus({ preventScroll: true });
      input?.select();
    });
  }
}

function detailTotals() {
  const food = ctx.selected;
  const qty = ctx.qty;
  return {
    kcal: Math.round((Number(food?.kcal) || 0) * qty),
    p: round((Number(food?.p) || 0) * qty, 1),
    c: round((Number(food?.c) || 0) * qty, 1),
    f: round((Number(food?.f) || 0) * qty, 1)
  };
}

function refreshDetailTotals() {
  const totals = detailTotals();
  const qty = ctx.qty;
  const food = ctx.selected;
  const kcalEl = document.getElementById('detail-kcal');
  const macrosEl = document.getElementById('detail-macros');
  const qtyEl = document.getElementById('detail-qty');
  const addBtn = document.getElementById('detail-add');
  const grams = food?.grams ? Math.round(food.grams * qty) : null;
  if (kcalEl) kcalEl.textContent = fmt(totals.kcal);
  if (macrosEl) macrosEl.textContent = `بروتين ${fmt(totals.p, 1)}جم · كارب ${fmt(totals.c, 1)}جم · دهون ${fmt(totals.f, 1)}جم`;
  if (qtyEl && qtyEl.value !== String(qty)) qtyEl.value = String(qty);
  const gramsEl = document.getElementById('detail-grams');
  if (gramsEl) gramsEl.textContent = grams ? `≈ ${fmt(grams)} جم` : '';
  if (addBtn) addBtn.innerHTML = `${icon('plus')} أضف لـ${mealName(ctx.meal)} · ${fmt(totals.kcal)} سعرة`;
}

function renderDetail(food, { keepQty = false } = {}) {
  ctx.mode = 'detail';
  ctx.selected = food;
  if (!keepQty) ctx.qty = 1;
  updateHeader();
  const favorite = getState().favorites.includes(food.id);
  const totals = detailTotals();
  const grams = food.grams ? Math.round(food.grams * ctx.qty) : null;
  const body = BODY();
  body.innerHTML = `
    <button type="button" class="back-link" id="detail-back">${icon('chevron-right')} رجع للبحث</button>
    <div class="food-detail-card">
      ${foodThumb(food)}
      <div class="food-detail-info">
        <strong>${esc(food.name)}</strong>
        <span>${esc(food.portion)}${food.en ? ` · ${esc(food.en)}` : ''}</span>
        <div class="food-detail-tags">
          <span class="tag">${esc(food.cat || 'أكل')}</span>
          ${food.barcode ? '<span class="tag tag-info">باركود</span>' : ''}
        </div>
      </div>
      <button class="fav-btn${favorite ? ' is-active' : ''}" type="button" id="detail-fav" aria-label="${favorite ? 'شيل من المفضلة' : 'ضيف للمفضلة'}" aria-pressed="${favorite}">${icon('star')}</button>
    </div>

    <div class="food-detail-total">
      <div><strong id="detail-kcal">${fmt(totals.kcal)}</strong><span>سعرة</span></div>
      <p id="detail-macros">بروتين ${fmt(totals.p, 1)}جم · كارب ${fmt(totals.c, 1)}جم · دهون ${fmt(totals.f, 1)}جم</p>
      <small id="detail-grams">${grams ? `≈ ${fmt(grams)} جم` : ''}</small>
    </div>

    <div class="qty-card">
      <div class="qty-card-head"><span>الكمية</span><small>${esc(food.portion)}</small></div>
      <div class="qty-control">
        <button type="button" data-step="-0.5" aria-label="أقل">${icon('minus')}</button>
        <input id="detail-qty" type="number" inputmode="decimal" min="0.5" max="20" step="0.5" value="${ctx.qty}" aria-label="عدد الحصص">
        <button type="button" data-step="0.5" aria-label="أكثر">${icon('plus')}</button>
      </div>
      <div class="qty-presets">
        ${[0.5, 1, 1.5, 2].map((qty) => `<button type="button" data-qty="${qty}" class="${qty === ctx.qty ? 'is-active' : ''}">${qty} حصة</button>`).join('')}
      </div>
    </div>

    <label class="field meal-select">الوجبة
      <select id="detail-meal">
        ${MEALS.map((meal) => `<option value="${meal.id}" ${meal.id === ctx.meal ? 'selected' : ''}>${meal.name}</option>`).join('')}
      </select>
    </label>

    <button class="btn btn-primary btn-block btn-lg" id="detail-add" type="button">${icon('plus')} أضف لـ${mealName(ctx.meal)} · ${fmt(totals.kcal)} سعرة</button>
    <p class="fine-print">القيم تقديرية ومحسوبة على حسب الحصة اللي فوق.</p>`;

  document.getElementById('detail-back')?.addEventListener('click', () => renderSearch(false));
  document.getElementById('detail-fav')?.addEventListener('click', (event) => {
    toggleFavorite(food.id);
    const active = getState().favorites.includes(food.id);
    event.currentTarget.classList.toggle('is-active', active);
    event.currentTarget.setAttribute('aria-pressed', String(active));
    event.currentTarget.setAttribute('aria-label', active ? 'شيل من المفضلة' : 'ضيف للمفضلة');
    toast(active ? 'اتضافت للمفضلة' : 'اتشالت من المفضلة', { type: 'info', duration: 1800 });
  });

  document.querySelectorAll('#food-dialog [data-step]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = Math.max(0.5, Math.min(20, ctx.qty + Number(button.dataset.step)));
      ctx.qty = Math.round(next * 2) / 2;
      document.querySelectorAll('[data-qty]').forEach((preset) => preset.classList.toggle('is-active', Number(preset.dataset.qty) === ctx.qty));
      refreshDetailTotals();
    });
  });
  document.querySelectorAll('[data-qty]').forEach((button) => {
    button.addEventListener('click', () => {
      ctx.qty = Number(button.dataset.qty);
      document.querySelectorAll('[data-qty]').forEach((preset) => preset.classList.toggle('is-active', preset === button));
      refreshDetailTotals();
    });
  });
  document.getElementById('detail-qty')?.addEventListener('input', (event) => {
    const value = Number(event.target.value);
    if (Number.isFinite(value) && value >= 0.1) {
      ctx.qty = Math.min(20, Math.max(0.1, Math.round(value * 10) / 10));
      refreshDetailTotals();
    }
  });
  document.getElementById('detail-meal')?.addEventListener('change', (event) => {
    ctx.meal = event.target.value;
    updateHeader();
    refreshDetailTotals();
  });
  document.getElementById('detail-add')?.addEventListener('click', () => {
    const date = ctx.date;
    const meal = ctx.meal;
    const entry = addFood(date, meal, food, ctx.qty);
    closeDialog('food-dialog');
    navigator.vibrate?.(12);
    toast(`${food.name} اتضافت لـ${mealName(meal)} · ${fmt(entry.kcal)} سعرة`, {
      action: {
        label: 'تراجع',
        onClick: () => {
          removeFood(date, meal, entry.id);
          toast('الوجبة اتشالت', { type: 'info', duration: 1800 });
        }
      },
      duration: 4600
    });
  });
}

function renderCustom() {
  ctx.mode = 'custom';
  ctx.selected = null;
  updateHeader();
  BODY().innerHTML = `
    <button type="button" class="back-link" id="custom-back">${icon('chevron-right')} رجع للبحث</button>
    <form id="custom-food-form" class="stack">
      <label class="field">اسم الأكلة
        <input name="name" type="text" maxlength="60" placeholder="مثلاً: طاجن بطاطس بالفراخ" required>
      </label>
      <label class="field">وصف الحصة
        <input name="portion" type="text" maxlength="60" placeholder="طبق / كوب / 100 جم">
      </label>
      <div class="form-grid">
        <label class="field">سعرات
          <input name="kcal" type="number" min="0" max="5000" step="1" placeholder="0" required>
        </label>
        <label class="field">بروتين (جم)
          <input name="p" type="number" min="0" max="500" step="0.1" placeholder="0">
        </label>
        <label class="field">كارب (جم)
          <input name="c" type="number" min="0" max="500" step="0.1" placeholder="0">
        </label>
        <label class="field">دهون (جم)
          <input name="f" type="number" min="0" max="500" step="0.1" placeholder="0">
        </label>
      </div>
      <div class="qty-card">
        <div class="qty-card-head"><span>الوجبة</span></div>
        <select id="custom-meal">
          ${MEALS.map((meal) => `<option value="${meal.id}" ${meal.id === ctx.meal ? 'selected' : ''}>${meal.name}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-primary btn-block" type="submit">${icon('check')} احفظ الأكلة</button>
      <p class="fine-print">هتتحفظ في «أكلاتي» وتقدر تستخدمها في أي وقت.</p>
    </form>`;

  document.getElementById('custom-back')?.addEventListener('click', () => renderSearch(false));
  document.getElementById('custom-meal')?.addEventListener('change', (event) => { ctx.meal = event.target.value; updateHeader(); });
  document.getElementById('custom-food-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    try {
      const food = addCustomFood(data);
      toast('الأكلة اتحفظت في أكلاتي', { type: 'success', duration: 1800 });
      renderDetail(food);
    } catch (error) {
      toast(error.message, { type: 'error' });
    }
  });
}

export function initFoodDialog() {
  document.getElementById('food-scan')?.addEventListener('click', () => {
    openScanner((food) => {
      if (!food) return;
      renderDetail(food);
    });
  });

  const dialog = document.getElementById('food-dialog');
  dialog?.addEventListener('close', () => {
    ctx = { date: '', meal: 'breakfast', query: '', category: 'الكل', selected: null, qty: 1, mode: 'search' };
    const body = BODY();
    if (body) body.replaceChildren();
  });
}

export function openFoodDialog({ date, meal = 'breakfast', food = null } = {}) {
  const state = getState();
  ctx = {
    date: date || todayKey(),
    meal,
    query: '',
    category: 'الكل',
    selected: null,
    qty: 1,
    mode: 'search'
  };
  if (!MEALS.some((item) => item.id === ctx.meal)) ctx.meal = 'breakfast';
  const dialog = document.getElementById('food-dialog');
  if (!dialog) return;
  openDialog(dialog);
  if (food) renderDetail(food);
  else renderSearch(true);
  if (state.onboardingDone === false) {
    // أول استخدام: الحساب لسه افتراضي، لكن الإضافة تظل متاحة.
    toast('تقدر تظبط هدفك من صفحة «حسابي» في أي وقت', { type: 'info', duration: 2600 });
  }
}
