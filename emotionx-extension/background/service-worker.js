// EmotionX background service worker (MV3)
// Coordinates mode state, messaging, and installation consent flow.

const DEFAULT_SETTINGS = {
  behaviorModeEnabled: true,
  webcamModeEnabled: false,
  consentAcknowledged: false,
  minConfidence: 0.6,
  debugModeEnabled: false
};

chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    chrome.storage.local.set({ settings: DEFAULT_SETTINGS }, () => {
      // no-op: popup/options will guide user through consent
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SETTINGS') {
    chrome.storage.local.get('settings', data => {
      sendResponse(data.settings || DEFAULT_SETTINGS);
    });
    return true;
  }

  if (message.type === 'UPDATE_SETTINGS') {
    chrome.storage.local.set({ settings: message.payload }, () => {
      // Broadcast updated settings so open tabs can react (e.g. start/stop webcam/behavior).
      chrome.tabs.query({}, tabs => {
        for (const tab of tabs) {
          if (!tab.id || !tab.url || !tab.url.startsWith('http')) continue;

          chrome.tabs.sendMessage(
            tab.id,
            {
              type: 'SETTINGS_UPDATED',
              payload: message.payload
            },
            () => {
              // Ignore tabs without a receiver (e.g. chrome:// pages) to avoid
              // "Could not establish connection. Receiving end does not exist." noise.
              void chrome.runtime.lastError;
            }
          );
        }
      });
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === 'EMOTION_UPDATE') {
    // Broadcast latest emotion to all tabs for UI adaptation
    chrome.tabs.query({}, tabs => {
      for (const tab of tabs) {
        if (!tab.id || !tab.url || !tab.url.startsWith('http')) continue;

        chrome.tabs.sendMessage(
          tab.id,
          {
            type: 'EMOTION_STATE',
            payload: message.payload
          },
          () => {
            // Ignore tabs without a receiver (e.g. chrome:// pages).
            void chrome.runtime.lastError;
          }
        );
      }
    });
    sendResponse({ ok: true });
    return true;
  }
});

