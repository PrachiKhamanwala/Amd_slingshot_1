// Thin wrapper over chrome.storage.local for settings.

const DEFAULT_SETTINGS = {
  behaviorModeEnabled: true,
  webcamModeEnabled: false,
  consentAcknowledged: false,
  minConfidence: 0.6,
  debugModeEnabled: false
};

export async function getSettings() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, settings => {
      resolve(settings || DEFAULT_SETTINGS);
    });
  });
}

export async function saveSettings(settings) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', payload: settings }, () => {
      resolve(true);
    });
  });
}

