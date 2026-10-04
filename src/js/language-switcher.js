(function () {
  "use strict";

  var languages = Array.isArray(window.GOA_LANGUAGES)
    ? window.GOA_LANGUAGES.filter(function (item) { return item && item.code && item.enabled !== false; })
    : [];
  var dictionary = window.GOA_TRANSLATIONS || {};
  var languageLoads = {};
  // Prevent an earlier asynchronous language load from repainting the page
  // after the user has already selected a newer language.
  var languageRequestId = 0;
  var readyResolve;
  var ready = new Promise(function (resolve) { readyResolve = resolve; });

  function currentLanguage() {
    // Language-prefixed URLs are authoritative for localized content.
    // Shared pages (About, Contact, Privacy, Data Updates, Calculator)
    // remember the user's selected language because their URL stays unchanged.
    var path = window.location.pathname.replace(/\/+$/, "") || "/";
    var urlLanguage = path.match(/^\/(fr|ar|pt|sw)(?:\/|$)/);
    if (urlLanguage) return urlLanguage[1];

    // Language-prefixed content has an authoritative URL. The English
    // versions of the blog, eBooks and homepage are also authoritative:
    // never let an old localStorage choice silently turn /blog/ into a
    // French/Arabic/Portuguese/Swahili page while the URL remains English.
    if (path === "/" || path === "/blog" || path === "/ebooks") return "en";

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

  var countryNames = {
    fr: {"dz":"Algérie","bj":"Bénin","cv":"Cap-Vert","cm":"Cameroun","cf":"République centrafricaine","td":"Tchad","km":"Comores","ci":"Côte d’Ivoire","cd":"RDC","eg":"Égypte","gq":"Guinée équatoriale","er":"Érythrée","et":"Éthiopie","gm":"Gambie","gn":"Guinée","gw":"Guinée-Bissau","lr":"Libéria","ly":"Libye","mg":"Madagascar","mr":"Mauritanie","mu":"Maurice","ma":"Maroc","mz":"Mozambique","na":"Namibie","ne":"Niger","ng":"Nigéria","rw":"Rwanda","st":"São Tomé-et-Príncipe","sn":"Sénégal","so":"Somalie","za":"Afrique du Sud","ss":"Soudan du Sud","sd":"Soudan","tz":"Tanzanie","tn":"Tunisie","ug":"Ouganda","zm":"Zambie"},
    ar: {"dz":"الجزائر","ao":"أنغولا","bj":"بنين","bw":"بوتسوانا","bf":"بوركينا فاسو","bi":"بوروندي","cv":"الرأس الأخضر","cm":"الكاميرون","cf":"جمهورية أفريقيا الوسطى","td":"تشاد","km":"جزر القمر","cg":"الكونغو","ci":"ساحل العاج","cd":"جمهورية الكونغو الديمقراطية","dj":"جيبوتي","eg":"مصر","gq":"غينيا الاستوائية","er":"إريتريا","sz":"إسواتيني","et":"إثيوبيا","ga":"الغابون","gm":"غامبيا","gh":"غانا","gn":"غينيا","gw":"غينيا بيساو","ke":"كينيا","ls":"ليسوتو","lr":"ليبيريا","ly":"ليبيا","mg":"مدغشقر","mw":"ملاوي","ml":"مالي","mr":"موريتانيا","mu":"موريشيوس","ma":"المغرب","mz":"موزمبيق","na":"ناميبيا","ne":"النيجر","ng":"نيجيريا","rw":"رواندا","st":"ساو تومي وبرينسيبي","sn":"السنغال","sc":"سيشل","sl":"سيراليون","so":"الصومال","za":"جنوب أفريقيا","ss":"جنوب السودان","sd":"السودان","tz":"تنزانيا","tg":"توغو","tn":"تونس","ug":"أوغندا","zm":"زامبيا","zw":"زيمبابوي"},
    pt: {"dz":"Argélia","bj":"Benim","bw":"Botsuana","cv":"Cabo Verde","cm":"Camarões","cf":"República Centro-Africana","td":"Chade","ci":"Costa do Marfim","cd":"RD Congo","dj":"Djibuti","eg":"Egito","gq":"Guiné Equatorial","er":"Eritreia","sz":"Essuatíni","et":"Etiópia","ga":"Gabão","gm":"Gâmbia","gh":"Gana","gn":"Guiné","gw":"Guiné-Bissau","ke":"Quénia","ls":"Lesoto","lr":"Libéria","ly":"Líbia","mg":"Madagáscar","mr":"Mauritânia","mu":"Maurícia","ma":"Marrocos","mz":"Moçambique","na":"Namíbia","ne":"Níger","ng":"Nigéria","rw":"Ruanda","st":"São Tomé e Príncipe","sc":"Seicheles","sl":"Serra Leoa","so":"Somália","za":"África do Sul","ss":"Sudão do Sul","sd":"Sudão","tz":"Tanzânia","tn":"Tunísia","ug":"Uganda","zm":"Zâmbia","zw":"Zimbábue"},
    sw: {"bj":"Benini","cf":"Jamhuri ya Afrika ya Kati","ci":"Côte d’Ivoire","cd":"DRC","eg":"Misri","gq":"Guinea ya Ikweta","gm":"Gambia","gw":"Guinea-Bissau","lr":"Liberia","ly":"Libya","mg":"Madagaska","ma":"Moroko","mz":"Msumbiji","mr":"Mauritania","ng":"Nigeria","rw":"Rwanda","st":"São Tomé na Príncipe","sc":"Shelisheli","za":"Afrika Kusini","ss":"Sudan Kusini","sd":"Sudan","tz":"Tanzania","ug":"Uganda","zm":"Zambia","zw":"Zimbabwe"}
  };
  function applyCountryNames(root, code) {
    var map = countryNames[code] || {};
    root.querySelectorAll("[data-goa-country-name]").forEach(function (element) {
      var key = element.getAttribute("data-goa-country-name");
      if (map[key]) element.textContent = map[key];
    });
  }

  var directoryFallbackCountries = {
    "gafsp-gambia":["Gambia","Gambie","غامبيا","Gâmbia","Gambia"],"gafsp-ghana":["Ghana","Ghana","غانا","Gana","Ghana"],"gafsp-senegal":["Senegal","Sénégal","السنغال","Senegal","Senegal"],"gafsp-liberia":["Liberia","Libéria","ليبيريا","Libéria","Liberia"],"gafsp-cote-divoire":["Côte d’Ivoire","Côte d’Ivoire","ساحل العاج","Costa do Marfim","Côte d’Ivoire"],"gafsp-mauritania":["Mauritania","Mauritanie","موريتانيا","Mauritânia","Mauritania"],"gafsp-tanzania":["Tanzania","Tanzanie","تنزانيا","Tanzânia","Tanzania"],"gafsp-guinea-bissau":["Guinea-Bissau","Guinée-Bissau","غينيا بيساو","Guiné-Bissau","Guinea-Bissau"],"gafsp-car":["Central African Republic","République centrafricaine","جمهورية أفريقيا الوسطى","República Centro-Africana","Jamhuri ya Afrika ya Kati"],"gafsp-mali":["Mali","Mali","مالي","Mali","Mali"],"gafsp-niger":["Niger","Niger","النيجر","Níger","Niger"],"gafsp-benin":["Benin","Bénin","بنين","Benim","Benini"],"gafsp-kenya":["Kenya","Kenya","كينيا","Quénia","Kenya"],"gafsp-malawi":["Malawi","Malawi","ملاوي","Malawi","Malawi"],"gafsp-zambia":["Zambia","Zambie","زامبيا","Zâmbia","Zambia"],"farm-p3-rwanda":["Rwanda","Rwanda","رواندا","Ruanda","Rwanda"],"farm-p3-senegal":["Senegal","Sénégal","السنغال","Senegal","Senegal"],"farm-p3-sierra-leone":["Sierra Leone","Sierra Leone","سيراليون","Serra Leoa","Sierra Leone"],"farm-p3-zimbabwe":["Zimbabwe","Zimbabwe","زيمبابوي","Zimbábue","Zimbabwe"]
  };
  function fallbackDirectoryTranslation(id, code) {
    var c = directoryFallbackCountries[id];
    if (!c) return null;
    var i = {en:0,fr:1,ar:2,pt:3,sw:4}[code] || 0, country = c[i];
    var data = {title:"",category:"",description:"",notes:""};
    if (id === "gafsp-gambia") {
      data.title = {en:"Agriculture and Food Security Project (GAFSP)",fr:"Projet Agriculture et sécurité alimentaire (GAFSP)",ar:"مشروع الزراعة والأمن الغذائي (GAFSP)",pt:"Projeto de Agricultura e Segurança Alimentar (GAFSP)",sw:"Mradi wa Kilimo na Usalama wa Chakula (GAFSP)"}[code];
    } else if (id.indexOf("gafsp-") === 0) {
      data.title = {en:"GAFSP agricultural investment portfolio — "+country,fr:"Portefeuille d’investissement agricole du GAFSP — "+country,ar:"محفظة GAFSP للاستثمار الزراعي — "+country,pt:"Portfólio de investimento agrícola do GAFSP — "+country,sw:"Jalada la uwekezaji wa kilimo la GAFSP — "+country}[code];
    } else {
      data.title = {en:"FARM P3 — "+country,fr:"FARM P3 — "+country,ar:"FARM P3 — "+country,pt:"FARM P3 — "+country,sw:"FARM P3 — "+country}[code];
    }
    data.category = {en:"Agricultural finance and development",fr:"Financement et développement agricoles",ar:"التمويل والتنمية الزراعية",pt:"Financiamento e desenvolvimento agrícola",sw:"Ufadhili na maendeleo ya kilimo"}[code];
    data.description = id.indexOf("gafsp-") === 0
      ? {en:"Official GAFSP agricultural investment information for "+country+". Verify the current project, implementation arrangements, eligibility and access route on the official source.",fr:"Informations officielles sur les investissements agricoles du GAFSP pour "+country+". Vérifiez le projet actuel, les modalités de mise en œuvre, l’éligibilité et la voie d’accès sur la source officielle.",ar:"معلومات رسمية عن استثمارات GAFSP الزراعية في "+country+". تحقق من المشروع الحالي وترتيبات التنفيذ والأهلية وطريقة الوصول من المصدر الرسمي.",pt:"Informações oficiais sobre investimentos agrícolas do GAFSP para "+country+". Confirme o projeto atual, as modalidades de implementação, a elegibilidade e a via de acesso na fonte oficial.",sw:"Taarifa rasmi kuhusu uwekezaji wa kilimo wa GAFSP nchini "+country+". Thibitisha mradi wa sasa, utekelezaji, ustahiki na njia ya kupata huduma kwenye chanzo rasmi."}[code]
      : {en:"Official IFAD FARM P3 information for "+country+". Verify the current project status, implementation arrangements, eligibility and access route on the official source.",fr:"Informations officielles du FARM P3 de l’IFAD pour "+country+". Vérifiez le statut actuel du projet, les modalités de mise en œuvre, l’éligibilité et la voie d’accès sur la source officielle.",ar:"معلومات رسمية عن FARM P3 التابع للصندوق الدولي للتنمية الزراعية في "+country+". تحقق من حالة المشروع الحالية وترتيبات التنفيذ والأهلية وطريقة الوصول من المصدر الرسمي.",pt:"Informações oficiais do FARM P3 do FIDA para "+country+". Confirme o estado atual do projeto, as modalidades de implementação, a elegibilidade e a via de acesso na fonte oficial.",sw:"Taarifa rasmi za FARM P3 ya IFAD nchini "+country+". Thibitisha hali ya sasa ya mradi, utekelezaji, ustahiki na njia ya kupata huduma kwenye chanzo rasmi."}[code];
    data.notes = {en:"Official institutional resource. Verify current eligibility, application route, programme status and closing dates before acting.",fr:"Ressource institutionnelle officielle. Vérifiez l’éligibilité, la voie de candidature, le statut du programme et les dates limites avant d’agir.",ar:"مورد مؤسسي رسمي. تحقق من الأهلية وطريقة التقديم وحالة البرنامج والمواعيد النهائية قبل اتخاذ أي إجراء.",pt:"Recurso institucional oficial. Verifique a elegibilidade, a via de candidatura, o estado do programa e os prazos antes de agir.",sw:"Rasilimali rasmi ya taasisi. Thibitisha ustahiki, njia ya maombi, hali ya mpango na tarehe za mwisho kabla ya kuchukua hatua."}[code];
    return data;
  }

  function applyDirectoryTranslations(root, code) {
    var source = window.GOA_DIRECTORY_TRANSLATIONS || {};
    root.querySelectorAll("[data-goa-directory-id]").forEach(function (card) {
      var id = card.getAttribute("data-goa-directory-id");
      var listingData = source[id] || {};
      var item = listingData[code] || fallbackDirectoryTranslation(id, code) || listingData.en;
      if (!item) return;
      card.querySelectorAll("[data-goa-directory-field]").forEach(function (element) {
        var field = element.getAttribute("data-goa-directory-field");
        if (field === "official_source") {
          var sources = {
            "International Fund for Agricultural Development (IFAD)": { en: "International Fund for Agricultural Development (IFAD)", fr: "Fonds international de développement agricole (FIDA)", ar: "الصندوق الدولي للتنمية الزراعية (إيفاد)", pt: "Fundo Internacional de Desenvolvimento Agrícola (FIDA)", sw: "Mfuko wa Kimataifa wa Maendeleo ya Kilimo (IFAD)" },
            "African Development Bank Group": { en: "African Development Bank Group", fr: "Groupe de la Banque africaine de développement", ar: "مجموعة البنك الأفريقي للتنمية", pt: "Grupo do Banco Africano de Desenvolvimento", sw: "Kundi la Benki ya Maendeleo ya Afrika" },
            "Food and Agriculture Organization of the United Nations (FAO)": { en: "Food and Agriculture Organization of the United Nations (FAO)", fr: "Organisation des Nations Unies pour l’alimentation et l’agriculture (FAO)", ar: "منظمة الأغذية والزراعة للأمم المتحدة (الفاو)", pt: "Organização das Nações Unidas para a Alimentação e a Agricultura (FAO)", sw: "Shirika la Chakula na Kilimo la Umoja wa Mataifa (FAO)" }
          };
          var sourceText = element.textContent.trim();
          if (sources[sourceText]) element.textContent = sources[sourceText][code] || sources[sourceText].en;
          return;
        }
        if (field === "country" && element.getAttribute("data-goa-directory-country") === "MULTI") {
          var countries = { en: "Multiple countries", fr: "Plusieurs pays", ar: "عدة دول", pt: "Vários países", sw: "Nchi nyingi" };
          element.textContent = countries[code] || countries.en;
          return;
        }
        if (item[field] !== undefined && item[field] !== null) element.textContent = item[field];
      });
    });
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
    applyDirectoryTranslations(root, code);
    applyCountryNames(root, code);
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
    // This must also handle language-prefixed versions: selecting English must
    // strip the language prefix and navigate to the canonical shared URL.
    if (/^(about|contact|privacy-policy|data-updates|agricultural-finance|agricultural-grants|agriculture-resources|farm-machinery)$/.test(rest)) return "/" + rest + "/";
    if (/^agricultural-resources\/countries(?:\/[^/]+)?$/.test(rest)) return "/" + rest + "/";

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
      var sectionPath = section === "calculator" ? "farm-profit-calculator" : (section === "resources" ? "agriculture-resources" : section);
      link.href = section === "home"
        ? (code === "en" ? "/" : "/" + code + "/")
        : (section === "calculator"
          ? "/farm-profit-calculator/"
          : ((section === "about" || section === "contact" || section === "privacy-policy" || section === "data-updates" || section === "resources" || section === "agriculture-resources")
            ? "/" + sectionPath + "/"
            : (code === "en" ? "/" + sectionPath + "/" : "/" + code + "/" + sectionPath + "/")));
    });
  }

  function loadLanguage(code) {
    if (dictionary[code]) return Promise.resolve(dictionary[code]);
    if (languageLoads[code]) return languageLoads[code];
    languageLoads[code] = fetch("/i18n/" + encodeURIComponent(code) + ".json?v=20261006", { cache: "default" })
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
    var requestId = ++languageRequestId;
    return loadLanguage(code).then(function () {
      if (requestId !== languageRequestId) return code;
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
        var requestId = ++languageRequestId;
        var section = selector.getAttribute("data-goa-selector-section");
        var targetUrl = localizedContentUrl(requested);
        if (section === "blog" || section === "ebooks") {
          targetUrl = requested === "en" ? "/" + section + "/" : "/" + requested + "/" + section + "/";
        }
        setLanguage(requested);
        // Shared pages intentionally keep the same URL. Do not reload them,
        // because a reload restores the server's default <html lang="en">.
        var currentPath = window.location.pathname.replace(/\/+$/, "") || "/";
        var targetPath = targetUrl ? new URL(targetUrl, window.location.origin).pathname.replace(/\/+$/, "") || "/" : null;
        if (targetUrl && targetPath !== currentPath) {
          window.location.assign(targetUrl);
          return;
        }

        // Shared non-calculator pages apply the language explicitly selected
        // by the user. The calculator keeps its existing refresh behavior.
        if (!/^\/[^/]*farm-profit-calculator(?:\/|$)/.test(currentPath)) {
          loadLanguage(requested).then(function () {
            if (requestId !== languageRequestId) return;
            apply(document.body, requested);
            updateLocalizedNavigation(requested);
            var selected = document.getElementById("site-language-select");
            if (selected) selected.value = requested;
            document.dispatchEvent(new CustomEvent("goa:languagechange", { detail: { language: requested } }));
          });
          return;
        }
        refresh();
      });
    }
    refresh().then(function () { readyResolve(window.GOA_I18N); });
  });
}());
