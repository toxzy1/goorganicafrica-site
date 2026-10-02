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
    // Language-prefixed URLs are authoritative for localized content.
    // Shared pages (About, Contact, Privacy, Data Updates, Calculator)
    // remember the user's selected language because their URL stays unchanged.
    var path = window.location.pathname.replace(/\/+$/, "") || "/";
    var urlLanguage = path.match(/^\/(fr|ar|pt|sw)(?:\/|$)/);
    if (urlLanguage) return urlLanguage[1];

    // Calculator pages use /<country>/<language>/farm-profit-calculator/.
    // The language segment is authoritative even though the country comes first.
    var calculatorLanguage = path.match(/^\/[^/]+\/(en|fr|ar|pt|sw)\/farm-profit-calculator(?:\/|$)/);
    if (calculatorLanguage) return calculatorLanguage[1];

    // Language-prefixed content has an authoritative URL. The English
    // versions of the blog, eBooks and homepage are also authoritative:
    // never let an old localStorage choice silently turn /blog/ into a
    // French/Arabic/Portuguese/Swahili page while the URL remains English.
    if (path === "/" || path === "/blog" || path === "/ebooks" ||
        path.indexOf("/blog/") === 0 || path.indexOf("/ebooks/") === 0) return "en";

    // Shared pages intentionally remember the user's selected language.
    try { return localStorage.getItem("goa_language") || document.documentElement.lang || "en"; }
    catch (_) { return document.documentElement.lang || "en"; }
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
    if (/^(about|contact|privacy-policy|data-updates)$/.test(rest)) return "/" + rest + "/";

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
          : (section === "resources"
            ? "/agriculture-resources/"
            : ((section === "about" || section === "contact" || section === "privacy-policy" || section === "data-updates")
              ? "/" + sectionPath + "/"
              : (code === "en" ? "/" + sectionPath + "/" : "/" + code + "/" + sectionPath + "/"))));
    });
  }

  function loadLanguage(code) {
    if (dictionary[code]) return Promise.resolve(dictionary[code]);
    if (languageLoads[code]) return languageLoads[code];

    var version = window.GOA_ASSET_VERSION || "20261002";
    var url = "/i18n/" + encodeURIComponent(code) + ".json?v=" + encodeURIComponent(version);

    function request(attempt) {
      return fetch(url, { cache: "default" }).then(function (response) {
        if (!response.ok) throw new Error("Translation bundle unavailable");
        return response.json();
      }).catch(function (error) {
        if (attempt < 1) return request(attempt + 1);
        throw error;
      });
    }

    languageLoads[code] = request(0).then(function (translations) {
      dictionary[code] = translations || {};
      return dictionary[code];
    }).catch(function () {
      // Never replace a failed language with English. The caller can leave
      // server-rendered text untouched instead of silently showing the wrong language.
      delete languageLoads[code];
      return null;
    });
    return languageLoads[code];
  }

  function isServerRenderedContentPath() {
    var path = window.location.pathname.replace(/\/+$/, "") || "/";
    return path === "/blog" || path.indexOf("/blog/") === 0 ||
      path === "/ebooks" || path.indexOf("/ebooks/") === 0 ||
      path === "/fr/blog" || path.indexOf("/fr/blog/") === 0 ||
      path === "/ar/blog" || path.indexOf("/ar/blog/") === 0 ||
      path === "/pt/blog" || path.indexOf("/pt/blog/") === 0 ||
      path === "/sw/blog" || path.indexOf("/sw/blog/") === 0 ||
      path === "/fr/ebooks" || path.indexOf("/fr/ebooks/") === 0 ||
      path === "/ar/ebooks" || path.indexOf("/ar/ebooks/") === 0 ||
      path === "/pt/ebooks" || path.indexOf("/pt/ebooks/") === 0 ||
      path === "/sw/ebooks" || path.indexOf("/sw/ebooks/") === 0;
  }

  function refresh() {
    var code = setLanguage(currentLanguage());
    if (isServerRenderedContentPath()) {
      // Blog and eBook pages are fully server-rendered in their own language.
      // Do not run the generic client-side translation layer on these routes.
      document.dispatchEvent(new CustomEvent("goa:languagechange", { detail: { language: code } }));
      return Promise.resolve(code);
    }
    return loadLanguage(code).then(function (translations) {
      if (!translations) {
        // Translation loading failed after one retry. Do not overwrite the
        // server-rendered page with the English fallback.
        document.dispatchEvent(new CustomEvent("goa:languagechange", { detail: { language: code, translationLoadFailed: true } }));
        return code;
      }
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
        var targetUrl = localizedContentUrl(requested);
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
