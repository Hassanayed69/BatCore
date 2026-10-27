import {
  addWeight,
  exportJSON,
  getProfile,
  getSettings,
  getState,
  getTarget,
  importJSON,
  resetAll,
  saveProfile,
  setTheme
} from '../core/store.js';
import {
  ACTIVITIES,
  GOALS,
  PACES,
  bmiInfo,
  fmt,
  macroPercents
} from '../core/calc.js';
import { todayKey } from '../core/dates.js';
import {
  AI_KEY_URL,
  AI_MODEL_LABEL,
  aiReady,
  clearAiKey,
  clearAiProxy,
  getAiProxy,
  hasAiKey,
  maskAiKey,
  saveAiKey,
  saveAiProxy,
  testAiConnection
} from '../services/ai.js';
import { openOnboarding } from './onboarding.js';
import { esc, icon, toast } from './dom.js';

const option = (value, label, selected) => `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(label)}</option>`;

function profileHero(profile, target) {
  const initial = (profile.name || 'B').trim().charAt(0).toUpperCase();
  const bmi = bmiInfo(profile.weight, profile.height);
  return `<section class="card profile-hero">
    <div class="profile-avatar">${esc(initial)}</div>
    <div class="profile-hero-main">
      <p class="eyebrow">حسابك في BatCORE</p>
      <h2>${esc(profile.name || 'صديق BatCORE')}</h2>
      <div class="profile-tags">
        <span class="badge badge-accent">${icon('target')} ${esc(GOALS[profile.goal]?.label || 'ثبات')}</span>
        <span class="badge badge-muted">${esc(ACTIVITIES[profile.activity]?.label || 'نشاط متوسط')}</span>
        <span class="badge badge-muted">${icon('flame')} ${fmt(target.kcal)} سعرة/يوم</span>
      </div>
    </div>
    <div class="profile-quick">
      <div><span>الوزن</span><strong>${profile.weight} <small>كجم</small></strong></div>
      <div><span>الطول</span><strong>${profile.height} <small>سم</small></strong></div>
      <div><span>BMI</span><strong class="${bmi.tone}">${bmi.value}</strong></div>
    </div>
  </section>`;
}

function profileForm(profile) {
  return `<article class="card form-card">
    <header class="card-head"><div><p class="eyebrow">بياناتك الأساسية</p><h3>عدّل حسابك</h3></div><span class="badge badge-muted">${icon('edit')} قابل للتعديل</span></header>
    <form id="profile-form" class="stack">
      <div class="form-grid">
        <label class="field wide-field">الاسم
          <input name="name" type="text" maxlength="40" value="${esc(profile.name)}" placeholder="اسمك">
        </label>
        <label class="field">النوع
          <select name="sex">
            ${option('male', 'ذكر', profile.sex)}
            ${option('female', 'أنثى', profile.sex)}
          </select>
        </label>
        <label class="field">السن
          <input name="age" type="number" min="14" max="90" value="${profile.age}" required>
        </label>
        <label class="field">الطول (سم)
          <input name="height" type="number" min="120" max="230" value="${profile.height}" required>
        </label>
        <label class="field">الوزن (كجم)
          <input name="weight" type="number" min="30" max="300" step="0.1" value="${profile.weight}" required>
        </label>
        <label class="field wide-field">مستوى النشاط
          <select name="activity">
            ${Object.entries(ACTIVITIES).map(([key, item]) => option(key, `${item.label} — ${item.hint}`, profile.activity)).join('')}
          </select>
        </label>
        <label class="field">هدفك
          <select name="goal">
            ${Object.entries(GOALS).map(([key, item]) => option(key, `${item.label} — ${item.hint}`, profile.goal)).join('')}
          </select>
        </label>
        <label class="field">سرعة التغيير
          <select name="pace">
            ${Object.entries(PACES).map(([key, item]) => option(key, `${item.label} — ${item.kg} كجم/أسبوع`, profile.pace)).join('')}
          </select>
        </label>
      </div>
      <button class="btn btn-primary btn-block" type="submit">${icon('check')} احفظ التعديلات واحسب من جديد</button>
      <p class="fine-print">أي تعديل في الوزن أو النشاط بيحدّث هدف السعرات والماكروز فوراً.</p>
    </form>
  </article>`;
}

