(function () {
  "use strict";

  var languages = Array.isArray(window.GOA_LANGUAGES)
    ? window.GOA_LANGUAGES.filter(function (item) { return item && item.code && item.enabled !== false; })
    : [];
  var dictionary = window.GOA_TRANSLATIONS || {};
  var languageLoads = {};
  // Prevent a slower, earlier language request from overwriting a newer choice.
  var refreshSequence = 0;
  var readyResolve;
  var ready = new Promise(function (resolve) { readyResolve = resolve; });

  function currentLanguage() {
    // Calculator and explicitly shared pages keep one URL across languages.
    // Preserve the visitor's selector choice on these routes instead of
    // resetting the interface to English because the URL has no language prefix.
    var path = window.location.pathname.replace(/\/+$/, "") || "/";

    var calculatorLanguage = path.match(/^\/[a-z]{2}\/(fr|ar|pt|sw)\/farm-profit-calculator$/);
    if (calculatorLanguage) return calculatorLanguage[1];

    if (/^\/(?:farm-profit-calculator|search|farmer-decision-centre|markets|opportunities|agricultural-services|my-agriculture|agricultural-intelligence|agriculture-resources|agricultural-news|about|contact|organic-farming|privacy-policy|data-updates)$/.test(path)) {
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
      if (!element.hasAttribute("data-i18n-default")) {
        element.setAttribute("data-i18n-default", element.textContent || "");
      }
      var value = resolve(code, element.getAttribute("data-i18n"));
      if (value === undefined || value === null || value === "") value = element.getAttribute("data-i18n-default");
      element.textContent = interpolate(value, varsFor(element));
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach(function (element) {
      if (!element.hasAttribute("data-i18n-placeholder-default")) element.setAttribute("data-i18n-placeholder-default", element.placeholder || "");
      var value = resolve(code, element.getAttribute("data-i18n-placeholder"));
      element.placeholder = value === undefined || value === null || value === "" ? element.getAttribute("data-i18n-placeholder-default") : value;
    });
    root.querySelectorAll("[data-i18n-title]").forEach(function (element) {
      if (!element.hasAttribute("data-i18n-title-default")) element.setAttribute("data-i18n-title-default", element.title || "");
      var value = resolve(code, element.getAttribute("data-i18n-title"));
      if (value === undefined || value === null || value === "") value = element.getAttribute("data-i18n-title-default");
      element.title = interpolate(value, varsFor(element));
    });
    root.querySelectorAll("[data-i18n-alt]").forEach(function (element) {
      if (!element.hasAttribute("data-i18n-alt-default")) element.setAttribute("data-i18n-alt-default", element.alt || "");
      var value = resolve(code, element.getAttribute("data-i18n-alt"));
      if (value === undefined || value === null || value === "") value = element.getAttribute("data-i18n-alt-default");
      element.alt = interpolate(value, varsFor(element));
    });
    root.querySelectorAll("[data-i18n-aria-label]").forEach(function (element) {
      if (!element.hasAttribute("data-i18n-aria-label-default")) element.setAttribute("data-i18n-aria-label-default", element.getAttribute("aria-label") || "");
      var value = resolve(code, element.getAttribute("data-i18n-aria-label"));
      if (value === undefined || value === null || value === "") value = element.getAttribute("data-i18n-aria-label-default");
      element.setAttribute("aria-label", value);
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
    if (rest === "organic-farming") return code === "en" ? "/organic-farming/" : "/" + code + "/organic-farming/";
    if (rest === "agricultural-news") return code === "en" ? "/agricultural-news/" : "/" + code + "/agricultural-news/";
    if (rest === "agriculture-resources") return code === "en" ? "/agriculture-resources/" : "/" + code + "/agriculture-resources/";
    if (rest === "agricultural-finance") return code === "en" ? "/agricultural-finance/" : "/" + code + "/agricultural-finance/";
    if (rest === "agricultural-grants") return code === "en" ? "/agricultural-grants/" : "/" + code + "/agricultural-grants/";
    if (rest === "farm-machinery") return code === "en" ? "/farm-machinery/" : "/" + code + "/farm-machinery/";

    // Search and discovery tools do not have separately generated localized
    // route trees. Keep these tools on their real shared URL while translating
    // their interface; never guess /fr/, /ar/, /pt/ or /sw/ routes that may 404.
    if (/^(search|farmer-decision-centre|markets|opportunities|agricultural-services|my-agriculture|agricultural-intelligence)$/.test(rest)) {
      return "/" + rest + "/";
    }

    // Static pages intentionally keep one shared URL; only their text changes.
    if (/^(about|contact)$/.test(rest)) return code === "en" ? "/" + rest + "/" : "/" + code + "/" + rest + "/";
    if (/^(privacy-policy|data-updates)$/.test(rest)) return "/" + rest + "/";

    // Home page.
    if (rest === "") return code === "en" ? "/" : "/" + code + "/";

    // Shared pages (such as the calculator) stay on the same URL.
    if (rest === "farm-profit-calculator") return "/farm-profit-calculator/";

    // Never navigate through generic per-content translation links here:
    // on older pages they may point to a different article or section.
    // Without an explicit target map or known section route, stay on this page
    // and translate the interface in place rather than sending visitors elsewhere.
    return null;
  }

  function updateLocalizedNavigation(code) {
    document.querySelectorAll("[data-localized-section]").forEach(function (link) {
      var section = link.getAttribute("data-localized-section");
      var sectionPath = section === "calculator" ? "farm-profit-calculator" : (section === "resources" ? "agriculture-resources" : section);

      // These pages intentionally use one URL and translate their interface
      // in place. Do not manufacture language-prefixed links that 404.
      if (/^(search|farmer-decision-centre|markets|opportunities|agricultural-services|my-agriculture|agricultural-intelligence|privacy-policy|data-updates)$/.test(section)) {
        link.href = "/" + sectionPath + "/";
        return;
      }

      if (section === "home") {
        link.href = code === "en" ? "/" : "/" + code + "/";
      } else if (section === "calculator") {
        link.href = "/farm-profit-calculator/";
      } else if (section === "about" || section === "contact") {
        link.href = code === "en" ? "/" + sectionPath + "/" : "/" + code + "/" + sectionPath + "/";
      } else {
        link.href = code === "en" ? "/" + sectionPath + "/" : "/" + code + "/" + sectionPath + "/";
      }
    });
  }

  function loadLanguage(code) {
    if (dictionary[code]) return Promise.resolve(dictionary[code]);
    if (languageLoads[code]) return languageLoads[code];
    languageLoads[code] = fetch("/i18n/" + encodeURIComponent(code) + ".json?v=20261024c", { cache: "default" })
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

  function refresh(requestedLanguage) {
    var sequence = ++refreshSequence;
    var code = setLanguage(requestedLanguage || currentLanguage());
    return loadLanguage(code).then(function () {
      // A later selector choice always wins, even if this request finishes last.
      if (sequence !== refreshSequence) return currentLanguage();
      apply(document.body, code);

      var homeTitle = resolve(code, "home.pageTitle");
      var homeDescription = resolve(code, "home.metaDescription");
      if (homeTitle && (location.pathname === "/" || location.pathname === "")) document.title = homeTitle;

      var meta = document.querySelector('meta[name="description"]');
      if (meta && homeDescription && code !== "en" && (location.pathname === "/" || location.pathname === "")) {
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
        // Always prefer the page's exact localized destination. This handles
        // Blog/eBook detail pages, Agricultural News country pages, and all
        // localized section indexes before falling back to generic sections.
        var targetUrl = localizedContentUrl(requested);
        // Do not guess a language-prefixed URL when this page has no known
        // destination. A guessed route can 404 or send visitors to the wrong
        // section/homepage. Explicit maps and known section routes above are
        // the only safe navigation targets; otherwise translate in place.
        setLanguage(requested);
        // Shared pages intentionally keep the same URL. Do not reload them,
        // because a reload restores the server's default <html lang="en">.
        var currentPath = window.location.pathname.replace(/\/+$/, "") || "/";
        var targetPath = targetUrl ? new URL(targetUrl, window.location.origin).pathname.replace(/\/+$/, "") || "/" : null;
        if (targetUrl && targetPath !== currentPath) {
          window.location.assign(targetUrl);
          return;
        }
        // When a page has no explicit translated destination, keep the requested
        // language for the in-place UI refresh instead of re-deriving English
        // from the unchanged URL and undoing the visitor's selection.
        refresh(requested);
      });
    }
    refresh().then(function () { readyResolve(window.GOA_I18N); });
  });
}());
