import { greeting, longDate, todayKey } from './core/dates.js';
import { currentStreak, getState, getTarget, subscribe, totalsFor } from './core/store.js';
import { GOALS } from './core/calc.js';
import { applyTheme, toggleTheme } from './ui/theme.js';
import { closeDialog, esc, icon, openDialog, toast } from './ui/dom.js';
import { initFoodDialog, openFoodDialog } from './ui/food-dialog.js';
import { initAiDialog } from './ui/ai.js';
import { initOnboarding } from './ui/onboarding.js';
import { initScan } from './ui/scan.js';
import { initWeightDialog, openWeightDialog } from './ui/weight.js';
import { renderHome } from './ui/dashboard.js';
import { renderFood } from './ui/food.js';
import { hideRestTimer, initTrainDialog, renderTrain } from './ui/train.js';
import { renderProgress } from './ui/progress.js';
import { renderProfile } from './ui/profile.js';
import { loadFoods } from './services/food.js';
import { loadPlans } from './services/plans.js';

const PAGES = {
  home: { title: 'الرئيسية', render: renderHome },
  food: { title: 'يوميات الأكل', render: renderFood },
  train: { title: 'خطة التمرين', render: renderTrain },
  progress: { title: 'التقدم', render: renderProgress },
  profile: { title: 'حسابي', render: renderProfile }
};

let currentPage = 'home';
let booted = false;
const WELCOME_SEEN = 'batcore.welcome.seen';

const mealForTime = (hour = new Date().getHours()) => {
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snacks';
};

function renderShell() {
  const state = getState();
  const target = getTarget();
  const totals = totalsFor(todayKey());
  const left = Math.round(target.kcal - totals.kcal);
  const initial = (state.profile.name || 'B').trim().charAt(0).toUpperCase();
  const goal = GOALS[state.profile.goal]?.label || 'ثبات';
  const streak = currentStreak();

  const todayLabel = document.getElementById('today-label');
  if (todayLabel) todayLabel.textContent = `${greeting()} · ${longDate(todayKey())}`;

  const streakCount = document.getElementById('streak-count');
  if (streakCount) streakCount.textContent = String(streak);
  const streakBadge = document.getElementById('streak-badge');
  streakBadge?.classList.toggle('is-empty', streak === 0);
  streakBadge?.setAttribute('aria-label', streak ? `${streak} يوم متابعة متتالي` : 'ابدأ سلسلة المتابعة');

  const sideGoal = document.getElementById('side-goal');
  if (sideGoal) {
    sideGoal.innerHTML = `
      <div class="side-goal-head">
        <span>هدف النهارده</span>
        <strong>${Math.abs(left)} <small>${left >= 0 ? 'سعرة فاضلة' : 'سعرة زيادة'}</small></strong>
      </div>
      <div class="progress ${left < 0 ? 'progress-coral' : ''}">
        <span style="width:${Math.min(100, (totals.kcal / (target.kcal || 1)) * 100)}%"></span>
      </div>
      <div class="side-goal-foot"><span>${Math.round(totals.kcal)} سعرة</span><span>من ${target.kcal}</span></div>`;
  }

  const sideUser = document.getElementById('side-user');
  if (sideUser) {
    sideUser.innerHTML = `
      <button class="side-user-btn" type="button" data-nav="profile">
        <span class="avatar avatar-sm">${esc(initial)}</span>
        <span class="side-user-text"><strong>${esc(state.profile.name || 'صديق BatCORE')}</strong><small>${esc(goal)} · ${state.profile.weight} كجم</small></span>
        ${icon('chevron-left')}
      </button>`;
  }
}

function renderPage() {
  const page = PAGES[currentPage] ? currentPage : 'home';
  PAGES[page].render();
  document.querySelectorAll('.view').forEach((view) => {
    view.hidden = view.dataset.page !== page;
  });
  document.querySelectorAll('[data-nav]').forEach((button) => {
    const active = button.dataset.nav === page;
    if (button.classList.contains('nav-item') || button.closest('.bottom-nav')) {
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
  });
  const title = document.getElementById('page-title');
  if (title) title.textContent = PAGES[page].title;
}

function navigate(page) {
  if (!PAGES[page]) page = 'home';
  currentPage = page;
  hideRestTimer();
  renderPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderAll() {
  applyTheme();
  renderShell();
  renderPage();
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    const nav = event.target.closest('[data-nav]');
    if (nav) {
      event.preventDefault();
      navigate(nav.dataset.nav);
      return;
    }

    const add = event.target.closest('[data-add-food]');
    if (add) {
      openFoodDialog({
        meal: add.dataset.meal || mealForTime(),
        date: add.dataset.date || todayKey()
      });
      return;
    }

    if (event.target.closest('[data-open-weight]')) {
      openWeightDialog();
      return;
    }

    const closer = event.target.closest('[data-close-dialog]');
    if (closer) {
      closeDialog(closer.closest('dialog'));
    }
  });

  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog && dialog.id !== 'welcome') closeDialog(dialog);
    });
  });

  const welcome = document.getElementById('welcome');
  welcome?.addEventListener('cancel', (event) => event.preventDefault());
  document.getElementById('welcome-start')?.addEventListener('click', () => {
    sessionStorage.setItem(WELCOME_SEEN, '1');
    closeDialog('welcome');
    openDialog('onboarding');
  });

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    toggleTheme();
  });

  document.getElementById('quick-add')?.addEventListener('click', () => {
    openFoodDialog({ meal: mealForTime(), date: todayKey() });
  });

  document.getElementById('streak-badge')?.addEventListener('click', () => {
    const streak = currentStreak();
    toast(streak ? `سلسلة ${streak} يوم متابعة — كمّل كده 🔥` : 'سجّل أكلة أو تمرين النهارده وابدأ سلسلتك', {
      type: streak ? 'success' : 'info'
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      const open = document.querySelector('dialog[open]');
      if (open && open.id !== 'welcome') closeDialog(open);
    }
  });
}

async function boot() {
  bindEvents();
  initFoodDialog();
  initAiDialog();
  initScan();
  initWeightDialog();
  initOnboarding();
  initTrainDialog();

  if (!getState().onboardingDone) {
    const welcome = document.getElementById('welcome');
    if (welcome && !sessionStorage.getItem(WELCOME_SEEN)) openDialog(welcome);
    else openDialog('onboarding');
  }

  try {
    await Promise.all([loadFoods(), loadPlans()]);
  } catch (error) {
    console.error(error);
    toast('تعذر تحميل بعض البيانات. شغّل الموقع من خلال سيرفر محلي.', { type: 'error', duration: 6000 });
  }

  subscribe(() => {
    applyTheme();
    renderShell();
    renderPage();
  });

  renderAll();
  booted = true;
}

boot();

export { navigate, toast, booted };
