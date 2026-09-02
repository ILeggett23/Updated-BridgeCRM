(() => {
  "use strict";

  const VERSION = "1.3.45";
  const variants = Object.freeze({
    app: `./bridge-app-icon-192.png?v=${VERSION}`,
    mark: `./bridge-ui-mark.svg?v=${VERSION}`
  });
  const escapeAttribute = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);

  function render({ variant = "app", size = 48, className = "", label = "" } = {}) {
    const resolvedVariant = Object.hasOwn(variants, variant) ? variant : "app";
    const resolvedSize = Math.max(1, Math.min(1024, Number(size) || 48));
    const classes = ["bridge-brand-icon", `bridge-brand-icon--${resolvedVariant}`, className].filter(Boolean).join(" ");
    const accessibility = label
      ? `alt="${escapeAttribute(label)}"`
      : 'alt="" aria-hidden="true"';
    return `<img class="${escapeAttribute(classes)}" src="${variants[resolvedVariant]}" width="${resolvedSize}" height="${resolvedSize}" style="--bridge-brand-icon-size:${resolvedSize}px" ${accessibility}>`;
  }

  globalThis.BridgeBrandIcon = Object.freeze({ render, variants });
})();
