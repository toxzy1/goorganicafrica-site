(function () {
  "use strict";

  // The Markets records keep their original commodity values for filtering and
  // source traceability. Only visible labels are translated.
  var knownKeys = {
    beans: true, "bell-pepper": true, broiler: true, cassava: true,
    cattle: true, cucumber: true, fish: true, goat: true, habanero: true,
    layer: true, maize: true, pepper: true, pig: true, rice: true,
    soybean: true, tomato: true, watermelon: true
  };

  var aliases = {
    corn: "maize",
    "maize-grain": "maize",
    "rice-paddy": "rice",
    "paddy-rice": "rice",
    paddy: "rice",
    bean: "beans",
    cowpea: "beans",
    cowpeas: "beans",
    "black-eyed-peas": "beans",
    "common-beans": "beans",
    "soy-bean": "soybean",
    "soya-bean": "soybean",
    "soya-beans": "soybean",
    "bell-pepper": "bell-pepper",
    "sweet-pepper": "bell-pepper",
    "sweet-peppers": "bell-pepper",
    "hot-pepper": "pepper",
    "hot-peppers": "pepper",
    "chilli-pepper": "pepper",
    "chili-pepper": "pepper",
    "scotch-bonnet": "habanero",
    "habanero-pepper": "habanero",
    "tomatoes": "tomato",
    "water-melon": "watermelon",
    "catfish": "fish",
    "fish-farming": "fish",
    "broiler-chicken": "broiler",
    "broiler-chickens": "broiler",
    "laying-hen": "layer",
    "laying-hens": "layer",
    "dairy-cattle": "cattle",
    "beef-cattle": "cattle",
    "goats": "goat",
    "pigs": "pig"
  };

  function slug(value) {
    return String(value || "").toLowerCase().trim()
      .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function translatedCommodity(raw) {
    var key = slug(raw);
    key = aliases[key] || key;
    if (!knownKeys[key] || !window.GOA_I18N || !window.GOA_I18N.t) return null;
    var value = window.GOA_I18N.t("commodity", key);
    if (!value || value === "undefined" || value === key) return null;
    return value;
  }

  function translateElement(element, original) {
    if (!element.hasAttribute("data-market-commodity-original")) {
      element.setAttribute("data-market-commodity-original", original);
    }
    var source = element.getAttribute("data-market-commodity-original");
    var translated = translatedCommodity(source);
    if (translated) element.textContent = translated;
    else element.textContent = source;
  }

  function refresh() {
    if (!window.GOA_I18N || !window.GOA_I18N.t) return;

    document.querySelectorAll("#market-commodity option").forEach(function (option) {
      if (option.value === "all") return;
      translateElement(option, option.value);
    });

    document.querySelectorAll(".market-card h2").forEach(function (heading) {
      translateElement(heading, heading.textContent.trim());
    });

    document.querySelectorAll(".market-card > div").forEach(function (line) {
      if (!line.hasAttribute("data-market-commodity-original")) {
        var parts = line.textContent.split(" · ");
        if (parts.length >= 3) line.setAttribute("data-market-commodity-original", parts.slice(2).join(" · ").trim());
      }
      var raw = line.getAttribute("data-market-commodity-original");
      if (!raw) return;
      var translated = translatedCommodity(raw);
      if (!translated) return;
      var parts = line.textContent.split(" · ");
      if (parts.length >= 3) parts.splice(2, parts.length - 2, translated);
      line.textContent = parts.join(" · ");
    });

    document.querySelectorAll("#market-signals article strong").forEach(function (label) {
      if (!label.hasAttribute("data-market-commodity-original")) {
        var parts = label.textContent.split(" · ");
        if (parts.length >= 2) label.setAttribute("data-market-commodity-original", parts.slice(1).join(" · ").trim());
      }
      var raw = label.getAttribute("data-market-commodity-original");
      var translated = translatedCommodity(raw);
      if (!translated) return;
      var parts = label.textContent.split(" · ");
      if (parts.length >= 2) parts.splice(1, parts.length - 1, translated);
      label.textContent = parts.join(" · ");
    });
  }

  document.addEventListener("goa:languagechange", refresh);
  if (window.GOA_I18N && window.GOA_I18N.ready && typeof window.GOA_I18N.ready.then === "function") {
    window.GOA_I18N.ready.then(refresh);
  } else {
    document.addEventListener("DOMContentLoaded", refresh);
  }
}());
