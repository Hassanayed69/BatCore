import { esc, icon, toast } from './dom.js';
import {
  getPrayers,
  getObligatory,
  getTodayLog,
  markPrayer,
  getTodayCount,
  getStreak,
  getPrayerTimes,
  setPrayerTimes,
  formatTime,
  timeUntil,
  calculatePrayerTimes,
  getPrayerState,
  getNextPrayer
} from '../services/prayer.js';
import { todayKey } from '../core/dates.js';

let timer = null;
let currentTab = 'times';

function toArabicNum(n) {
  const map = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  return String(n).split('').map(c => map[Number(c)] || c).join('');
}

function isFriday(date = new Date()) {
  return date.getDay() === 5;
}

function prayerCard(prayer, time, done, isNext) {
  if (prayer.id === 'sunrise') {
    return `<div class="prayer-item prayer-item-info">
      <div class="prayer-info">
        <div class="prayer-check" style="opacity:0"></div>
        <div>
          <strong>${esc(prayer.name)}</strong>
        </div>
      </div>
      <div class="prayer-time">
        <span>${time ? formatTime(time) : '--:--'}</span>
        <span class="prayer-action">وقت الشروق</span>
      </div>
    </div>`;
  }
  return `<button class="prayer-item ${done ? 'is-done' : ''} ${isNext ? 'is-next' : ''}" data-prayer="${prayer.id}" type="button">
    <div class="prayer-info">
      <div class="prayer-check">${done ? icon('check') : ''}</div>
      <div>
        <strong>${esc(prayer.name)}</strong>
        ${isNext ? '<span class="prayer-next-badge">الصلاة القادمة</span>' : ''}
      </div>
    </div>
    <div class="prayer-time">
      <span>${time ? formatTime(time) : '--:--'}</span>
      <span class="prayer-action">${done ? '✓ صليت' : 'سجّل صلاتك'}</span>
    </div>
  </button>`;
}

function timesView(times) {
  const prayers = getPrayers();
  const log = getTodayLog();
  const obligatory = getObligatory();
  const next = getNextPrayer(times, log);
  
  const nextCount = getTodayCount();
  const allDone = nextCount === 5;

  return `<article class="card prayer-times-card">
    <header class="card-head">
      <div>
        <p class="eyebrow">مواقيت الصلاة</p>
        <h3>صلوات اليوم</h3>
      </div>
      <div class="prayer-count">
        <span>${toArabicNum(nextCount)}</span> / ${toArabicNum(5)}
      </div>
    </header>
    ${next && !allDone ? `
      <div class="prayer-next">
        <div>
          <small>الصلاة التالية</small>
          <strong>${esc(next.prayer.name)}</strong>
        </div>
        <div class="prayer-countdown-wrap">
          <small>متبقي</small>
          <span class="prayer-countdown" id="prayer-countdown">٠٠:٠٠</span>
        </div>
      </div>
    ` : allDone ? `
      <div class="prayer-next prayer-next-done">
        <div>
          <strong>بارك الله فيك ✓ صليت جميع الصلوات الخمس</strong>
          <small>حفظك الله وأتم لك الأجر</small>
        </div>
      </div>
    ` : ''}
    <div class="prayer-list">
      ${prayers.map((p) => {
        const isNext = next && next.prayer.id === p.id;
        return prayerCard(p, times[p.id], obligatory.includes(p.id) ? log[p.id] : false, isNext);
      }).join('')}
    </div>
    ${isFriday() ? `
      <div class="friday-reminder">
        <span class="friday-icon">📖</span>
        <div>
          <strong>يوم الجمعة</strong>
          <p>سنة مؤكدة: قراءة سورة الكهف</p>
        </div>
      </div>
    ` : ''}
    <p class="hint">اضغط على كل فريضة لتسجيلها</p>
  </article>`;
}

function adhkarView() {
  return `<article class="card adhkar-card">
    <header class="card-head">
      <div>
        <p class="eyebrow">الأذكار</p>
        <h3>أذكار الصباح والمساء</h3>
      </div>
    </header>
    <div class="adhkar-tabs">
      <button class="adhkar-tab ${currentTab === 'times' ? 'is-active' : ''}" data-adhkar-tab="times">مواقيت</button>
      <button class="adhkar-tab ${currentTab === 'morning' ? 'is-active' : ''}" data-adhkar-tab="morning">أذكار الصباح</button>
      <button class="adhkar-tab ${currentTab === 'evening' ? 'is-active' : ''}" data-adhkar-tab="evening">أذكار المساء</button>
      <button class="adhkar-tab ${currentTab === 'after' ? 'is-active' : ''}" data-adhkar-tab="after">بعد الصلاة</button>
    </div>
    <div id="adhkar-list" class="adhkar-list"></div>
  </article>`;
}

