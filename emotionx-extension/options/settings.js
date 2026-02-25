import { getSettings, saveSettings } from '../privacy/storage-manager.js';
import { CONSENT_COPY } from '../privacy/consent-manager.js';

const consentHeadline = document.getElementById('consent-headline');
const consentBullets = document.getElementById('settings-consent-bullets');
const consentCheckbox = document.getElementById('settings-consent-checkbox');
const behaviorToggle = document.getElementById('settings-behavior-toggle');
const webcamToggle = document.getElementById('settings-webcam-toggle');
const confidenceRange = document.getElementById('settings-confidence-range');
const confidenceValue = document.getElementById('settings-confidence-value');
const saveBtn = document.getElementById('settings-save-btn');
const debugToggle = document.getElementById('settings-debug-toggle');

function renderConsentCopy() {
  consentHeadline.textContent = CONSENT_COPY.headline;
  consentBullets.innerHTML = '';
  CONSENT_COPY.bullets.forEach(text => {
    const li = document.createElement('li');
    li.textContent = text;
    consentBullets.appendChild(li);
  });
}

function renderConfidenceLabel(value) {
  confidenceValue.textContent = `${Math.round(value * 100)}% min confidence`;
}

async function init() {
  renderConsentCopy();
  const settings = await getSettings();

  behaviorToggle.checked = !!settings.behaviorModeEnabled;
  webcamToggle.checked = !!settings.webcamModeEnabled;
  consentCheckbox.checked = !!settings.consentAcknowledged;
  confidenceRange.value = settings.minConfidence ?? 0.6;
  debugToggle.checked = !!settings.debugModeEnabled;
  renderConfidenceLabel(Number(confidenceRange.value));

  confidenceRange.addEventListener('input', () => {
    renderConfidenceLabel(Number(confidenceRange.value));
  });

  saveBtn.addEventListener('click', async () => {
    const originalLabel = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const updated = {
      behaviorModeEnabled: behaviorToggle.checked,
      webcamModeEnabled: webcamToggle.checked,
      consentAcknowledged: consentCheckbox.checked,
      minConfidence: Number(confidenceRange.value),
      debugModeEnabled: debugToggle.checked
    };

    await saveSettings(updated);

    saveBtn.textContent = 'Saved';
    setTimeout(() => {
      saveBtn.textContent = originalLabel;
      saveBtn.disabled = false;
    }, 1200);
  });
}

init();

