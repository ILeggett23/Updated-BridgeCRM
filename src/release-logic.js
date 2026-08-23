(function (global) {
  const RELEASE_STORAGE_KEY = "bridgeLastSeenVersion";
  const APP_RELEASE = Object.freeze({
    version: "1.3.13",
    assetVersion: "v1.3.13",
    title: "What's New",
    items: Object.freeze([
      Object.freeze({
        icon: "messages",
        title: "A cleaner raised dock",
        description: "Navigation now sits slightly higher on iPhone without the dark translucent border or shadow band."
      }),
      Object.freeze({
        icon: "chart",
        title: "Pipeline tabs, back in proportion",
        description: "Prospect and Customer are compact content-width tabs again, without totals beside their labels."
      }),
      Object.freeze({
        icon: "circleCheck",
        title: "Capture matches the preview",
        description: "The short Capture chooser returns to the Magic Patterns 16-pixel finish beneath its final row."
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
