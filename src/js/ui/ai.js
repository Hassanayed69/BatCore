import { MEALS, addFood, removeFood } from '../core/store.js';
import { fmt, round } from '../core/calc.js';
import { relativeDay, todayKey } from '../core/dates.js';
import {
  AI_KEY_URL,
  AI_MODEL_LABEL,
  AiError,
  aiReady,
  analyzeFoodPhoto,
  hasAiKey,
  isImageFile,
  saveAiKey
} from '../services/ai.js';
import { closeDialog, esc, icon, openDialog, toast } from './dom.js';

const BODY = () => document.getElementById('ai-body');
const KICKER = () => document.getElementById('ai-kicker');
const TITLE = () => document.getElementById('ai-title');

let ctx = emptyCtx();
let controller = null;

const mealName = (id) => MEALS.find((meal) => meal.id === id)?.name || 'وجبة';

function emptyCtx() {
  return {
    date: todayKey(),
    meal: 'breakfast',
    file: null,
    previewUrl: '',
    status: 'idle',
    result: null,
    error: ''
  };
}

export function suggestMeal(hour = new Date().getHours()) {
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snacks';
}

function releasePreview() {
  if (ctx.previewUrl) URL.revokeObjectURL(ctx.previewUrl);
  ctx.previewUrl = '';
}

function setFile(file) {
  if (!file) return;
  if (!isImageFile(file)) {
    toast('اختار صورة (JPG أو PNG) مش ملف تاني', { type: 'error' });
    return;
  }
  releasePreview();
  ctx.file = file;
  ctx.previewUrl = URL.createObjectURL(file);
  ctx.status = 'idle';
  ctx.result = null;
  ctx.error = '';
  render();
}

function confidenceTone(value) {
  if (value >= 75) return 'ai-confidence-high';
  if (value >= 50) return 'ai-confidence-mid';
  return 'ai-confidence-low';
}

function updateHeader() {
  const kicker = KICKER();
  if (kicker) kicker.textContent = `${mealName(ctx.meal)} · ${relativeDay(ctx.date)}`;
  const title = TITLE();
  if (title) title.textContent = ctx.status === 'result' ? 'راجع النتيجة' : 'صوّر أكلك';
}

/* ------------------------------------------------------------------ الشاشات */

function keyGate() {
  return `<div class="ai-gate">
    <span class="ai-gate-icon">${icon('key')}</span>
    <h3>محتاج مفتاح Gemini</h3>
    <p>تحليل صورة الأكل شغال على <strong>${AI_MODEL_LABEL}</strong>. المفتاح بيتحفظ على جهازك بس، ومش بيتحفظ في نسخة الاحتياطي ولا بيتبعت لأي مكان غير Google.</p>
    <form id="ai-key-form" class="stack">
      <label class="field">مفتاح Gemini API
        <input id="ai-key-input" type="password" dir="ltr" autocomplete="off" spellcheck="false" placeholder="AIza..." aria-label="مفتاح Gemini API">
      </label>
      <button class="btn btn-primary btn-block" type="submit">${icon('check')} حفظ وابدأ</button>
    </form>
    <div class="ai-gate-links">
      <a class="link-btn" href="${AI_KEY_URL}" target="_blank" rel="noopener noreferrer">إزاي أجيب مفتاح مجاني؟</a>
      <button class="link-btn" type="button" id="ai-open-settings">إعدادات متقدمة</button>
    </div>
    <p class="fine-print">${icon('info')} مفتاحك شخصي — متشاركوش مع حد. لو التطبيق اتنشر للعامة، استخدم سيرفر وسيط من «حسابي» بدل ما تحط المفتاح في المتصفح.</p>
  </div>`;
}

