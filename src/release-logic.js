(function (global) {
  const RELEASE_STORAGE_KEY = "bridgeLastSeenVersion";
  const APP_RELEASE = Object.freeze({
    version: "1.3.2",
    assetVersion: "v1.3.2",
    title: "What's New",
    items: Object.freeze([
      Object.freeze({
        icon: "plus",
        title: "Faster Capture",
        description: "Conversation and meeting capture now follow a focused four-step flow with real recent people and places."
      }),
      Object.freeze({
        icon: "target",
        title: "Clearer progress",
        description: "Goals, streaks, and achievements now share the same compact visual language as Today and Insights."
      }),
      Object.freeze({
        icon: "circleCheck",
        title: "Unified settings",
        description: "Account, notifications, sync, and scorecard screens now match Bridge's approved mobile presentation."
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
