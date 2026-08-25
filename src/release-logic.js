(function (global) {
  const RELEASE_STORAGE_KEY = "bridgeLastSeenVersion";
  const APP_RELEASE = Object.freeze({
    version: "1.3.28",
    assetVersion: "v1.3.28",
    title: "What's New",
    items: Object.freeze([
      Object.freeze({
        icon: "people",
        title: "Secure Bridge accounts",
        description: "Sign in with email and password to keep your private relationship workspace synced across devices."
      }),
      Object.freeze({
        icon: "people",
        title: "Local-first when disabled",
        description: "Local development still opens directly when cloud authentication is explicitly turned off."
      }),
      Object.freeze({
        icon: "circleCheck",
        title: "Verification recovery",
        description: "A dedicated resend action helps unverified accounts request a fresh email safely."
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
