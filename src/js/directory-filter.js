document.addEventListener("DOMContentLoaded", function () {
  var root = document.querySelector("[data-directory-filter]");
  if (!root) return;
  var search = root.querySelector("[data-filter-search]");
  var country = root.querySelector("[data-filter-country]");
  var category = root.querySelector("[data-filter-category]");
  var status = root.querySelector("[data-filter-status]");
  var items = Array.prototype.slice.call(root.querySelectorAll("[data-directory-item]"));
  var empty = root.querySelector("[data-filter-empty]");
  var count = root.querySelector("[data-filter-count]");
  function normalize(value) {
    return String(value || "").toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, " ")
      .replace(/\s+/g, " ").trim();
  }
  function buildOptions(select, attribute) {
    if (!select || select.getAttribute("data-auto-options") !== "true") return;
    var first = select.options[0];
    select.innerHTML = "";
    if (first) select.appendChild(first);
    var values = {};
    items.forEach(function (item) {
      var value = item.getAttribute(attribute);
      if (value) values[value] = true;
    });
    Object.keys(values).sort(function(a,b){ return a.localeCompare(b); }).forEach(function(value){
      var option = document.createElement("option");
      option.value = value;
      option.textContent = value.replace(/_/g, " ");
      select.appendChild(option);
    });
  }

  buildOptions(country, "data-country");
  buildOptions(category, "data-category");

  function matches(item) {
    var q = normalize(search ? search.value : "");
    var countryValue = normalize(country ? country.value : "");
    var categoryValue = normalize(category ? category.value : "");
    var statusValue = normalize(status ? status.value : "");
    return (!q || normalize(item.getAttribute("data-search")).indexOf(q) !== -1) &&
      (!countryValue || normalize(item.getAttribute("data-country")) === countryValue) &&
      (!categoryValue || normalize(item.getAttribute("data-category")) === categoryValue) &&
      (!statusValue || normalize(item.getAttribute("data-status")) === statusValue);
  }
  function filter() {
    var visible = 0;
    items.forEach(function (item) {
      var show = matches(item);
      item.hidden = !show;
      item.style.display = show ? "" : "none";
      if (show) visible++;
    });
    if (count) count.textContent = visible + " " + (visible === 1 ? "listing" : "listings");
    if (empty) empty.hidden = visible !== 0;
  }
  [search, country, category, status].forEach(function (control) {
    if (control) {
      control.addEventListener("input", filter);
      control.addEventListener("change", filter);
    }
  });
  filter();
});