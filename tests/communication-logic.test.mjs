import test from "node:test";
import assert from "node:assert/strict";

await import(new URL("../src/communication-logic.js", import.meta.url));
const { canonicalPhone, phoneIdentity, telHref, smsHref } = globalThis.BridgeCommunication;

test("US phone formats normalize to one canonical E.164 number", () => {
  for (const value of ["(479) 738-7507", "479-738-7507", "1 (479) 738-7507", "+1 (479) 738-7507", "+14797387507"]) {
    assert.equal(canonicalPhone(value), "+14797387507");
    assert.equal(telHref(value), "tel:+14797387507");
    assert.equal(smsHref(value), "sms:+14797387507");
  }
  assert.equal(phoneIdentity("+1 (479) 738-7507"), "14797387507");
});

test("invalid or incomplete phone numbers never produce communication links", () => {
  for (const value of ["", "479-73", "not a number", "1234567890123456"]) {
    assert.equal(canonicalPhone(value), null);
    assert.equal(telHref(value), null);
    assert.equal(smsHref(value), null);
  }
});

test("non-coercible phone values fail closed without throwing", () => {
  const nonCoercible = Object.create(null);
  assert.equal(canonicalPhone(nonCoercible), null);
  assert.equal(phoneIdentity(nonCoercible), "");
  assert.equal(telHref(nonCoercible), null);
  assert.equal(smsHref(nonCoercible), null);
});
