import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const app=fs.readFileSync(path.join(root,"src/app.js"),"utf8");
const styles=fs.readFileSync(path.join(root,"src/styles.css"),"utf8");

test("contact cadence clearly separates automatic and custom modes",()=>{
  const card=app.slice(app.indexOf("function contactHealthCard"),app.indexOf("function contactPersonalInfo"));
  assert.match(card,/name="healthCadenceMode" value="automatic"/);
  assert.match(card,/name="healthCadenceMode" value="custom"/);
  assert.match(card,/data-contact-cadence-custom/);
  assert.match(card,/Days between conversations/);
  assert.doesNotMatch(card,/placeholder="Automatic"/);
});

test("cadence mode binding validates, persists, and restores automatic behavior",()=>{
  const binding=app.slice(app.indexOf("const cadenceForm=$('#contactCadenceForm')"),app.indexOf("$('#editTrackingForm')"));
  assert.match(binding,/input\.disabled=!custom/);
  assert.match(binding,/input\.required=custom/);
  assert.match(binding,/Number\.isInteger\(cadence\)/);
  assert.match(binding,/cadence<1\|\|cadence>365/);
  assert.match(binding,/c\.healthCadenceDays=cadence/);
  assert.match(binding,/c\.healthCadenceDays=null/);
});

test("custom cadence unit cannot overlap the numeric value at mobile widths",()=>{
  assert.match(styles,/\.contact-cadence-custom \.cadence-input \{[^}]*grid-template-columns: minmax\(0,1fr\) auto/);
  assert.match(styles,/\.contact-cadence-custom \.cadence-input input \{ width: 100%; \}/);
  assert.match(styles,/\.contact-cadence-form > \.ui-button \{ width: 100%; min-height: 48px; \}/);
});
