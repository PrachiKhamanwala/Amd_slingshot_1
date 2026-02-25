## EmotionX – Emotion-Aware Shopping Extension (MV3)

This folder contains a Chrome Manifest V3 extension that implements the **EmotionX** PRD:

- Behavioral, non-webcam emotion inference (scroll/mouse/hover/cart signals)
- Optional webcam-based, on-device emotion approximation
- Local-only processing, with clear consent and mode toggles
- UI overlay and page-level attributes for adaptation

### Structure

- `manifest.json` – MV3 manifest
- `background/` – service worker and global settings
- `content/` – behavior tracking, DOM observer, UI adapter, emotion overlay
- `ai/` – feature extraction, rule-based emotion engine
- `webcam/` – camera controller, motion analyzer, expression classifier
- `privacy/` – consent copy and storage helpers
- `popup/` – quick-toggle UI and consent
- `options/` – full settings and ethical explanations

### Loading the extension

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `emotionx-extension` folder.
4. Click the EmotionX icon to open the popup, accept consent, and enable modes.
5. Visit any shopping site and watch the in-page EmotionX overlay update as you interact.