function setupView() {
  const hasFile = Boolean(ctx.file);
  return `
    ${ctx.error ? `<div class="ai-alert" role="alert">${icon('info')}<p>${esc(ctx.error)}</p></div>` : ''}
    ${hasFile
      ? `<div class="ai-preview">
          <img src="${ctx.previewUrl}" alt="الصورة المختارة للتحليل">
          <button class="icon-btn icon-btn-xs ai-preview-x" type="button" id="ai-clear" aria-label="شيل الصورة">${icon('x')}</button>
        </div>`
      : `<label class="ai-drop" id="ai-drop">
          <input id="ai-file" type="file" accept="image/*" hidden>
          <span class="ai-drop-icon">${icon('camera')}</span>
          <strong>اختار صورة الطبق</strong>
          <small>اضغط هنا أو اسحب الصورة · JPG / PNG · حتى 12 ميجا</small>
        </label>
        <label class="btn btn-soft btn-block ai-camera-btn">
          ${icon('camera')} صوّر بالكاميرا
          <input id="ai-camera" type="file" accept="image/*" capture="environment" hidden>
        </label>`}
    <button class="btn btn-primary btn-block btn-lg" id="ai-analyze" type="button" ${hasFile ? '' : 'disabled'}>
      ${icon('bolt')} ${hasFile ? 'حلّل الصورة' : 'اختار صورة الأول'}
    </button>
    <ul class="ai-tips">
      <li>${icon('check')} صوّر الطبق كله من فوق وبإضاءة كويسة</li>
      <li>${icon('check')} حط حاجة معروفة جنبه لو عايز تقدير أدق للحجم</li>
      <li>${icon('check')} الأرقام تقديرية — راجعها قبل ما تضيف</li>
    </ul>
    <p class="fine-print">${icon('info')} الصورة بتتبعت لـ Google Gemini للتحليل بس، ومش بتتحفظ عندنا.</p>`;
}

function analyzingView() {
  return `<div class="ai-working" role="status" aria-live="polite">
    ${ctx.previewUrl ? `<img class="ai-working-shot" src="${ctx.previewUrl}" alt="">` : ''}
    <span class="ai-spinner" aria-hidden="true"></span>
    <strong>بنحلل الصورة…</strong>
    <p>بنحاول نعرف المكونات والحصة والسعرات. غالباً بياخد 3–6 ثواني.</p>
    <button class="btn btn-soft btn-sm" type="button" id="ai-cancel">إلغاء</button>
  </div>`;
}

function resultView() {
  const result = ctx.result;
  const confidence = result.confidence
    ? `<span class="tag ai-confidence ${confidenceTone(result.confidence)}">ثقة ${result.confidence}%</span>`
    : '';
  const items = result.items.length
    ? `<div class="ai-items">
        <p class="results-title">المكونات اللي اتعرّفت عليها</p>
        ${result.items.map((item) => `<div class="ai-item">
          <span>${esc(item.name)}</span>
          <small>${item.grams ? `${fmt(item.grams)} جم` : ''}${item.grams && item.kcal ? ' · ' : ''}${item.kcal ? `${fmt(item.kcal)} سعرة` : ''}</small>
        </div>`).join('')}
      </div>`
    : '';

  return `
    <button class="back-link" type="button" id="ai-again">${icon('chevron-right')} صورة تانية</button>
    <div class="ai-result-top">
      ${ctx.previewUrl ? `<img class="ai-shot" src="${ctx.previewUrl}" alt="">` : ''}
      <div class="ai-result-info">
        <strong>${esc(result.name)}</strong>
        ${result.en ? `<span dir="ltr">${esc(result.en)}</span>` : ''}
        <div class="ai-tags">
          ${confidence}
          ${result.grams ? `<span class="tag">≈ ${fmt(result.grams)} جم</span>` : ''}
        </div>
      </div>
    </div>
    ${items}
    ${result.note ? `<p class="ai-note">${icon('info')} ${esc(result.note)}</p>` : ''}
    <form id="ai-result-form" class="stack">
      <div class="form-grid">
        <label class="field wide-field">الاسم بالعربي
          <input name="name" type="text" maxlength="60" required value="${esc(result.name)}">
        </label>
        <label class="field wide-field">الاسم بالإنجليزي
          <input name="en" type="text" maxlength="60" dir="ltr" value="${esc(result.en)}">
        </label>
        <label class="field">وصف الحصة
          <input name="portion" type="text" maxlength="60" value="${esc(result.portion)}">
        </label>
        <label class="field">الوزن (جم)
          <input name="grams" type="number" min="0" max="3000" step="1" value="${result.grams || ''}">
        </label>
        <label class="field">سعرات
          <input name="kcal" type="number" min="0" max="5000" step="1" required value="${result.kcal}">
        </label>
        <label class="field">بروتين (جم)
          <input name="p" type="number" min="0" max="500" step="0.1" value="${result.p}">
        </label>
        <label class="field">كارب (جم)
          <input name="c" type="number" min="0" max="500" step="0.1" value="${result.c}">
        </label>
        <label class="field">دهون (جم)
          <input name="f" type="number" min="0" max="500" step="0.1" value="${result.f}">
        </label>
      </div>
      <label class="field">الوجبة
        <select name="meal">
          ${MEALS.map((meal) => `<option value="${meal.id}" ${meal.id === ctx.meal ? 'selected' : ''}>${esc(meal.name)}</option>`).join('')}
        </select>
      </label>
      <button class="btn btn-primary btn-block btn-lg" id="ai-add" type="submit">${icon('plus')} ضيف على ${mealName(ctx.meal)} · ${fmt(result.kcal)} سعرة</button>
      <p class="fine-print">${icon('info')} الأرقام تقديرية من الصورة — عدّلها لو انت عارف الكمية الحقيقية.</p>
    </form>`;
}

