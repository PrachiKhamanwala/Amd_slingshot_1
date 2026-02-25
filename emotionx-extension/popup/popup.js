import { getSettings, saveSettings } from '../privacy/storage-manager.js';
import { CONSENT_COPY } from '../privacy/consent-manager.js';

const behaviorToggle = document.getElementById('behavior-toggle');
const webcamToggle = document.getElementById('webcam-toggle');
const consentCheckbox = document.getElementById('consent-checkbox');
const consentBullets = document.getElementById('consent-bullets');
const confidenceRange = document.getElementById('confidence-range');
const confidenceValue = document.getElementById('confidence-value');
const saveBtn = document.getElementById('save-btn');
const debugToggle = document.getElementById('debug-toggle');

function renderConsentCopy() {
  const { bullets } = CONSENT_COPY;
  consentBullets.innerHTML = '';
  bullets.forEach(text => {
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
    const updated = {
      behaviorModeEnabled: behaviorToggle.checked,
      webcamModeEnabled: webcamToggle.checked,
      consentAcknowledged: consentCheckbox.checked,
      minConfidence: Number(confidenceRange.value),
      debugModeEnabled: debugToggle.checked
    };
    await saveSettings(updated);
    window.close();
  });
}

init();

