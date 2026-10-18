"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "js", "language-switcher.js"), "utf8");
const listeners = {};
const storage = { goa_language: "ar" };
const selector = {
  value: "",
  innerHTML: "",
  options: [],
  getAttribute() { return null; },
  addEventListener(name, callback) { listeners[name] = callback; },
  appendChild(option) { this.options.push(option); }
};
const document = {
  documentElement: { lang: "en", dir: "ltr" },
  body: { querySelectorAll() { return []; } },
  title: "Test",
  addEventListener(name, callback) { if (name === "DOMContentLoaded") listeners.domReady = callback; },
  getElementById(id) { return id === "site-language-select" ? selector : null; },
  createElement() { return { value: "", textContent: "" }; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  dispatchEvent() {}
};
const location = { pathname: "/markets/", origin: "https://example.test", assign() { throw new Error("Shared page should not navigate"); } };
const window = {
  location,
  GOA_LANGUAGES: [
    { code: "en", native: "English", dir: "ltr" },
    { code: "fr", native: "Français", dir: "ltr" },
    { code: "ar", native: "العربية", dir: "rtl" },
    { code: "pt", native: "Português", dir: "ltr" },
    { code: "sw", native: "Kiswahili", dir: "ltr" }
  ],
  // Mimic the smaller inline dictionary injected by the base layout.
  GOA_TRANSLATIONS: { en: { opportunities: { title: "English title" } } }
};
class CustomEvent { constructor(type, init) { this.type = type; this.detail = init && init.detail; } }
async function fetch(url) {
  const code = url.includes("/i18n/en.json") ? "en" : "ar";
  const bundle = code === "en"
    ? { opportunities: { title: "Full English title", activeStatus: "Active", noEligibility: "Check the official source." } }
    : { opportunities: { activeStatus: "نشط", noEligibility: "تحقق من المصدر الرسمي." } };
  return { ok: true, json: async () => bundle };
}
const context = {
  window, document, location, CustomEvent, URL, Promise, fetch, console,
  localStorage: {
    getItem(key) { return storage[key] || null; },
    setItem(key, value) { storage[key] = String(value); }
  }
};
vm.runInNewContext(source, context, { filename: "language-switcher.js" });

(async () => {
  listeners.domReady();
  await window.GOA_I18N.ready;
  assert.equal(window.GOA_I18N.lang(), "ar", "initial shared-page language should be Arabic from saved choice");
  assert.equal(window.GOA_I18N.t("opportunities", "activeStatus"), "نشط", "Arabic bundle should provide the Arabic label");

  selector.value = "en";
  listeners.change.call(selector);
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(window.GOA_I18N.lang(), "en", "English should be selected");
  assert.equal(window.GOA_I18N.t("opportunities", "activeStatus"), "Active", "full English bundle fills keys missing from the inline dictionary");
  assert.equal(window.GOA_I18N.t("opportunities", "noEligibility"), "Check the official source.", "English fallback text is restored for the second missing key");
  assert.equal(window.GOA_I18N.t("opportunities", "title"), "Full English title", "full English bundle overrides stale inline wording");
  console.log("English language-switch regression test passed (Arabic to English on a shared page).");
})().catch(error => { console.error(error); process.exitCode = 1; });
