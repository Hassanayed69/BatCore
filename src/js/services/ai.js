import { round } from '../core/calc.js';

/*
 * تحليل صورة الأكل عن طريق Gemini.
 *
 * المفتاح بيتخزن في localStorage تحت مفتاح منفصل عن حالة التطبيق،
 * فمش بيطلع في نسخة الاحتياطي (export) ولا بيتبعت لأي مكان غير Google.
 * لو التطبيق اتنشر للعامة، الأفضل تحدد عنوان سيرفر وسيط (proxy) يحتفظ
 * بالمفتاح على السيرفر بدل المتصفح — نفس الكود بيدعم الاتنين.
 */

const KEY_STORAGE = 'batcore.ai.key';
const PROXY_STORAGE = 'batcore.ai.proxy';
const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_EDGE = 1024;

export const AI_MODEL_LABEL = 'Gemini 2.5 Flash';
export const AI_KEY_URL = 'https://aistudio.google.com/app/apikey';

export class AiError extends Error {
  constructor(message, code = 'unknown') {
    super(message);
    this.name = 'AiError';
    this.code = code;
  }
}

/* ---------------------------------------------------------------- المفتاح */

export function getAiKey() {
  try {
    return (localStorage.getItem(KEY_STORAGE) || '').trim();
  } catch {
    return '';
  }
}

export function hasAiKey() {
  return Boolean(getAiKey());
}

export function isValidKeyFormat(key) {
  return /^AIza[0-9A-Za-z_-]{20,}$/.test(String(key || '').trim());
}

export function saveAiKey(key) {
  const value = String(key || '').trim();
  if (!isValidKeyFormat(value)) {
    throw new AiError('المفتاح شكله مش صح — مفاتيح Gemini بتبدأ بـ AIza وطولها حوالي 39 حرف.', 'bad-key-format');
  }
  try {
    localStorage.setItem(KEY_STORAGE, value);
  } catch {
    throw new AiError('المتصفح رافض يحفظ المفتاح. اتأكد إن التخزين المحلي مش متقفل.', 'storage');
  }
  return value;
}

export function clearAiKey() {
  try {
    localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* تجاهل */
  }
}

export function maskAiKey(key = getAiKey()) {
  if (!key) return '';
  if (key.length <= 12) return `${key.slice(0, 4)}…`;
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

/* ------------------------------------------------------------- السيرفر الوسيط */

export function getAiProxy() {
  try {
    return (localStorage.getItem(PROXY_STORAGE) || '').trim();
  } catch {
    return '';
  }
}

export function hasAiProxy() {
  return Boolean(getAiProxy());
}

export function saveAiProxy(url) {
  const value = String(url || '').trim();
  if (value && !/^https?:\/\/\S+$/i.test(value)) {
    throw new AiError('عنوان السيرفر لازم يبدأ بـ https:// أو http://', 'bad-proxy');
  }
  try {
    if (value) localStorage.setItem(PROXY_STORAGE, value);
    else localStorage.removeItem(PROXY_STORAGE);
  } catch {
    throw new AiError('المتصفح رافض يحفظ الإعداد.', 'storage');
  }
  return value;
}

export function clearAiProxy() {
  try {
    localStorage.removeItem(PROXY_STORAGE);
  } catch {
    /* تجاهل */
  }
}

export const aiReady = () => hasAiKey() || hasAiProxy();

/* ------------------------------------------------------------------ الصور */

export function isImageFile(file) {
  return Boolean(file) && /^image\//i.test(file.type || '');
}

function loadBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file).catch(() => loadViaObjectUrl(file));
  }
  return loadViaObjectUrl(file);
}

function loadViaObjectUrl(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new AiError('المتصفح مش قادر يقرأ الصورة دي. جرّب صورة JPG أو PNG.', 'decode'));
    };
    image.src = url;
  });
}

/**
 * بيصغّر الصورة قبل ما يبعتها عشان يقلل حجم الطلب ووقت الرفع.
 * بيرجّع { mimeType, data } جاهزين لـ Gemini inlineData.
 */
