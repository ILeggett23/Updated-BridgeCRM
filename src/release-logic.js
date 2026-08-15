(function (global) {
  const RELEASE_STORAGE_KEY = "bridgeLastSeenVersion";
  const APP_RELEASE = Object.freeze({
    version: "1.3.4",
    assetVersion: "v1.3.4",
    title: "What's New",
    items: Object.freeze([
      Object.freeze({
        icon: "bridge",
        title: "A consistent Bridge foundation",
        description: "Navigation, headers, controls, sheets, and feedback now share the approved mobile design system."
      }),
      Object.freeze({
        icon: "plus",
        title: "Capture stays close",
        description: "The centered Capture action and mobile-safe sheets remain available from every primary destination."
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
