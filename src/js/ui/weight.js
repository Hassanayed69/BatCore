import { addWeight, deleteWeight, getWeights, latestWeight } from '../core/store.js';
import { shortDate, todayKey } from '../core/dates.js';
import { closeDialog, esc, icon, openDialog, toast } from './dom.js';

function renderHistory() {
  const root = document.getElementById('weight-history');
  if (!root) return;
  const list = getWeights().slice(-6).reverse();
  if (!list.length) {
    root.innerHTML = `<div class="empty-state compact"><span class="empty-icon">${icon('scale')}</span><strong>مفيش قياسات لسه</strong><p>سجّل وزنك مرة كل أسبوع في نفس الوقت.</p></div>`;
    return;
  }
  const sorted = getWeights();
  root.innerHTML = `
    <p class="results-title">آخر القياسات</p>
    <div class="weight-list">
      ${list.map((item) => {
        const index = sorted.findIndex((entry) => entry.date === item.date);
        const previous = index > 0 ? sorted[index - 1] : null;
        const delta = previous ? Math.round((item.kg - previous.kg) * 10) / 10 : 0;
        const deltaLabel = previous
          ? `${delta > 0 ? '+' : ''}${delta} كجم`
          : 'أول قياس';
        return `<div class="weight-row">
          <span class="weight-row-date">${esc(shortDate(item.date))}</span>
          <strong>${item.kg} كجم</strong>
          <span class="weight-delta ${delta < 0 ? 'down' : delta > 0 ? 'up' : ''}">${esc(deltaLabel)}</span>
          <button type="button" class="icon-btn icon-btn-sm delete-weight" data-date="${esc(item.date)}" aria-label="احذف قياس ${esc(shortDate(item.date))}">${icon('trash')}</button>
        </div>`;
      }).join('')}
    </div>`;

  root.querySelectorAll('.delete-weight').forEach((button) => {
    button.addEventListener('click', () => {
      deleteWeight(button.dataset.date);
      renderHistory();
      toast('القياس اتحذف', { type: 'info', duration: 1800 });
    });
  });
}

export function openWeightDialog() {
  const latest = latestWeight();
  const weightInput = document.getElementById('weight-input');
  const dateInput = document.getElementById('weight-date');
  if (weightInput) weightInput.value = latest.kg;
  if (dateInput) {
    dateInput.value = todayKey();
    dateInput.max = todayKey();
  }
  renderHistory();
  openDialog('weight-dialog');
  requestAnimationFrame(() => weightInput?.focus({ preventScroll: true }));
}

export function initWeightDialog() {
  document.getElementById('weight-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    try {
      addWeight(form.get('weight'), form.get('date') || todayKey());
      closeDialog('weight-dialog');
      toast(`اتسجل ${form.get('weight')} كجم — كمّل بنفس النظام`, { type: 'success' });
    } catch (error) {
      toast(error.message, { type: 'error' });
    }
  });
}