export async function imageToInlineData(file) {
  if (!isImageFile(file)) throw new AiError('الملف اللي اخترته مش صورة.', 'bad-file');
  if (file.size > MAX_IMAGE_BYTES) {
    throw new AiError('الصورة كبيرة أوي (أكتر من 12 ميجا). صوّرها بجودة أقل أو صغّرها وجرّب تاني.', 'bad-file');
  }

  let source;
  try {
    source = await loadBitmap(file);
  } catch (error) {
    if (error instanceof AiError) throw error;
    throw new AiError('المتصفح مش قادر يقرأ الصورة دي. جرّب صورة JPG أو PNG.', 'decode');
  }

  const width = source.width || source.naturalWidth || 0;
  const height = source.height || source.naturalHeight || 0;
  if (!width || !height) {
    if (typeof source.close === 'function') source.close();
    throw new AiError('أبعاد الصورة غير صالحة. جرّب صورة تانية.', 'decode');
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) {
    if (typeof source.close === 'function') source.close();
    throw new AiError('مش قادر أجهّز الصورة للتحليل. جرّب متصفح تاني.', 'canvas');
  }
  context.imageSmoothingQuality = 'high';
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  if (typeof source.close === 'function') source.close();

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  const base64 = dataUrl.split(',')[1] || '';
  if (!base64) throw new AiError('فشل تجهيز الصورة. جرّب صورة تانية.', 'canvas');
  return { mimeType: 'image/jpeg', data: base64 };
}

/* -------------------------------------------------------------- طلب Gemini */

const ANALYSIS_PROMPT = [
  'أنت مساعد تغذية دقيق، بتحلل صور أكل — خصوصاً الأكل المصري والعربي.',
  'حلل الصورة اللي معاك ورجّع تقدير واقعي للطبق كله زي ما هو ظاهر.',
  '',
  'القواعد:',
  '1) لو مفيش أكل واضح في الصورة، خلي isFood=false واكتب سبب قصير في reason.',
  '2) name: اسم عربي طبيعي بالمصري (مثال: «كشري باللحمة»)، و en: اسم إنجليزي قصير.',
  '3) portion: وصف الحصة الظاهرة (مثال: «طبق متوسط»، «ساندوتش»، «كوب 250 مل»).',
  '4) grams: تقدير وزن الحصة كلها بالجرام.',
  '5) kcal: سعرات الحصة كلها (مش لكل 100 جم).',
  '6) protein و carbs و fat: بالجرام للحصة كلها.',
  '7) خلي الأرقام متسقة تقريباً مع 4×بروتين + 4×كارب + 9×دهون.',
  '8) confidence: رقم من 0 لـ 1 بمدى ثقتك في التقدير.',
  '9) items: لو الطبق فيه أكتر من مكوّن، فكّكه لمكونات رئيسية (2–5 عناصر) مع جرام وسعرات تقريبية.',
  '10) note: ملاحظة قصيرة عن أي افتراض عملته (زيت، حجم الحصة، مكونات مخفية) — أو سلسلة فاضية.',
  'ممنوع أي كلام خارج JSON.'
].join('\n');

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    isFood: { type: 'BOOLEAN' },
    reason: { type: 'STRING' },
    en: { type: 'STRING' },
    name: { type: 'STRING' },
    portion: { type: 'STRING' },
    grams: { type: 'NUMBER' },
    kcal: { type: 'NUMBER' },
    protein: { type: 'NUMBER' },
    carbs: { type: 'NUMBER' },
    fat: { type: 'NUMBER' },
    confidence: { type: 'NUMBER' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          grams: { type: 'NUMBER' },
          kcal: { type: 'NUMBER' }
        },
        required: ['name']
      }
    },
    note: { type: 'STRING' }
  },
  required: ['isFood', 'en', 'name', 'portion', 'grams', 'kcal', 'protein', 'carbs', 'fat', 'confidence']
};

function httpMessage(status, payload) {
  const detail = String(payload?.error?.message || '');
  const invalidKey = /api key|credential/i.test(detail);

  if (status === 400 && invalidKey) return 'مفتاح Gemini غير صحيح. راجع المفتاح من «حسابي» وجرّب تاني.';
  if (status === 400) return 'الطلب مش مفهوم من الخدمة. جرّب صورة تانية أو أصغر.';
  if (status === 401 || status === 403) return 'المفتاح مش مفعّل أو الحساب موقوف. اتأكد من Google AI Studio.';
  if (status === 404) return 'الموديل مش متاح على المفتاح ده. حدّث التطبيق أو جرّب مفتاح تاني.';
  if (status === 413) return 'الصورة كبيرة على الخدمة. صوّرها بجودة أقل وجرّب.';
  if (status === 429) return 'وصلت لحد الاستخدام المجاني — استنى دقيقة وجرّب تاني.';
  if (status >= 500) return 'خدمة Gemini مش متاحة دلوقتي. جرّب بعد شوية.';
  return 'حصلت مشكلة في الاتصال بالخدمة. جرّب تاني.';
}

