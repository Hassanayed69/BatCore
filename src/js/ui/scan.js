import { fetchByBarcode } from '../services/food.js';
import { cameraSupported, startScan, stopScan } from '../services/camera.js';
import { fmt } from '../core/calc.js';
import { closeDialog, esc, icon, openDialog } from './dom.js';

let video = null;
let scanning = false;
let selected = null;
let pickCallback = null;
let lookupId = 0;

function setMessage(text, type = '') {
  const message = document.getElementById('scan-msg');
  if (!message) return;
  message.textContent = text;
  message.dataset.type = type;
}

function resetScanDialog() {
  lookupId += 1;
  stopCamera();
  selected = null;
  pickCallback = null;
  const input = document.getElementById('barcode-input');
  if (input) input.value = '';
  const result = document.getElementById('scan-result');
  if (result) result.replaceChildren();
  setMessage('');
}

function resetCameraButton() {
  const button = document.getElementById('scan-start');
  if (button) button.innerHTML = `${icon('camera')} افتح الكاميرا`;
  scanning = false;
}

function stopCamera() {
  if (!video) return;
  stopScan(video);
  resetCameraButton();
}

function renderProduct(food) {
  const result = document.getElementById('scan-result');
  if (!result) return;
  if (!food) {
    result.replaceChildren();
    return;
  }
  selected = food;
  result.innerHTML = `
    <div class="scanned-product">
      ${food.image && /^https?:\/\//.test(food.image)
        ? `<img class="scanned-thumb" src="${esc(food.image)}" alt="" referrerpolicy="no-referrer">`
        : `<span class="scanned-thumb scanned-thumb-text">${icon('food')}</span>`}
      <div class="scanned-info">
        <strong>${esc(food.name)}</strong>
        <span>${esc(food.en || 'منتج باركود')}</span>
        <small>${fmt(food.kcal)} سعرة / 100 جم</small>
      </div>
      <button class="btn btn-primary btn-sm" type="button" id="use-scanned">استخدمه</button>
    </div>
    <p class="micro-copy">بروتين ${fmt(food.p, 1)} · كارب ${fmt(food.c, 1)} · دهون ${fmt(food.f, 1)} لكل 100 جم</p>`;

  document.getElementById('use-scanned')?.addEventListener('click', () => {
    const callback = pickCallback;
    const product = selected;
    stopCamera();
    closeDialog('scan-dialog');
    resetScanDialog();
    callback?.(product);
  });
}

async function lookup(code) {
  const value = String(code || '').trim();
  const requestId = ++lookupId;
  if (!/^\d{8,14}$/.test(value)) {
    setMessage('اكتب من 8 لـ 14 رقم من غير مسافات.', 'error');
    return;
  }
  setMessage('بندوّر على المنتج…');
  renderProduct(null);
  try {
    const food = await fetchByBarcode(value);
    if (requestId !== lookupId) return;
    if (!food) {
      setMessage('المنتج مش موجود في قاعدة Open Food Facts.', 'error');
      return;
    }
    if (!food.kcal) {
      setMessage('المنتج موجود لكن بيانات السعرات ناقصة.', 'error');
    } else {
      setMessage('لقيته! القيم لكل 100 جم — عدّل الكمية بعد الإضافة.', 'success');
    }
    navigator.vibrate?.(18);
    renderProduct(food);
  } catch (error) {
    if (requestId !== lookupId) return;
    setMessage(error.message || 'حصلت مشكلة في البحث.', 'error');
  }
}

export function initScan() {
  video = document.getElementById('scan-video');

  document.getElementById('scan-start')?.addEventListener('click', async () => {
    if (scanning) {
      stopCamera();
      setMessage('اتوقفت الكاميرا.');
      return;
    }
    if (!cameraSupported()) {
      setMessage('المتصفح ده مش بيدعم قراءة الباركود. اكتب الرقم يدوي.', 'error');
      return;
    }
    try {
      setMessage('وجّه الكاميرا ناحية الباركود…');
      const button = document.getElementById('scan-start');
      if (button) button.innerHTML = `${icon('x')} إيقاف الكاميرا`;
      scanning = true;
      await startScan(video, (code) => {
        resetCameraButton();
        document.getElementById('barcode-input').value = code;
        lookup(code);
      });
    } catch (error) {
      resetCameraButton();
      stopCamera();
      setMessage('مقدرناش نفتح الكاميرا. تأكد من الإذن وأن الموقع شغال على HTTPS أو localhost.', 'error');
      console.error(error);
    }
  });

  document.getElementById('barcode-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    stopCamera();
    lookup(document.getElementById('barcode-input').value);
  });

  const dialog = document.getElementById('scan-dialog');
  dialog?.addEventListener('close', resetScanDialog);
  dialog?.addEventListener('cancel', resetScanDialog);
  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog || event.target.closest('[data-close-dialog]')) resetScanDialog();
  });
}

export function openScanner(onPick) {
  resetScanDialog();
  pickCallback = onPick;
  setMessage('');
  renderProduct(null);
  openDialog('scan-dialog');
  if (!cameraSupported()) {
    setMessage('الكاميرا مش مدعومة هنا — اكتب رقم الباركود تحت.', 'info');
  }
}
