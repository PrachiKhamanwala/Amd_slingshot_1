// Applies emotion-driven UI hints non-intrusively.

const EMOTION_ACTIONS = {
  confused: 'Showing comparison helpers',
  frustrated: 'Offering support-friendly messaging',
  impulsive: 'Highlighting urgency cues',
  engaged: 'Highlighting bundles and recommendations',
  indecisive: 'Highlighting best-seller badges',
  calm: 'Showing premium options',
  happy: 'Reinforcing positive feedback',
  neutral: 'Maintaining baseline layout',
  focused: 'Reducing distractions',
  disappointed: 'Softening upsell pressure'
};

class UiAdapter {
  constructor() {
    this.lastEmotion = null;
    this.lastUpdateAt = 0;
    this.recentEmotions = [];
  }

  applyEmotion(result) {
    const emotion = result?.emotion;
    const confidence = result?.confidence ?? 0;
    if (!emotion) return;

    this.recentEmotions.push(emotion);
    if (this.recentEmotions.length > 3) {
      this.recentEmotions.shift();
    }

    const stable =
      this.recentEmotions.length === 3 &&
      this.recentEmotions.every(e => e === emotion);

    if (!stable || confidence < 0.7) {
      return;
    }

    const now = Date.now();
    const emotionChanged = emotion !== this.lastEmotion;
    const tooSoon = now - this.lastUpdateAt < 5000;

    if (!emotionChanged && tooSoon) {
      return;
    }

    const actionDescription = EMOTION_ACTIONS[emotion] || '';

    document.documentElement.dataset.emotionxEmotion = emotion;
    document.documentElement.dataset.emotionxAction = actionDescription;

    this.lastEmotion = emotion;
    this.lastUpdateAt = now;
  }
}

