// Entry point injected into shopping sites.
// Wires behavior tracker, webcam controller (via messages), and UI adaptation.

// Helper classes/functions are loaded as globals via manifest content_scripts order.
// In some cases the constructor may only be attached on globalThis/window, so
// resolve it defensively to avoid ReferenceError in case the script order changes.
const EmotionEngineCtor = globalThis.EmotionEngine || window.EmotionEngine;
const emotionEngine = EmotionEngineCtor ? new EmotionEngineCtor() : null;
const behaviorTracker = new BehaviorTracker();
const domObserver = new DomObserver();
const uiAdapter = new UiAdapter();
const overlay = new EmotionOverlay();

let latestSettings = null;
let debugModeEnabled = false;
let behaviorRunning = false;
let webcamClassifier = null;
let webcamRunning = false;

// Swallow benign "Extension context invalidated" errors that Chrome emits when the
// extension is reloaded or the content script context is torn down while async work
// is still in-flight. We only suppress this specific case so other errors still surface.
window.addEventListener('error', event => {
  const msg =
    (event.error && typeof event.error.message === 'string' && event.error.message) ||
    (typeof event.message === 'string' && event.message) ||
    '';
  if (msg.includes('Extension context invalidated')) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
});

window.addEventListener('unhandledrejection', event => {
  const reason = event.reason;
  const msg =
    (reason && typeof reason.message === 'string' && reason.message) ||
    (typeof reason === 'string' && reason) ||
    '';
  if (msg.includes('Extension context invalidated')) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
});

function hasRuntime() {
  return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
}

function safeSendRuntimeMessage(message) {
  if (!hasRuntime()) return;
  try {
    chrome.runtime.sendMessage(message, () => {
      if (chrome.runtime && chrome.runtime.lastError) {
        void chrome.runtime.lastError;
      }
    });
  } catch {
    // Ignore errors when the extension context has been invalidated (e.g. reload/update).
  }
}

function describeSource(source) {
  if (source === 'behavior') return 'mouse and scroll behavior';
  if (source === 'webcam') return 'webcam facial signals';
  if (source === 'hybrid') return 'a mix of behavior and webcam signals';
  return 'behavior signals';
}

function buildExplanation(emotion, source) {
  if (!emotion) return '';

  const channel = describeSource(source);
  let why = '';

  switch (emotion) {
    case 'frustrated':
      why = 'there are strong, jumpy changes over time.';
      break;
    case 'impulsive':
      why = 'there are fast bursts of activity and quick changes.';
      break;
    case 'engaged':
    case 'focused':
      why = 'activity is steady and focused on a small area.';
      break;
    case 'calm':
      why = 'movement is smooth and relaxed.';
      break;
    case 'happy':
      why = 'signals match a positive, open expression.';
      break;
    default:
      why = 'signals look close to your normal pattern.';
      break;
  }

  return `From your ${channel}, it looks ${emotion} because ${why}`;
}

async function ensureWebcamClassifier() {
  if (webcamClassifier) return webcamClassifier;

  const url = chrome.runtime.getURL('webcam/expression-classifier.js');
  const module = await import(url);
  const ExpressionClassifier = module.ExpressionClassifier;
  webcamClassifier = new ExpressionClassifier(emotionEngine);
  return webcamClassifier;
}

async function maybeStartBehavior() {
  if (behaviorRunning) return;
  if (!latestSettings?.behaviorModeEnabled) return;

  behaviorTracker.start(onBehaviorFeatures);
  behaviorRunning = true;
}

function stopBehavior() {
  if (!behaviorRunning) return;
  behaviorTracker.stop();
  behaviorRunning = false;
}

async function maybeStartWebcam() {
  if (webcamRunning) return;
  if (!latestSettings?.webcamModeEnabled || !latestSettings?.consentAcknowledged) return;

  try {
    const classifier = await ensureWebcamClassifier();
    webcamRunning = true;
    await classifier.start(onWebcamEmotion);
  } catch {
    webcamRunning = false;
  }
}

function stopWebcam() {
  if (!webcamRunning || !webcamClassifier) return;
  webcamClassifier.stop();
  webcamRunning = false;
}

function init() {
  if (!hasRuntime()) return;

  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, settings => {
    latestSettings = settings;
    debugModeEnabled = !!settings.debugModeEnabled;

    domObserver.start();
    overlay.mount();

    // Make it clear that the engine is learning at first, even before explicit consent.
    overlay.update({
      emotion: 'calibrating',
      confidence: 0.5,
      source: 'behavior'
    });

    maybeStartBehavior();
    maybeStartWebcam();
  });
}

function onBehaviorFeatures(behaviorFeatures) {
  if (!latestSettings?.behaviorModeEnabled) return;
  if (!emotionEngine) return;

  let result;
  try {
    result = emotionEngine.processBehaviorSample(behaviorFeatures);
  } catch (err) {
    const message = err && typeof err.message === 'string' ? err.message : '';
    if (message.includes('Extension context invalidated')) {
      stopBehavior();
      return;
    }
    throw err;
  }

  if (!result) {
    return;
  }

  const withMeta = {
    ...result,
    source: result.source || 'behavior',
    explanation: buildExplanation(result.emotion, result.source || 'behavior'),
    debug: {
      avgVelocity: behaviorFeatures.avgVelocity,
      avgAcceleration: behaviorFeatures.avgAcceleration,
      directionVariance: behaviorFeatures.directionVariance,
      motionBurstFrequency: behaviorFeatures.motionBurstFrequency,
      hoverTime: behaviorFeatures.hoverTime,
      webcamEnabled: !!latestSettings?.webcamModeEnabled
    }
  };

  safeSendRuntimeMessage({
    type: 'EMOTION_UPDATE',
    payload: withMeta
  });

  overlay.update(withMeta);
}

function onWebcamEmotion(result) {
  if (!latestSettings?.webcamModeEnabled || !latestSettings?.consentAcknowledged) return;
  if (!result) return;

  const withMeta = {
    ...result,
    source: result.source || 'webcam',
    explanation: buildExplanation(result.emotion, result.source || 'webcam'),
    debug: {
      webcamEnabled: true
    }
  };

  safeSendRuntimeMessage({
    type: 'EMOTION_UPDATE',
    payload: withMeta
  });

  overlay.update(withMeta);
}

if (hasRuntime()) {
  chrome.runtime.onMessage.addListener(message => {
    if (message.type === 'EMOTION_STATE') {
      uiAdapter.applyEmotion(message.payload);
      if (debugModeEnabled) {
        overlay.update(message.payload);
      }
    }

    if (message.type === 'SETTINGS_UPDATED') {
      latestSettings = message.payload;
      debugModeEnabled = !!latestSettings.debugModeEnabled;

      if (latestSettings.behaviorModeEnabled) {
        maybeStartBehavior();
      } else {
        stopBehavior();
      }

      if (latestSettings.webcamModeEnabled && latestSettings.consentAcknowledged) {
        maybeStartWebcam();
      } else {
        stopWebcam();
      }
    }
  });
}

init();