async function callGemini({ parts, generationConfig, signal }) {
  const proxy = getAiProxy();
  const key = getAiKey();
  if (!proxy && !key) {
    throw new AiError('محتاج مفتاح Gemini الأول — تقدر تضيفه من هنا أو من صفحة «حسابي».', 'no-key');
  }

  const headers = { 'Content-Type': 'application/json' };
  if (!proxy) headers['x-goog-api-key'] = key;

  let response;
  try {
    response = await fetch(proxy || ENDPOINT, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.25,
          thinkingConfig: { thinkingBudget: 0 },
          ...generationConfig
        }
      })
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new AiError('مش قادر أوصل لخدمة Gemini. اتأكد من النت وجرّب تاني.', 'network');
  }

  const raw = await response.text();
  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) throw new AiError(httpMessage(response.status, payload), `http-${response.status}`);
  if (!payload) throw new AiError('رد غير متوقع من الخدمة. جرّب تاني.', 'bad-response');
  return payload;
}

function extractText(payload) {
  if (payload?.promptFeedback?.blockReason) {
    throw new AiError('الصورة اترفضت من فلتر الأمان. جرّب صورة تانية.', 'blocked');
  }
  const candidate = payload?.candidates?.[0];
  const text = (candidate?.content?.parts || [])
    .map((part) => part?.text || '')
    .join('')
    .trim();

  if (!text) {
    if (candidate?.finishReason === 'SAFETY') {
      throw new AiError('الصورة اترفضت من فلتر الأمان. جرّب صورة تانية.', 'blocked');
    }
    if (candidate?.finishReason === 'MAX_TOKENS') {
      throw new AiError('الرد اتقطع قبل ما يكمل. جرّب تاني.', 'truncated');
    }
    throw new AiError('Gemini مرجّعش نتيجة. جرّب صورة أوضح.', 'empty');
  }
  return text;
}

function parseJson(text) {
  const cleaned = String(text)
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new AiError('الرد مش بصيغة مفهومة. جرّب تاني.', 'parse');
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new AiError('الرد مش بصيغة مفهومة. جرّب تاني.', 'parse');
  }
}

const asText = (value, max = 160) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

const asNumber = (value, max = 5000) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(max, number);
};

function normalizeResult(raw) {
  if (raw?.isFood === false) {
    const reason = asText(raw.reason, 120) || 'مش واضح إن في الصورة أكل.';
    throw new AiError(`${reason} جرّب صورة أقرب للطبق وبإضاءة أحسن.`, 'not-food');
  }

  const en = asText(raw.en, 80);
  const name = asText(raw.name, 80) || en;
  if (!name) throw new AiError('مقدرتش أحدد اسم الأكلة. جرّب صورة أوضح.', 'no-name');

  const portion = asText(raw.portion, 80) || 'حصة';
  const grams = Math.round(asNumber(raw.grams, 3000));
  const p = round(asNumber(raw.protein, 500), 1);
  const c = round(asNumber(raw.carbs, 500), 1);
  const f = round(asNumber(raw.fat, 500), 1);

  let kcal = Math.round(asNumber(raw.kcal, 5000));
  const derived = Math.round(p * 4 + c * 4 + f * 9);
  if (!kcal) kcal = derived;
  else if (derived && (kcal > derived * 1.6 || kcal < derived * 0.55)) kcal = derived;

  if (!kcal) {
    throw new AiError('مقدرتش أطلع سعرات واضحة من الصورة. جرّب صورة تانية أو ضيف الأكلة يدوي.', 'no-kcal');
  }

  let confidence = asNumber(raw.confidence, 100);
  if (confidence > 0 && confidence <= 1) confidence *= 100;
  confidence = Math.max(0, Math.min(100, Math.round(confidence)));

  const items = Array.isArray(raw.items)
    ? raw.items
      .map((item) => ({
        name: asText(item?.name, 60),
        grams: Math.round(asNumber(item?.grams, 3000)),
        kcal: Math.round(asNumber(item?.kcal, 5000))
      }))
      .filter((item) => item.name)
      .slice(0, 6)
    : [];

  return {
    isFood: true,
    en,
    name,
    portion,
    grams,
    kcal,
    p,
    c,
    f,
    confidence,
    items,
    note: asText(raw.note, 240)
  };
}

/**
 * بيحلل صورة أكلة ويرجّع تقدير منظم.
 * @param {File} file
 * @param {{signal?: AbortSignal}} options
 */
export async function analyzeFoodPhoto(file, { signal } = {}) {
  const inlineData = await imageToInlineData(file);
  const payload = await callGemini({
    parts: [
      { inlineData },
      { text: ANALYSIS_PROMPT }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      maxOutputTokens: 2048
    },
    signal
  });
  return normalizeResult(parseJson(extractText(payload)));
}

/** اختبار سريع للمفتاح/السيرفر من غير صورة. */
export async function testAiConnection() {
  const payload = await callGemini({
    parts: [{ text: 'اكتب كلمة واحدة بس: تمام' }],
    generationConfig: { maxOutputTokens: 32, temperature: 0 }
  });
  return extractText(payload).slice(0, 60);
}