/* ------------------------------------------------------------------ الربط */

function bindKeyGate(body) {
  body.querySelector('#ai-key-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.getElementById('ai-key-input');
    try {
      saveAiKey(input?.value || '');
      ctx.status = 'idle';
      ctx.error = '';
      toast('المفتاح اتحفظ على جهازك — جاهزين نحلل', { type: 'success' });
      render();
    } catch (error) {
      toast(error.message || 'المفتاح غير صالح', { type: 'error' });
      input?.focus();
    }
  });
  body.querySelector('#ai-open-settings')?.addEventListener('click', () => {
    closeDialog('ai-dialog');
    document.querySelector('.bottom-nav [data-nav="profile"]')?.click();
  });
}

function bindSetup(body) {
  body.querySelector('#ai-file')?.addEventListener('change', (event) => {
    setFile(event.target.files?.[0]);
    event.target.value = '';
  });
  body.querySelector('#ai-camera')?.addEventListener('change', (event) => {
    setFile(event.target.files?.[0]);
    event.target.value = '';
  });

  const drop = body.querySelector('#ai-drop');
  if (drop) {
    ['dragenter', 'dragover'].forEach((type) => {
      drop.addEventListener(type, (event) => {
        event.preventDefault();
        drop.classList.add('is-over');
      });
    });
    ['dragleave', 'drop'].forEach((type) => {
      drop.addEventListener(type, (event) => {
        event.preventDefault();
        drop.classList.remove('is-over');
      });
    });
    drop.addEventListener('drop', (event) => setFile(event.dataTransfer?.files?.[0]));
  }

  body.querySelector('#ai-clear')?.addEventListener('click', () => {
    releasePreview();
    ctx.file = null;
    ctx.result = null;
    ctx.status = 'idle';
    render();
  });

  body.querySelector('#ai-analyze')?.addEventListener('click', runAnalysis);
}

