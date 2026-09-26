(function () {
  "use strict";

  function currentLanguage() {
    try { return localStorage.getItem("goa_language") || document.documentElement.lang || "en"; }
    catch (_) { return document.documentElement.lang || "en"; }
  }

  function applyListing(language) {
    var items = Array.prototype.slice.call(document.querySelectorAll(".content-variant"));
    if (!items.length) return;

    var groups = {};
    items.forEach(function (item) {
      var group = item.getAttribute("data-content-group") || item.getAttribute("href");
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
    });

    Object.keys(groups).forEach(function (group) {
      var variants = groups[group];
      var preferred = variants.find(function (item) {
        return (item.getAttribute("data-content-language") || "en") === language;
      }) || variants.find(function (item) {
        return (item.getAttribute("data-content-language") || "en") === "en";
      }) || variants[0];

      variants.forEach(function (item) {
        item.hidden = item !== preferred;
      });
    });
  }

  function applyDetail(language) {
    var map = document.querySelector('[data-content-localization="detail"]');
    if (!map) return;

    var variants = Array.prototype.slice.call(map.querySelectorAll("[data-content-variant]"));
    var target = variants.find(function (item) {
      return (item.getAttribute("data-language") || "en") === language;
    });

    if (target && target.getAttribute("href") !== window.location.pathname) {
      window.location.assign(target.getAttribute("href"));
    }
  }

  function refresh(event) {
    var language = event && event.detail && event.detail.language
      ? event.detail.language
      : currentLanguage();
    applyListing(language);
    applyDetail(language);
  }

  document.addEventListener("goa:languagechange", refresh);
  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(function () { refresh(); }, 0);
  });
}());
