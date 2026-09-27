document.addEventListener("DOMContentLoaded", function () {
  var input = document.getElementById("ebook-search-input");
  var results = document.getElementById("ebook-results");
  var items = Array.prototype.slice.call(document.querySelectorAll(".ebook-search-item"));
  var noResults = document.getElementById("ebook-no-results");

  if (!input || !results || !items.length) return;

  function currentLanguage() {
    try { return localStorage.getItem("goa_language") || document.documentElement.lang || "en"; }
    catch (_) { return document.documentElement.lang || "en"; }
  }

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function score(query, text) {
    if (!query) return 1;
    var q = normalize(query);
    var t = normalize(text);
    if (!q || !t) return 0;
    if (t === q) return 100;
    if (t.indexOf(q) !== -1) return 80;

    var words = q.split(" ").filter(function (word) {
      return word.length > 1 && word !== "ebook";
    });
    if (!words.length) return t.indexOf(q) !== -1 ? 70 : 0;

    var matched = words.filter(function (word) { return t.indexOf(word) !== -1; }).length;
    var scoreValue = matched ? (matched / words.length) * 70 : 0;
    if (q.indexOf("farming") !== -1 && t.indexOf("farm") !== -1) scoreValue += 5;
    return Math.min(scoreValue, 75);
  }

  function preferredVariants(language) {
    var groups = {};
    items.forEach(function (item) {
      var group = item.getAttribute("data-content-group") || item.getAttribute("href");
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
    });

    var preferred = [];
    Object.keys(groups).forEach(function (group) {
      var variants = groups[group];
      var target = variants.find(function (item) {
        return (item.getAttribute("data-content-language") || "en") === language;
      }) || variants.find(function (item) {
        return (item.getAttribute("data-content-language") || "en") === "en";
      }) || variants[0];
      if (target) preferred.push(target);
    });
    return preferred;
  }

  function search() {
    var language = currentLanguage();
    var visibleItems = preferredVariants(language);
    var query = input.value;

    var ranked = visibleItems.map(function (item, index) {
      return {
        item: item,
        index: index,
        score: score(query, item.getAttribute("data-search"))
      };
    }).filter(function (entry) {
      return !normalize(query) || entry.score > 0;
    }).sort(function (a, b) {
      return b.score - a.score || a.index - b.index;
    });

    items.forEach(function (item) { item.hidden = true; item.classList.add("is-language-hidden"); });
    ranked.forEach(function (entry) {
      entry.item.hidden = false;
      entry.item.classList.remove("is-language-hidden");
      results.appendChild(entry.item);
    });
    noResults.hidden = ranked.length !== 0;
  }

  input.addEventListener("input", search);
  input.addEventListener("search", search);
  document.addEventListener("goa:languagechange", search);

  search();
});
