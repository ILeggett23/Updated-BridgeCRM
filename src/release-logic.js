(function (global) {
  const RELEASE_STORAGE_KEY = "bridgeLastSeenVersion";
  const APP_RELEASE = Object.freeze({
    version: "1.3.11",
    assetVersion: "v1.3.11",
    title: "What's New",
    items: Object.freeze([
      Object.freeze({
        icon: "messages",
        title: "Bottom edges that stay clean",
        description: "The primary dock and short Capture chooser now meet the iPhone edge without leaving an empty safe-area panel."
      }),
      Object.freeze({
        icon: "chart",
        title: "Pipeline tabs, back in proportion",
        description: "Prospect and Customer are compact content-width tabs again, without totals beside their labels."
      }),
      Object.freeze({
        icon: "circleCheck",
        title: "Safe where it matters",
        description: "Long forms and action sheets keep their protective spacing while the two visible bottom gaps are removed."
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
