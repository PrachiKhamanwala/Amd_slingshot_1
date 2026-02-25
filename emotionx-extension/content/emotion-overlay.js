// Small floating overlay that shows current emotion + confidence.

class EmotionOverlay {
  constructor() {
    this.root = null;
    this.debug = false;
  }

  mount() {
    if (this.root) return;
    const el = document.createElement('div');
    el.id = 'emotionx-overlay';
    el.style.position = 'fixed';
    el.style.bottom = '16px';
    el.style.right = '16px';
    el.style.zIndex = '2147483647';
    el.style.background = 'rgba(17,24,39,0.92)';
    el.style.color = '#f9fafb';
    el.style.padding = '8px 12px';
    el.style.borderRadius = '999px';
    el.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    el.style.fontSize = '12px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.gap = '6px';
    el.style.boxShadow = '0 10px 25px rgba(0,0,0,0.35)';
    el.style.pointerEvents = 'none';

    const dot = document.createElement('span');
    dot.style.width = '8px';
    dot.style.height = '8px';
    dot.style.borderRadius = '999px';
    dot.style.background = '#22c55e';
    dot.id = 'emotionx-overlay-dot';

    const text = document.createElement('span');
    text.id = 'emotionx-overlay-text';
    text.textContent = 'EmotionX idle';
    text.style.whiteSpace = 'nowrap';

    const debug = document.createElement('span');
    debug.id = 'emotionx-overlay-debug';
    debug.style.marginLeft = '8px';
    debug.style.opacity = '0.8';
    debug.style.fontSize = '11px';
    debug.style.maxWidth = '260px';
    debug.style.whiteSpace = 'nowrap';
    debug.style.overflow = 'hidden';
    debug.style.textOverflow = 'ellipsis';

    el.appendChild(dot);
    el.appendChild(text);
    el.appendChild(debug);

    document.documentElement.appendChild(el);
    this.root = el;
  }

  update(result) {
    if (!this.root) return;
    const text = this.root.querySelector('#emotionx-overlay-text');
    const dot = this.root.querySelector('#emotionx-overlay-dot');
    const debugEl = this.root.querySelector('#emotionx-overlay-debug');
    if (!text || !dot) return;

    if (!result) {
      text.textContent = 'EmotionX idle • Cam off';
      dot.style.background = '#6b7280';
      if (debugEl) debugEl.textContent = '';
      return;
    }

    const { emotion, confidence, source, debug, explanation } = result;

    const webcamOn =
      (debug && debug.webcamEnabled) ||
      source === 'webcam' ||
      source === 'hybrid';

    if (emotion === 'calibrating') {
      text.textContent = 'EmotionX calibrating… • Cam off';
      dot.style.background = '#eab308';
      if (debugEl) {
        debugEl.textContent =
          explanation || 'Learning your normal browsing for a minute or two.';
      }
      return;
    }

    text.textContent = `${emotion || 'unknown'} • ${(confidence * 100).toFixed(
      0
    )}% • ${source || 'behavior'} • Cam ${webcamOn ? 'on' : 'off'}`;

    if (confidence >= 0.8) dot.style.background = '#22c55e';
    else if (confidence >= 0.6) dot.style.background = '#eab308';
    else dot.style.background = '#f97316';

    if (debugEl) {
      if (explanation) {
        debugEl.textContent = explanation;
      } else if (debug) {
        const velocity = debug.avgVelocity != null ? debug.avgVelocity.toFixed(2) : '—';
        const acceleration =
          debug.avgAcceleration != null ? debug.avgAcceleration.toFixed(2) : '—';
        const webcam = debug.webcamEnabled ? 'on' : 'off';
        debugEl.textContent = `v=${velocity}, a=${acceleration}, webcam=${webcam}`;
      } else {
        debugEl.textContent = '';
      }
    }
  }
}

