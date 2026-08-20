(function (global) {
  const RELEASE_STORAGE_KEY = "bridgeLastSeenVersion";
  const APP_RELEASE = Object.freeze({
    version: "1.3.5",
    assetVersion: "v1.3.5",
    title: "What's New",
    items: Object.freeze([
      Object.freeze({
        icon: "bridge",
        title: "Faster, tighter capture",
        description: "Capture now uses the compact six-action sheet and keeps person selection focused on the next useful choice."
      }),
      Object.freeze({
        icon: "plus",
        title: "Search and follow-ups stay compact",
        description: "People Search, relationship profiles, and the Action Center now match the approved mobile spacing and interaction patterns."
      }),
      Object.freeze({
        icon: "circleCheck",
        title: "Your data stays put",
        description: "This update changes the shared presentation layer without changing your relationships, pipelines, or local storage."
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
