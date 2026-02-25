// Lightweight DOM observer so UI adaptation can respond to dynamic pages.

class DomObserver {
  constructor() {
    this.observer = null;
  }

  start() {
    if (this.observer) return;
    this.observer = new MutationObserver(() => {
      // Hook for future layout-aware adaptation if needed
    });
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  stop() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