function targetsCard(target, profile) {
  const macros = macroPercents(target);
  const delta = target.delta;
  const deltaText = delta < 0 ? `عجز ${fmt(Math.abs(delta))} سعرة` : delta > 0 ? `زيادة ${fmt(delta)} سعرة` : 'ثبات';
  return `<article class="card targets-card">
    <header class="card-head"><div><p class="eyebrow">محسوب بمعادلة Mifflin-St Jeor</p><h3>هدفك اليومي</h3></div><span class="badge badge-success">${esc(deltaText)}</span></header>
    <div class="target-kcal"><strong>${fmt(target.kcal)}</strong><span>سعرة / يوم</span></div>
    <div class="energy-grid">
      <div><span>BMR</span><strong>${fmt(target.bmr)}</strong><small>سعرة أساسية</small></div>
      <div><span>TDEE</span><strong>${fmt(target.tdee)}</strong><small>حرق يومي</small></div>
      <div><span>المية</span><strong>${(target.water / 1000).toFixed(1)}</strong><small>لتر/يوم</small></div>
    </div>

    <div class="macro-split">
      <div class="split-bar" role="img" aria-label="توزيع الماكروز: بروتين ${macros.p}%، كارب ${macros.c}%، دهون ${macros.f}%">
        <span class="split-p" style="width:${macros.p}%"></span>
        <span class="split-c" style="width:${macros.c}%"></span>
        <span class="split-f" style="width:${macros.f}%"></span>
      </div>
      <div class="macro-legend">
        <div><i class="dot dot-p"></i><span>بروتين</span><strong>${target.protein} جم <small>${macros.p}%</small></strong></div>
        <div><i class="dot dot-c"></i><span>كارب</span><strong>${target.carbs} جم <small>${macros.c}%</small></strong></div>
        <div><i class="dot dot-f"></i><span>دهون</span><strong>${target.fat} جم <small>${macros.f}%</small></strong></div>
      </div>
    </div>

    <div class="bmi-box">
      <div class="bmi-head"><div><span>مؤشر كتلة الجسم</span><strong>${bmiInfo(profile.weight, profile.height).value}</strong></div><span class="badge ${bmiInfo(profile.weight, profile.height).tone === 'good' ? 'badge-success' : 'badge-warn'}">${esc(bmiInfo(profile.weight, profile.height).label)}</span></div>
      <div class="bmi-track"><span class="bmi-marker" style="inset-inline-start:${Math.max(2, Math.min(98, ((bmiInfo(profile.weight, profile.height).value - 15) / 25) * 100))}%"></span></div>
      <div class="bmi-labels"><span>15</span><span>18.5</span><span>25</span><span>30</span><span>40</span></div>
    </div>
  </article>`;
}

