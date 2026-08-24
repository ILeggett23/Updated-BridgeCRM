(function (global) {
  const RELEASE_STORAGE_KEY = "bridgeLastSeenVersion";
  const APP_RELEASE = Object.freeze({
    version: "1.3.17",
    assetVersion: "v1.3.17",
    title: "What's New",
    items: Object.freeze([
      Object.freeze({
        icon: "people",
        title: "People filters stay in proportion",
        description: "Selected filters now keep the same size and touch target as every other option."
      }),
      Object.freeze({
        icon: "messages",
        title: "MSA and DTM are easier to find",
        description: "Activity classification now uses the same prominent multi-select control throughout capture and relationship tracking."
      }),
      Object.freeze({
        icon: "circleCheck",
        title: "Safer mobile forms and navigation",
        description: "Edit Person fields stay reachable, while the bottom navigation clears the safe area and focuses the selected destination locally."
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
