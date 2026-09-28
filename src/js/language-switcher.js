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
    try { return document.documentElement.lang || localStorage.getItem("goa_language") || "en"; }
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
    var path = window.location.pathname.replace(/\/+$/, "") || "/";

    // Static pages intentionally keep one shared URL; only their text changes.
    if (/^\/(about|contact|privacy-policy|data-updates)\/?$/.test(path)) {
      return path;
    }

    // Home page keeps the language prefix.
    if (path === "/" || /^\/(fr|ar|pt|sw)$/.test(path)) {
      return code === "en" ? "/" : "/" + code + "/";
    }

    // Blog and eBook pages use the same slug in every language.
    var localizedMatch = path.match(/^\/(fr|ar|pt|sw)\/(blog|ebooks)(?:\/(.*))?$/);
    if (localizedMatch) {
      return code === "en"
        ? "/" + localizedMatch[2] + (localizedMatch[3] ? "/" + localizedMatch[3] + "/" : "/")
        : "/" + code + "/" + localizedMatch[2] + (localizedMatch[3] ? "/" + localizedMatch[3] + "/" : "/");
    }

    var englishMatch = path.match(/^\/(blog|ebooks)(?:\/(.*))?$/);
    if (englishMatch) {
      return code === "en"
        ? "/" + englishMatch[1] + (englishMatch[2] ? "/" + englishMatch[2] + "/" : "/")
        : "/" + code + "/" + englishMatch[1] + (englishMatch[2] ? "/" + englishMatch[2] + "/" : "/");
    }

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
    languageLoads[code] = fetch("/i18n/" + encodeURIComponent(code) + ".json?v=20260927", { cache: "no-store" })
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
        var targetUrl = localizedContentUrl(requested);
        setLanguage(requested);
        if (targetUrl) {
          window.location.assign(targetUrl);
          return;
        }
        refresh();
      });
    }
    refresh().then(function () { readyResolve(window.GOA_I18N); });
  });
}());
