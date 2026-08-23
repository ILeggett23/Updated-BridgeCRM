(function (global) {
  const RELEASE_STORAGE_KEY = "bridgeLastSeenVersion";
  const APP_RELEASE = Object.freeze({
    version: "1.3.12",
    assetVersion: "v1.3.12",
    title: "What's New",
    items: Object.freeze([
      Object.freeze({
        icon: "messages",
        title: "A Safari-safe bottom dock",
        description: "Navigation now keeps a compact interaction inset as Safari reveals or collapses its bottom controls."
      }),
      Object.freeze({
        icon: "chart",
        title: "Pipeline tabs, back in proportion",
        description: "Prospect and Customer are compact content-width tabs again, without totals beside their labels."
      }),
      Object.freeze({
        icon: "circleCheck",
        title: "Compact Capture clearance",
        description: "The short Capture chooser stays clear of the iPhone gesture zone without recreating the oversized empty panel."
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
