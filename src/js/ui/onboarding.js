import { addWeight, getState, getWeights, saveProfile, setOnboardingDone } from '../core/store.js';
import { todayKey } from '../core/dates.js';
import { closeDialog, openDialog, toast } from './dom.js';

function syncPace() {
  const form = document.getElementById('onboard-form');
  if (!form) return;
  const goal = form.querySelector('input[name="goal"]:checked')?.value || 'cut';
  const paceField = document.getElementById('pace-field');
  if (paceField) paceField.hidden = goal === 'maintain';
}

function fillForm(profile = getState().profile) {
  const form = document.getElementById('onboard-form');
  if (!form) return;
  ['name', 'age', 'height', 'weight'].forEach((key) => {
    if (form.elements[key]) form.elements[key].value = profile[key] ?? '';
  });
  if (form.elements.sex) form.elements.sex.value = profile.sex || 'male';
  if (form.elements.activity) form.elements.activity.value = profile.activity || 'moderate';
  if (form.elements.pace) form.elements.pace.value = profile.pace || 'moderate';
  const goal = form.querySelector(`input[name="goal"][value="${profile.goal || 'cut'}"]`);
  if (goal) goal.checked = true;
  syncPace();
}

export function initOnboarding() {
  const form = document.getElementById('onboard-form');
  if (!form) return;
  fillForm();

  form.querySelectorAll('input[name="goal"]').forEach((input) => input.addEventListener('change', syncPace));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const profileData = {
      name: String(data.name || '').trim(),
      sex: data.sex === 'female' ? 'female' : 'male',
      age: Number(data.age),
      height: Number(data.height),
      weight: Number(data.weight),
      activity: data.activity || 'moderate',
      goal: data.goal || 'maintain',
      pace: data.pace || 'moderate'
    };
    if (!profileData.age || !profileData.height || !profileData.weight) {
      toast('كمّل بياناتك الأول', { type: 'error' });
      return;
    }
    saveProfile(profileData);
    if (!getWeights().length) addWeight(profileData.weight, todayKey());
    closeDialog('onboarding');
    toast('أهدافك اتظبطت — يلا نبدأ', { type: 'success' });
  });

  document.getElementById('onboard-skip')?.addEventListener('click', () => {
    setOnboardingDone();
    closeDialog('onboarding');
    toast('ابدأ بالإعدادات الافتراضية، وتقدر تعدلها من «حسابي»', { type: 'info', duration: 4200 });
  });
}

export function openOnboarding() {
  fillForm();
  openDialog('onboarding');
}
