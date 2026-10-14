"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const switcher = fs.readFileSync(path.join(__dirname, "..", "src", "js", "language-switcher.js"), "utf8");

async function scenario(pathname, initialLanguage, targets) {
  const storage = { goa_language: initialLanguage };
  const assigned = [];
  const listeners = {};
  const selector = {
    value: "",
    innerHTML: "",
    options: [],
    getAttribute(name) { return name === "data-goa-selector-section" ? null : null; },
    addEventListener(name, fn) { listeners[name] = fn; },
    appendChild(option) { this.options.push(option); }
  };
  const targetMap = targets ? {
    getAttribute(name) {
      const match = name.match(/^data-url-(en|fr|ar|pt|sw)$/);
      return match ? targets[match[1]] || null : null;
    }
  } : null;
  const html = { lang: "en", dir: "ltr" };
  const document = {
    documentElement: html,
    body: { querySelectorAll() { return []; } },
    title: "Test page",
    addEventListener(name, fn) { if (name === "DOMContentLoaded") listeners.domReady = fn; },
    getElementById(id) {
      if (id === "site-language-select") return selector;
      if (id === "goa-language-targets") return targetMap;
      return null;
    },
    createElement() { return { value: "", textContent: "" }; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    dispatchEvent() {}
  };
  const location = {
    pathname,
    origin: "https://example.test",
    assign(url) { assigned.push(url); }
  };
  const languages = [
    {code:"en",native:"English",dir:"ltr"},
    {code:"fr",native:"Français",dir:"ltr"},
    {code:"ar",native:"العربية",dir:"rtl"},
    {code:"pt",native:"Português",dir:"ltr"},
    {code:"sw",native:"Kiswahili",dir:"ltr"}
  ];
  const window = {
    location,
    GOA_LANGUAGES: languages,
    GOA_TRANSLATIONS: {en:{},fr:{},ar:{},pt:{},sw:{}}
  };
  class CustomEvent { constructor(type, init) { this.type=type; this.detail=init && init.detail; } }
  const context = {window, document, location, localStorage: {
    getItem(key) { return Object.prototype.hasOwnProperty.call(storage,key) ? storage[key] : null; },
    setItem(key,value) { storage[key]=String(value); }
  }, CustomEvent, URL, Promise, fetch: async () => ({ok:true,json:async()=>({})}), console};
  vm.runInNewContext(switcher, context, {filename:"language-switcher.js"});
  listeners.domReady();
  await window.GOA_I18N.ready;
  return {selector, listeners, assigned, storage, html, location};
}

(async () => {
  {
    const s = await scenario("/search/", "en");
    s.selector.value = "pt";
    s.listeners.change();
    await Promise.resolve();
    assert.deepEqual(s.assigned, [], "shared search should not navigate away");
    assert.equal(s.location.pathname, "/search/");
    assert.equal(s.html.lang, "pt");
    assert.equal(s.storage.goa_language, "pt");
  }
  {
    const s = await scenario("/pt/blog/", "pt");
    s.selector.value = "fr";
    s.listeners.change();
    assert.deepEqual(s.assigned, ["/fr/blog/"], "localized blog index should route to the same section");
  }
  {
    const s = await scenario("/agricultural-news/guinea-bissau/", "en", {
      en:"/agricultural-news/guinea-bissau/",
      fr:"/fr/agricultural-news/guinea-bissau/",
      ar:"/ar/agricultural-news/guinea-bissau/",
      pt:"/pt/agricultural-news/guinea-bissau/",
      sw:"/sw/agricultural-news/guinea-bissau/"
    });
    s.selector.value = "fr";
    s.listeners.change();
    assert.deepEqual(s.assigned, ["/fr/agricultural-news/guinea-bissau/"], "country article should use its explicit translation target");
  }
  {
    const s = await scenario("/blog/unmapped-article/", "en");
    s.selector.value = "sw";
    s.listeners.change();
    await Promise.resolve();
    assert.deepEqual(s.assigned, [], "unmapped article should not guess a destination");
    assert.equal(s.html.lang, "sw");
  }
  {
    const s = await scenario("/about/", "en");
    s.selector.value = "ar";
    s.listeners.change();
    assert.deepEqual(s.assigned, ["/ar/about/"], "known static page should route to the same localized page");
  }
  console.log("Language-switcher interaction tests passed (5 scenarios).");
})().catch(error => { console.error(error); process.exitCode = 1; });