function aiSettingsCard() {
  const key = hasAiKey();
  const proxy = getAiProxy();
  const ready = aiReady();
  return `<article class="card settings-card ai-settings">
    <header class="card-head">
      <div><p class="eyebrow">اختياري · ${AI_MODEL_LABEL}</p><h3>تحليل الأكل بالصورة</h3></div>
      <span class="badge ${ready ? 'badge-success' : 'badge-muted'}">${ready ? `${icon('check')} جاهز` : 'مش مفعّل'}</span>
    </header>
    <p class="settings-lead">صوّر الطبق وأضفه ليومك في خطوة واحدة. التحليل بيشتغل بمفتاحك الشخصي من Google AI Studio.</p>
    <form id="ai-key-setting-form" class="ai-key-form">
      <label class="field">مفتاح Gemini API
        <input id="ai-key-setting" type="password" dir="ltr" autocomplete="off" spellcheck="false" placeholder="${key ? esc(maskAiKey()) : 'AIza...'}" aria-label="مفتاح Gemini API">
      </label>
      <div class="btn-row">
        <button class="btn btn-primary btn-sm" type="submit">${icon('check')} حفظ</button>
        <button class="btn btn-soft btn-sm" type="button" id="ai-key-test" ${ready ? '' : 'disabled'}>${icon('bolt')} اختبار</button>
        ${key ? `<button class="btn btn-ghost btn-sm danger-text" type="button" id="ai-key-remove">${icon('trash')} مسح</button>` : ''}
      </div>
    </form>
    <div class="ai-key-state">
      <span class="ai-key-dot${ready ? ' is-on' : ''}" aria-hidden="true"></span>
      <div>
        <strong>${key ? 'مفتاح محفوظ على الجهاز' : proxy ? 'سيرفر وسيط محفوظ' : 'مفيش مفتاح لسه'}</strong>
        <small>${key ? `${esc(maskAiKey())} · مش بيتحفظ في نسخة الاحتياطي` : proxy ? esc(proxy) : 'ضيف مفتاحك عشان تقدر تحلل الصور'}</small>
      </div>
      <a class="link-btn" href="${AI_KEY_URL}" target="_blank" rel="noopener noreferrer">جيب مفتاح</a>
    </div>
    <details class="ai-advanced">
      <summary>إعداد متقدم — سيرفر وسيط (proxy)</summary>
      <p class="fine-print">لو نشرت التطبيق للعامة، متحطش المفتاح في المتصفح. حط عنوان سيرفرك هنا وهو اللي هيضيف المفتاح ويبعته لـ Gemini.</p>
      <label class="field">عنوان السيرفر
        <input id="ai-proxy-setting" type="url" dir="ltr" placeholder="https://your-proxy.example.com/gemini" value="${esc(proxy)}" aria-label="عنوان السيرفر الوسيط">
      </label>
      <div class="btn-row">
        <button class="btn btn-soft btn-sm" type="button" id="ai-proxy-save">${icon('check')} حفظ العنوان</button>
        ${proxy ? `<button class="btn btn-ghost btn-sm" type="button" id="ai-proxy-clear">${icon('trash')} مسح</button>` : ''}
      </div>
    </details>
    <p class="fine-print">${icon('lock')} المفتاح متخزن محلياً باسم batcore.ai.key، ومش بيتبعت لأي جهة غير Google. الطلبات مباشرة من متصفحك.</p>
  </article>`;
}

function settingsCard() {
  const settings = getSettings();
  return `<article class="card settings-card">
    <header class="card-head"><div><p class="eyebrow">التحكم</p><h3>الإعدادات والبيانات</h3></div></header>
    <div class="setting-row">
      <div><strong>المظهر</strong><small>فاتح، غامق، أو حسب نظام جهازك</small></div>
      <div class="segmented" role="group" aria-label="المظهر">
        <button type="button" data-theme-choice="auto" class="${settings.theme === 'auto' ? 'is-active' : ''}">تلقائي</button>
        <button type="button" data-theme-choice="light" class="${settings.theme === 'light' ? 'is-active' : ''}">${icon('sun')} فاتح</button>
        <button type="button" data-theme-choice="dark" class="${settings.theme === 'dark' ? 'is-active' : ''}">${icon('moon')} غامق</button>
      </div>
    </div>
    <div class="setting-row">
      <div><strong>نسخة احتياطية</strong><small>كل بياناتك محفوظة على جهازك فقط. نزّل نسخة قبل أي تغيير كبير.</small></div>
      <div class="setting-actions">
        <button type="button" class="btn btn-soft btn-sm" id="export-data">${icon('download')} تنزيل</button>
        <button type="button" class="btn btn-soft btn-sm" id="import-data">${icon('upload')} استيراد</button>
        <input type="file" id="import-file" accept="application/json,.json" hidden>
      </div>
    </div>
    <div class="setting-row danger-row">
      <div><strong>مسح كل البيانات</strong><small>هيمسح الأكل، التمارين، الوزن، والإعدادات. مفيش رجوع.</small></div>
      <button type="button" class="btn btn-danger btn-sm" id="reset-data">${icon('trash')} مسح الكل</button>
    </div>
  </article>`;
}