async function loadAdhkar(type) {
  try {
    const res = await fetch('src/data/adhkar.json');
    const data = await res.json();
    return data[type] || [];
  } catch {
    return [];
  }
}

function updateCountdown(times) {
  const el = document.getElementById('prayer-countdown');
  if (!el) return;
  const log = getTodayLog();
  const next = getNextPrayer(times, log);
  if (!next) {
    el.textContent = '٠٠:٠٠';
    return;
  }
  const diff = timeUntil(next.time);
  el.textContent = `${toArabicNum(String(diff.hours).padStart(2,'٠'))}:${toArabicNum(String(diff.mins).padStart(2,'٠'))}`;
}

export async function renderPrayer() {
  const root = document.getElementById('view-prayer');
  if (!root) return;

  const state = getPrayerState();
  let times = getPrayerTimes();
  
  if (!times) {
    times = calculatePrayerTimes(state.location.lat, state.location.lng, new Date());
    const obj = {};
    for (const key in times) obj[key] = times[key].toISOString();
    setPrayerTimes(todayKey(), obj);
  } else {
    const converted = {};
    for (const key in times) {
      converted[key] = times[key] ? new Date(times[key]) : null;
    }
    times = converted;
  }

  root.innerHTML = `<div class="prayer-page">
    <header class="page-head">
      <div>
        <p class="eyebrow">العبادة والالتزام</p>
        <h2>الصلاة</h2>
      </div>
      <div class="prayer-streak-badge">
        <span class="streak-flame">🔥</span>
        <div>
          <strong>${toArabicNum(getStreak().count)}</strong>
          <small>يوم متتالي</small>
        </div>
      </div>
    </header>
    <div class="prayer-layout">
      <div class="prayer-main">
        ${timesView(times)}
      </div>
      <aside class="prayer-side">
        ${adhkarView()}
        <article class="card prayer-tip-card">
          <span class="tip-icon">${icon('info')}</span>
          <h3>حديث شريف</h3>
          <p>«مَن حَافَظَ عَلَى هَاتَيْنِ الصَّلَاتَيْنِ الظُّهْرِ وَالعَصْرِ دَخَلَ الجَنَّةَ»</p>
          <small>متفق عليه</small>
        </article>
      </aside>
    </div>
  </div>`;

  bindPrayer(root, times);
  if (timer) clearInterval(timer);
  timer = setInterval(() => updateCountdown(times), 30000);
  updateCountdown(times);

  // Load adhkar
  const adhkarList = document.getElementById('adhkar-list');
  if (adhkarList) {
    const type = currentTab === 'times' ? 'morning' : currentTab;
    const adhkar = await loadAdhkar(type);
    if (currentTab === 'times') {
      adhkarList.innerHTML = `<div class="adhkar-intro"><p>اختر تبويب الأذكار من الأعلى لعرض أذكار الصباح أو المساء أو أذكار ما بعد الصلاة</p></div>`;
    } else {
      adhkarList.innerHTML = adhkar.map((d, idx) => `
        <div class="adhkar-item" data-adhkar-id="${d.id}" data-count="${d.count}">
          <div class="adhkar-number">${toArabicNum(idx + 1)}</div>
          <div class="adhkar-content">
            <div class="adhkar-text">${esc(d.text).replace(/\n/g, '<br>')}</div>
            <button class="adhkar-counter" data-adhkar-btn="${d.id}">
              <span class="adhkar-num" data-val="0">${toArabicNum(0)}</span>
              <span class="adhkar-sep">/</span>
              <span>${toArabicNum(d.count)}</span>
            </button>
          </div>
        </div>
      `).join('');
      bindAdhkar(adhkarList);
    }
  }
}

function bindAdhkar(container) {
  container.querySelectorAll('.adhkar-counter').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.adhkar-item');
      const count = Number(item.dataset.count);
      const num = btn.querySelector('.adhkar-num');
      let current = Number(num.dataset.val || 0);
      current += 1;
      num.dataset.val = current;
      num.textContent = toArabicNum(current);
      if (current >= count) {
        btn.classList.add('is-done');
        btn.disabled = true;
        toast('أحسنت، تم بحمد الله', { type: 'success', duration: 1500 });
      }
    });
  });
}

function bindPrayer(root, times) {
  root.querySelectorAll('.prayer-item[data-prayer]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prayer = btn.dataset.prayer;
      const log = getTodayLog();
      const done = !log[prayer];
      markPrayer(prayer, todayKey(), done);
      if (done) {
        toast(`تم تسجيل صلاة ${getPrayers().find(p => p.id === prayer)?.name} - بارك الله فيك`, { type: 'success', duration: 2000 });
      }
      renderPrayer();
    });
  });

  root.querySelectorAll('.adhkar-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      currentTab = tab.dataset.adhkarTab;
      renderPrayer();
    });
  });
}
