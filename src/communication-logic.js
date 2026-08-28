(function installBridgeCommunication(global) {
  const digitsOnly = value => {
    try { return String(value ?? "").replace(/\D/g, ""); } catch { return ""; }
  };

  function canonicalPhone(value) {
    let raw;
    try { raw = String(value ?? "").trim(); } catch { return null; }
    if (!raw) return null;
    const digits = digitsOnly(raw.replace(/(?:ext\.?|x)\s*\d+$/i, ""));
    if (raw.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    return null;
  }

  function phoneIdentity(value) {
    const canonical = canonicalPhone(value);
    return canonical ? canonical.slice(1) : "";
  }

  function telHref(value) {
    const canonical = canonicalPhone(value);
    return canonical ? `tel:${canonical}` : null;
  }

  function smsHref(value) {
    const canonical = canonicalPhone(value);
    return canonical ? `sms:${canonical}` : null;
  }

  global.BridgeCommunication = Object.freeze({ canonicalPhone, phoneIdentity, telHref, smsHref });
})(globalThis);
