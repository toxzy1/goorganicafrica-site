document.addEventListener("DOMContentLoaded", function () {
  var input = document.getElementById("ebook-search-input");
  var results = document.getElementById("ebook-results");
  var items = Array.prototype.slice.call(document.querySelectorAll(".ebook-search-item"));
  var noResults = document.getElementById("ebook-no-results");

  if (!input || !results || !items.length) return;

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

  function search() {
    var query = input.value;
    var ranked = items.map(function (item, index) {
      return { item: item, index: index, score: score(query, item.getAttribute("data-search")) };
    }).filter(function (entry) {
      return !normalize(query) || entry.score > 0;
    }).sort(function (a, b) {
      return b.score - a.score || a.index - b.index;
    });

    items.forEach(function (item) { item.hidden = true; });
    ranked.forEach(function (entry) { entry.item.hidden = false; results.appendChild(entry.item); });
    noResults.hidden = ranked.length !== 0;
  }

  input.addEventListener("input", search);
  input.addEventListener("search", search);
});