function bind(root) {
  const form = root.querySelector('#profile-form');
  const pace = form?.elements.pace;
  form?.elements.goal?.addEventListener('change', (event) => {
    if (pace) pace.disabled = event.target.value === 'maintain';
  });
  if (form?.elements.goal?.value === 'maintain' && pace) pace.disabled = true;

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const previous = getProfile();
    const profile = {
      name: String(data.name || '').trim(),
      sex: data.sex === 'female' ? 'female' : 'male',
      age: Number(data.age),
      height: Number(data.height),
      weight: Number(data.weight),
      activity: data.activity,
      goal: data.goal,
      pace: data.pace || previous.pace || 'moderate'
    };
    if (!profile.age || !profile.height || !profile.weight) {
      toast('راجع بياناتك — في حقل ناقص', { type: 'error' });
      return;
    }
    saveProfile(profile);
    if (Number(previous.weight) !== Number(profile.weight)) {
      addWeight(profile.weight, todayKey());
    }
    toast('تم تحديث بياناتك وحساب هدفك من جديد', { type: 'success' });
  });

  root.querySelectorAll('[data-theme-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      setTheme(button.dataset.themeChoice);
      toast('تم تغيير المظهر', { type: 'info', duration: 1500 });
    });
  });

  root.querySelector('#export-data')?.addEventListener('click', () => {
    const blob = new Blob([exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `batcore-backup-${todayKey()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('نزّلنا نسخة من بياناتك', { type: 'success' });
  });

  root.querySelector('#import-data')?.addEventListener('click', () => {
    root.querySelector('#import-file')?.click();
  });

  root.querySelector('#import-file')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      importJSON(text);
      toast('تم استيراد البيانات بنجاح', { type: 'success' });
    } catch (error) {
      toast(error.message || 'الملف غير صالح', { type: 'error' });
    }
  });

  root.querySelector('#reset-data')?.addEventListener('click', () => {
    if (!window.confirm('هتمسح كل بياناتك نهائياً (أكل، تمارين، وزن، إعدادات). متأكد؟')) return;
    resetAll();
    openOnboarding();
    toast('تم مسح كل البيانات — بداية جديدة', { type: 'info', duration: 3000 });
  });

  root.querySelector('#ai-key-setting-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      saveAiKey(root.querySelector('#ai-key-setting')?.value || '');
      toast('المفتاح اتحفظ على جهازك — جاهزين نحلل الصور', { type: 'success' });
      renderProfile();
    } catch (error) {
      toast(error.message || 'المفتاح غير صالح', { type: 'error' });
    }
  });

  root.querySelector('#ai-key-test')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `${icon('bolt')} بنختبر…`;
    try {
      await testAiConnection();
      toast('المفتاح شغال — جاهزين نحلل صور', { type: 'success' });
    } catch (error) {
      toast(error.message || 'المفتاح مش شغال', { type: 'error', duration: 5200 });
    } finally {
      button.disabled = false;
      button.innerHTML = original;
    }
  });

  root.querySelector('#ai-key-remove')?.addEventListener('click', () => {
    if (!window.confirm('هتمسح مفتاح Gemini من الجهاز. تقدر تضيفه تاني في أي وقت. تمام؟')) return;
    clearAiKey();
    toast('المفتاح اتمسح من الجهاز', { type: 'info' });
    renderProfile();
  });

  root.querySelector('#ai-proxy-save')?.addEventListener('click', () => {
    try {
      saveAiProxy(root.querySelector('#ai-proxy-setting')?.value || '');
      toast('عنوان السيرفر اتحفظ', { type: 'success' });
      renderProfile();
    } catch (error) {
      toast(error.message || 'العنوان غير صالح', { type: 'error' });
    }
  });

  root.querySelector('#ai-proxy-clear')?.addEventListener('click', () => {
    clearAiProxy();
    toast('عنوان السيرفر اتمسح', { type: 'info' });
    renderProfile();
  });
}

export function renderProfile() {
  const root = document.getElementById('view-profile');
  if (!root) return;
  const state = getState();
  const profile = getProfile();
  const target = getTarget();

  root.innerHTML = `<div class="profile-page">
    <header class="page-head"><div><p class="eyebrow">إعداداتك الشخصية</p><h2>حسابي</h2></div></header>
    ${profileHero(profile, target)}
    <div class="profile-layout">
      ${profileForm(profile)}
      ${targetsCard(target, profile)}
    </div>
    ${settingsCard()}
    ${aiSettingsCard()}
    <div class="disclaimer">
      ${icon('info')}
      <p><strong>تنبيه مهم:</strong> BatCORE أداة تقديرية للمساعدة في المتابعة، ومش بديل عن استشارة طبيب أو أخصائي تغذية. لو عندك حالة صحية أو بتاخد أدوية، راجع مختص قبل تغيير نظامك.</p>
    </div>
    <p class="fine-print">البيانات محفوظة محلياً على جهازك في المتصفح${state.profile.name ? `، ${esc(state.profile.name)}` : ''}.</p>
  </div>`;

  bind(root);
}
