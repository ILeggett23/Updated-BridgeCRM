(function (global) {
  const RELEASE_STORAGE_KEY = "bridgeLastSeenVersion";
  const APP_RELEASE = Object.freeze({
    version: "1.3.42",
    assetVersion: "v1.3.42",
    title: "What's New",
    items: Object.freeze([
      Object.freeze({
        icon: "sparkles",
        title: "Consistent page typography",
        description: "Today, People, Pipeline, and Insights now share the same Newsreader title family, size, weight, spacing, and line height."
      }),
      Object.freeze({
        icon: "bridge",
        title: "Stronger data recovery",
        description: "Bridge can recover from a corrupt browser cache using its durable copy, preserves extension fields, and validates backups before replacement."
      }),
      Object.freeze({
        icon: "people",
        title: "More reliable account sync",
        description: "Cloud sync now handles large paginated workspaces, request races, single-use account tokens, and backup integrity more safely."
      }),
      Object.freeze({
        icon: "rocket",
        title: "Cleaner offline updates",
        description: "The service worker refreshes the complete public shell, isolates app caches, and handles project-path launches and reminders more defensively."
      })
    ])
  });

  function shouldShowRelease(lastSeenVersion, release = APP_RELEASE) {
    const currentRelease = release && typeof release === "object" ? release : APP_RELEASE;
    return String(lastSeenVersion ?? "") !== String(currentRelease.version ?? "");
  }

  function readLastSeenVersion(storage = global.localStorage) {
    try { return typeof storage?.getItem === "function" ? storage.getItem(RELEASE_STORAGE_KEY) || "" : ""; }
    catch { return ""; }
  }

  function markReleaseSeen(storage = global.localStorage, release = APP_RELEASE) {
    const currentRelease = release && typeof release === "object" ? release : APP_RELEASE;
    try {
      if (typeof storage?.setItem !== "function") return false;
      storage.setItem(RELEASE_STORAGE_KEY, currentRelease.version);
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
