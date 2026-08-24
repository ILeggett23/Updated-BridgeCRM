import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

test("optional contact email survives normalization and every person creation path", () => {
  assert.match(source, /email: String\(contact\.email \|\| ""\)\.trim\(\)/);
  assert.match(source, /const contact=\{id:uid\(\),fullName,phoneNumber,email,capturedPhoneNumber/);
  assert.match(source, /name="email" type="email" autocomplete="email" inputmode="email"/);
  assert.match(source, /const contact=\{id:uid\(\),fullName,phoneNumber,email,capturedPhoneNumber:phoneNumber,phoneCapturedAt:phoneNumber\?conversationDate:null/);
});

test("relationship email is editable, validated, visible, and actionable", () => {
  assert.match(source, /function isValidEmail\(value\)/);
  assert.match(source, /c\.email=nextEmail/);
  assert.match(source, /mailto:\$\{encodeURIComponent\(email\)\}/);
  assert.match(source, /<strong>Email<\/strong>/);
  assert.match(styles, /\.profile-contact-lines \{[^}]*grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
});

test("profile quick actions place email alongside call, text, log, and follow up", () => {
  const profile = source.slice(source.indexOf("function relationshipProfileOverview"), source.indexOf("function contactModal"));
  assert.match(profile, /href="\$\{emailHref\(c\.email\)\}" aria-label="Email \$\{escapeHTML\(c\.fullName\)\}"/);
  assert.match(profile, /Email unavailable; no email address/);
  assert.match(profile, /\$\{icons\.mail\}<span>Email<\/span>/);
  assert.match(styles, /\.profile-quick-actions \{[^}]*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.profile-quick-actions > a, \.profile-quick-actions > button \{[^}]*text-decoration: none/);
  assert.match(styles, /\.profile-quick-actions > :is\(a,button\) span \{[^}]*white-space: nowrap/);
});

test("contact CSV exports email without changing the JSON backup format", () => {
  assert.match(source, /\['Name','Phone','Email','Role'/);
  assert.match(source, /JSON\.stringify\(state,null,2\)/);
});
