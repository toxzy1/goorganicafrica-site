"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "js", "english-fallback.js"), "utf8");
const listeners = {};
const element = {
  textContent: "English baseline",
  placeholder: "Search",
  title: "English title",
  alt: "English image",
  attributes: {
    "data-i18n": "page.missingKey",
    "data-i18n-placeholder": "page.missingPlaceholder",
    "data-i18n-title": "page.missingTitle",
    "data-i18n-alt": "page.missingAlt"
  },
  getAttribute(name) { return this.attributes[name] || null; },
  setAttribute(name, value) { this.attributes[name] = value; }
};
const document = {
  querySelectorAll(selector) {
    if (selector === "[data-i18n]") return [element];
    if (selector === "[data-i18n-placeholder]" || selector === "[data-i18n-title]" || selector === "[data-i18n-alt]" || selector === "[data-i18n-aria-label]") return [element];
    return [];
  },
  addEventListener(name, callback) { listeners[name] = callback; }
};
const window = { GOA_TRANSLATIONS: { en: { page: { present: "English translation" } } } };
vm.runInNewContext(source, { document, window, WeakMap, Object, String });

listeners.DOMContentLoaded();
element.textContent = "نص عربي";
element.placeholder = "بحث";
element.title = "عنوان عربي";
element.alt = "صورة عربية";
listeners["goa:languagechange"]({ detail: { language: "en" } });

assert.equal(element.textContent, "English baseline", "missing English text key restores the server-rendered baseline");
assert.equal(element.placeholder, "Search", "missing English placeholder key restores its baseline");
assert.equal(element.title, "English title", "missing English title key restores its baseline");
assert.equal(element.alt, "English image", "missing English alt key restores its baseline");

element.textContent = "English translation";
element.attributes["data-i18n"] = "page.present";
listeners["goa:languagechange"]({ detail: { language: "en" } });
assert.equal(element.textContent, "English translation", "a present English key is not overwritten by the fallback");
console.log("English fallback tests passed (missing text and attribute translations restore the original English baseline).");
