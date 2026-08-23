(function (global) {
  const RELEASE_STORAGE_KEY = "bridgeLastSeenVersion";
  const APP_RELEASE = Object.freeze({
    version: "1.3.7",
    assetVersion: "v1.3.7",
    title: "What's New",
    items: Object.freeze([
      Object.freeze({
        icon: "messages",
        title: "Clearer capture and follow-up",
        description: "Person selection, timeline events, cadence controls, and Capture sheets now stay clear and consistent on mobile."
      }),
      Object.freeze({
        icon: "chart",
        title: "Reliable activity charts",
        description: "Day and Month analytics now handle empty, single-value, and dense activity ranges without oversized bars or overlapping labels."
      }),
      Object.freeze({
        icon: "circleCheck",
        title: "Mobile forms that fit",
        description: "Notifications, Goals, Personal Info, Edit Person, and Log Text now share accessible controls, safe-area spacing, and product-facing copy."
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
