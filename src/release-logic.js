(function (global) {
  const RELEASE_STORAGE_KEY = "bridgeLastSeenVersion";
  const APP_RELEASE = Object.freeze({
    version: "1.3.10",
    assetVersion: "v1.3.10",
    title: "What's New",
    items: Object.freeze([
      Object.freeze({
        icon: "messages",
        title: "Sheets that stay in your hand",
        description: "Capture, filters, and follow-up sheets now lock the page behind them, scroll independently, and dismiss with a downward swipe."
      }),
      Object.freeze({
        icon: "chart",
        title: "Motion that connects the app",
        description: "Pipeline, follow-up, analytics, and navigation indicators now travel between selections with the same restrained spring motion."
      }),
      Object.freeze({
        icon: "circleCheck",
        title: "Cleaner mobile actions",
        description: "Filter and reschedule actions stay above the safe area, while the redundant Settings achievements entry has been removed."
      })
    ])
  });

  function shouldShowRelease(lastSeenVersion, release = APP_RELEASE) {
    return String(lastSeenVersion || "") !== release.version;
  }

  function readLastSeenVersion(storage = global.localStorage) {
    try { return storage?.getItem(RELEASE_STORAGE_KEY) || ""; }
    catch { return ""; }
  }

  function markReleaseSeen(storage = global.localStorage, release = APP_RELEASE) {
    try {
      storage?.setItem(RELEASE_STORAGE_KEY, release.version);
      return true;
    } catch {
      return false;
    }
  }

  global.BridgeRelease = Object.freeze({
    APP_RELEASE,
    RELEASE_STORAGE_KEY,
    shouldShowRelease,
    readLastSeenVersion,
    markReleaseSeen
  });
})(globalThis);
