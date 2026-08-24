(function (global) {
  const RELEASE_STORAGE_KEY = "bridgeLastSeenVersion";
  const APP_RELEASE = Object.freeze({
    version: "1.3.21",
    assetVersion: "v1.3.21",
    title: "What's New",
    items: Object.freeze([
      Object.freeze({
        icon: "people",
        title: "Pages open without jumping",
        description: "Settings sections and focused screens now render at their final scroll position with motion that never shifts the layout."
      }),
      Object.freeze({
        icon: "people",
        title: "Email for every relationship",
        description: "Save, edit, search, export, and open a person's optional email address from their profile."
      }),
      Object.freeze({
        icon: "circleCheck",
        title: "More compact contact details",
        description: "Phone and email now fit into a tighter profile layout without crowding mobile controls."
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