function bindResult(body) {
  body.querySelector('#ai-again')?.addEventListener('click', () => {
    releasePreview();
    ctx.file = null;
    ctx.result = null;
    ctx.status = 'idle';
    ctx.error = '';
    render();
  });

  const form = body.querySelector('#ai-result-form');
  if (!form) return;

  const refresh = () => {
    const data = new FormData(form);
    const kcal = Math.round(Number(data.get('kcal')) || 0);
    const meal = String(data.get('meal') || ctx.meal);
    ctx.meal = meal;
    const button = form.querySelector('#ai-add');
    if (button) button.innerHTML = `${icon('plus')} ضيف على ${mealName(meal)} · ${fmt(kcal)} سعرة`;
    updateHeader();
  };

  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const name = String(data.name || '').trim() || String(data.en || '').trim();
    const kcal = Math.round(Number(data.kcal) || 0);
    if (!name) {
      toast('اكتب اسم الأكلة الأول', { type: 'error' });
      return;
    }
    if (kcal <= 0) {
      toast('اكتب سعرات صحيحة', { type: 'error' });
      return;
    }

    const date = ctx.date;
    const meal = data.meal || ctx.meal;
    const food = {
      id: `ai-${Date.now().toString(36)}`,
      name,
      en: String(data.en || '').trim(),
      portion: String(data.portion || '').trim() || 'حصة',
      grams: Math.max(0, Math.round(Number(data.grams) || 0)),
      kcal,
      p: Math.max(0, round(Number(data.p) || 0, 1)),
      c: Math.max(0, round(Number(data.c) || 0, 1)),
      f: Math.max(0, round(Number(data.f) || 0, 1)),
      cat: 'تحليل صورة',
      ai: true
    };

    const entry = addFood(date, meal, food, 1);
    closeDialog('ai-dialog');
    navigator.vibrate?.(12);
    toast(`${name} اتضافت على ${mealName(meal)} · ${fmt(entry.kcal)} سعرة`, {
      action: {
        label: 'تراجع',
        onClick: () => {
          removeFood(date, meal, entry.id);
          toast('الأكلة اتشالت', { type: 'info', duration: 1800 });
        }
      },
      duration: 5000
    });
  });
}

/* ------------------------------------------------------------------ الدورة */

function render() {
  const body = BODY();
  if (!body) return;
  updateHeader();

  if (!aiReady()) {
    body.innerHTML = keyGate();
    bindKeyGate(body);
    return;
  }

  if (ctx.status === 'analyzing') {
    body.innerHTML = analyzingView();
    body.querySelector('#ai-cancel')?.addEventListener('click', () => {
      controller?.abort();
      controller = null;
      ctx.status = 'idle';
      render();
    });
    return;
  }

  if (ctx.status === 'result' && ctx.result) {
    body.innerHTML = resultView();
    bindResult(body);
    return;
  }

  body.innerHTML = setupView();
  bindSetup(body);
}

async function runAnalysis() {
  if (!ctx.file || ctx.status === 'analyzing') return;
  controller = new AbortController();
  ctx.status = 'analyzing';
  ctx.error = '';
  render();

  try {
    const result = await analyzeFoodPhoto(ctx.file, { signal: controller.signal });
    if (!BODY() || ctx.status !== 'analyzing') return;
    ctx.result = result;
    ctx.status = 'result';
  } catch (error) {
    if (error?.name === 'AbortError') return;
    ctx.error = error instanceof AiError
      ? error.message
      : 'حصلت مشكلة غير متوقعة. جرّب تاني.';
    ctx.status = 'error';
  } finally {
    controller = null;
  }

  if (BODY()) render();
}

export function openAiDialog({ date, meal } = {}) {
  ctx = emptyCtx();
  ctx.date = date || todayKey();
  ctx.meal = MEALS.some((item) => item.id === meal) ? meal : suggestMeal();
  const dialog = document.getElementById('ai-dialog');
  if (!dialog) return;
  openDialog(dialog);
  render();
}

export function initAiDialog() {
  document.getElementById('ai-dialog')?.addEventListener('close', () => {
    controller?.abort();
    controller = null;
    releasePreview();
    ctx = emptyCtx();
    const body = BODY();
    if (body) body.replaceChildren();
  });
  document.getElementById('ai-dialog')?.addEventListener('cancel', () => {
    controller?.abort();
  });
  if (hasAiKey()) {
    // المفتاح موجود بالفعل — مفيش حاجة نعملها، بس بنبني الشاشة وقت الفتح.
  }
}
