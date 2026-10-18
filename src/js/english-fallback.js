(function () {
  "use strict";

  // Keep the server-rendered baseline so a missing English dictionary entry
  // cannot leave the previous language's text visible after switching back.
  var originalText = new WeakMap();
  var originalAttributes = new WeakMap();

  function rememberBaseline() {
    document.querySelectorAll("[data-i18n]").forEach(function (element) {
      if (!originalText.has(element)) originalText.set(element, element.textContent);
    });
    [
      ["data-i18n-placeholder", "placeholder"],
      ["data-i18n-title", "title"],
      ["data-i18n-alt", "alt"],
      ["data-i18n-aria-label", "aria-label"]
    ].forEach(function (pair) {
      document.querySelectorAll("[" + pair[0] + "]").forEach(function (element) {
        var values = originalAttributes.get(element) || {};
        if (!Object.prototype.hasOwnProperty.call(values, pair[1])) {
          values[pair[1]] = element.getAttribute(pair[1]) || "";
          originalAttributes.set(element, values);
        }
      });
    });
  }

  function hasTranslation(key) {
    var value = window.GOA_TRANSLATIONS && window.GOA_TRANSLATIONS.en;
    String(key || "").split(".").forEach(function (part) {
      value = value && value[part];
    });
    return value !== undefined && value !== null && value !== "";
  }

  function restoreMissingEnglishEntries() {
    document.querySelectorAll("[data-i18n]").forEach(function (element) {
      if (!hasTranslation(element.getAttribute("data-i18n")) && originalText.has(element)) {
        element.textContent = originalText.get(element);
      }
    });
    [
      ["data-i18n-placeholder", "placeholder"],
      ["data-i18n-title", "title"],
      ["data-i18n-alt", "alt"],
      ["data-i18n-aria-label", "aria-label"]
    ].forEach(function (pair) {
      document.querySelectorAll("[" + pair[0] + "]").forEach(function (element) {
        if (!hasTranslation(element.getAttribute(pair[0]))) {
          var values = originalAttributes.get(element);
          if (values && Object.prototype.hasOwnProperty.call(values, pair[1])) {
            if (pair[1] === "aria-label") element.setAttribute("aria-label", values[pair[1]]);
            else element[pair[1]] = values[pair[1]];
          }
        }
      });
    });
  }

  // Capture before the language switcher's DOMContentLoaded handler applies
  // any translations. Shared pages are server-rendered in English.
  rememberBaseline();
  document.addEventListener("DOMContentLoaded", function () {
    rememberBaseline();
    document.addEventListener("goa:languagechange", function (event) {
      if (event && event.detail && event.detail.language === "en") {
        restoreMissingEnglishEntries();
      }
    });
  });
}());
