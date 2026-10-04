(function () {
  "use strict";

  var languages = Array.isArray(window.GOA_LANGUAGES)
    ? window.GOA_LANGUAGES.filter(function (item) { return item && item.code && item.enabled !== false; })
    : [];
  var dictionary = window.GOA_TRANSLATIONS || {};
  var languageLoads = {};
  var readyResolve;
  var ready = new Promise(function (resolve) { readyResolve = resolve; });

  function currentLanguage() {
    // Calculator routes are the only shared URLs allowed to remember a
    // selected language. All other pages are authoritative from their URL:
    // unprefixed pages are English, while /fr/, /ar/, /pt/ and /sw/ pages
    // are explicitly localized.
    var path = window.location.pathname.replace(/\/+$/, "") || "/";

    var calculatorLanguage = path.match(/^\/(?:[a-z]{2}\/)?(fr|ar|pt|sw)\/farm-profit-calculator$/);
    if (calculatorLanguage) return calculatorLanguage[1];

    if (path === "/farm-profit-calculator") {
      try { return localStorage.getItem("goa_language") || document.documentElement.lang || "en"; }
      catch (_) { return document.documentElement.lang || "en"; }
    }

    var urlLanguage = path.match(/^\/(fr|ar|pt|sw)(?:\/|$)/);
    if (urlLanguage) return urlLanguage[1];

    return "en";
  }

  function metadata(code) {
    return languages.find(function (item) { return item.code === code; }) ||
      languages.find(function (item) { return item.code === "en"; }) ||
      { code: "en", dir: "ltr" };
  }

  function resolve(code, path) {
    if (code === "en" && path === "advice.adviceInsights") return "Advice & Insights";
    var parts = path.split(".");
    var value = dictionary[code] || {};
    var english = dictionary.en || {};
    parts.forEach(function (part) {
      value = value && value[part];
      english = english && english[part];
    });
    return value === undefined || value === null || value === "" ? english : value;
  }

  function interpolate(value, variables) {
    return String(value).replace(/\{(\w+)\}/g, function (_, key) {
      return variables && variables[key] !== undefined ? variables[key] : "";
    });
  }

  function varsFor(element) {
    try { return JSON.parse(element.getAttribute("data-i18n-vars") || "{}"); }
    catch (_) { return {}; }
  }

  function apply(root, code) {
    if (!root) return;
    root.querySelectorAll("[data-i18n]").forEach(function (element) {
      var value = resolve(code, element.getAttribute("data-i18n"));
      if (value !== undefined) element.textContent = interpolate(value, varsFor(element));
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach(function (element) {
      var value = resolve(code, element.getAttribute("data-i18n-placeholder"));
      if (value !== undefined) element.placeholder = value;
    });
    root.querySelectorAll("[data-i18n-title]").forEach(function (element) {
      var value = resolve(code, element.getAttribute("data-i18n-title"));
      if (value !== undefined) element.title = interpolate(value, varsFor(element));
    });
    root.querySelectorAll("[data-i18n-alt]").forEach(function (element) {
      var value = resolve(code, element.getAttribute("data-i18n-alt"));
      if (value !== undefined) element.alt = interpolate(value, varsFor(element));
    });
    root.querySelectorAll("[data-i18n-aria-label]").forEach(function (element) {
      var value = resolve(code, element.getAttribute("data-i18n-aria-label"));
      if (value !== undefined) element.setAttribute("aria-label", value);
    });
  }

  function setLanguage(requested) {
    var code = languages.some(function (item) { return item.code === requested; }) ? requested : "en";
    var meta = metadata(code);
    try { localStorage.setItem("goa_language", code); } catch (_) {}
    document.documentElement.lang = code;
    document.documentElement.dir = meta.dir || "ltr";
    return code;
  }

  function localizedContentUrl(code) {
    // Detail pages publish an explicit, server-generated language map.
    // Prefer that exact destination and never guess a translated content slug.
    var map = document.getElementById("goa-language-targets");
    if (map) {
      var target = map.getAttribute("data-url-" + code);
      if (target) return target;
    }

    var path = window.location.pathname.replace(/\/+$/, "") || "/";
    var languageMatch = path.match(/^\/(fr|ar|pt|sw)(?:\/(.*))?$/);
    var rest = languageMatch ? (languageMatch[2] || "") : path.replace(/^\//, "");

    // Blog and eBook index pages are language-specific server-rendered pages.
    // Resolve these deterministically before consulting generic translation links,
    // so an unrelated/stale content link can never redirect the selector elsewhere.
    if (rest === "blog") return code === "en" ? "/blog/" : "/" + code + "/blog/";
    if (rest === "ebooks") return code === "en" ? "/ebooks/" : "/" + code + "/ebooks/";

    // Static pages intentionally keep one shared URL; only their text changes.
    if (/^(about|contact|privacy-policy|data-updates|agricultural-finance|agricultural-grants|agriculture-resources|farm-machinery)$/.test(rest)) return "/" + rest + "/";

    // Home page.
    if (rest === "") return code === "en" ? "/" : "/" + code + "/";

    // Shared pages (such as the calculator) stay on the same URL.
    if (rest === "farm-profit-calculator") return "/farm-profit-calculator/";

    // Keep the visible per-content language links as a fallback for older
    // localized content that does not yet have an explicit target map.
    var link = document.querySelector('.translation-links a[data-language="' + code + '"]');
    if (link && link.getAttribute("href")) return link.getAttribute("href");

    return null;
  }

  function updateLocalizedNavigation(code) {
    document.querySelectorAll("[data-localized-section]").forEach(function (link) {
      var section = link.getAttribute("data-localized-section");
      var sectionPath = section === "calculator" ? "farm-profit-calculator" : section;
      link.href = section === "home"
        ? (code === "en" ? "/" : "/" + code + "/")
        : (section === "calculator"
          ? "/farm-profit-calculator/"
          : ((section === "about" || section === "contact" || section === "privacy-policy" || section === "data-updates")
            ? "/" + sectionPath + "/"
            : (code === "en" ? "/" + sectionPath + "/" : "/" + code + "/" + sectionPath + "/")));
    });
  }

  function loadLanguage(code) {
    if (dictionary[code]) return Promise.resolve(dictionary[code]);
    if (languageLoads[code]) return languageLoads[code];
    languageLoads[code] = fetch("/i18n/" + encodeURIComponent(code) + ".json?v=20260929", { cache: "default" })
      .then(function (response) {
        if (!response.ok) throw new Error("Translation bundle unavailable");
        return response.json();
      })
      .then(function (translations) {
        dictionary[code] = translations || {};
        return dictionary[code];
      })
      .catch(function () {
        dictionary[code] = dictionary.en || {};
        return dictionary[code];
      });
    return languageLoads[code];
  }

  function refresh() {
    var code = setLanguage(currentLanguage());
    return loadLanguage(code).then(function () {
      apply(document.body, code);

      var homeTitle = resolve(code, "home.pageTitle");
      var homeDescription = resolve(code, "home.metaDescription");
      if (homeTitle && (location.pathname === "/" || location.pathname === "")) document.title = homeTitle;

      var meta = document.querySelector('meta[name="description"]');
      if (meta && homeDescription && (location.pathname === "/" || location.pathname === "")) {
        meta.setAttribute("content", homeDescription);
      }

      updateLocalizedNavigation(code);
      var selector = document.getElementById("site-language-select");
      if (selector) selector.value = code;
      document.dispatchEvent(new CustomEvent("goa:languagechange", { detail: { language: code } }));
      return code;
    });
  }

  window.GOA_I18N = {
    lang: currentLanguage,
    setLanguage: setLanguage,
    t: function (section, key, variables) {
      return interpolate(resolve(currentLanguage(), section + "." + key), variables);
    },
    refresh: refresh,
    translate: apply,
    ready: ready
  };

  document.addEventListener("DOMContentLoaded", function () {
    var selector = document.getElementById("site-language-select");
    if (selector) {
      selector.innerHTML = "";
      languages.forEach(function (item) {
        var option = document.createElement("option");
        option.value = item.code;
        option.textContent = item.native;
        selector.appendChild(option);
      });
      selector.addEventListener("change", function () {
        var requested = this.value;
        var section = selector.getAttribute("data-goa-selector-section");
        var targetUrl = section
          ? (requested === "en"
            ? "/" + (section === "home" ? "" : section + "/")
            : "/" + requested + "/" + (section === "home" ? "" : section + "/"))
          : localizedContentUrl(requested);
        setLanguage(requested);
        // Shared pages intentionally keep the same URL. Do not reload them,
        // because a reload restores the server's default <html lang="en">.
        var currentPath = window.location.pathname.replace(/\/+$/, "") || "/";
        var targetPath = targetUrl ? new URL(targetUrl, window.location.origin).pathname.replace(/\/+$/, "") || "/" : null;
        if (targetUrl && targetPath !== currentPath) {
          window.location.assign(targetUrl);
          return;
        }
        refresh();
      });
    }
    refresh().then(function () { readyResolve(window.GOA_I18N); });
  });
}());
