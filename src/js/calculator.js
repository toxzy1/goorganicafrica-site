(function () {
  "use strict";

  var countries = JSON.parse(document.getElementById("calc-data-countries").textContent);
  var enterprises = JSON.parse(document.getElementById("calc-data-enterprises").textContent);

  var countrySelect = document.getElementById("calc-country");
  var typeSelect = document.getElementById("calc-type");
  var enterpriseSelect = document.getElementById("calc-enterprise");
  var unitBasisEl = document.getElementById("calc-unit-basis");
  var unavailableEl = document.getElementById("calc-unavailable");
  var costFieldsEl = document.getElementById("calc-cost-fields");
  var outputFieldsEl = document.getElementById("calc-output-fields");
  var costsPanel = document.getElementById("calc-costs");
  var outputPanel = document.getElementById("calc-output");

  var state = {
    country: null,
    currencySymbol: "\u20A6",
    type: "crop",
    enterprise: null,
    costValues: {},
    outputValues: { yield: 0, price: 0 },
  };

  function formatMoney(n) {
    if (isNaN(n)) n = 0;
    return state.currencySymbol + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  function populateCountries() {
    countrySelect.innerHTML = "";
    countries.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c.code;
      opt.textContent = c.name + (c.available ? "" : " (coming soon)");
      countrySelect.appendChild(opt);
    });
    countrySelect.value = "NG";
  }

  function currentCountry() {
    var code = countrySelect.value;
    return countries.find(function (c) { return c.code === code; });
  }

  function populateEnterprises() {
    var country = currentCountry();
    var type = typeSelect.value;
    var list = enterprises.filter(function (e) {
      return e.country === country.code && e.type === type;
    });

    enterpriseSelect.innerHTML = "";
    if (!country.available || list.length === 0) {
      var opt = document.createElement("option");
      opt.textContent = "Not yet available";
      enterpriseSelect.appendChild(opt);
      enterpriseSelect.disabled = true;
      unavailableEl.hidden = !!country.available && list.length > 0;
      costsPanel.style.display = "none";
      outputPanel.style.display = "none";
      unitBasisEl.textContent = "";
      updateResults();
      return;
    }

    enterpriseSelect.disabled = false;
    unavailableEl.hidden = true;
    costsPanel.style.display = "";
    outputPanel.style.display = "";

    list.forEach(function (e) {
      var opt = document.createElement("option");
      opt.value = e.id;
      opt.textContent = e.label;
      enterpriseSelect.appendChild(opt);
    });
    enterpriseSelect.value = list[0].id;
    loadEnterprise();
  }

  function loadEnterprise() {
    var country = currentCountry();
    state.country = country.code;
    state.currencySymbol = country.symbol;

    var ent = enterprises.find(function (e) {
      return e.id === enterpriseSelect.value && e.country === country.code;
    });
    state.enterprise = ent;
    if (!ent) return;

    unitBasisEl.textContent = "Basis: " + ent.unitBasis;

    // Build cost fields
    state.costValues = {};
    costFieldsEl.innerHTML = "";
    ent.costFields.forEach(function (f) {
      state.costValues[f.id] = 0;
      var wrap = document.createElement("div");
      wrap.className = "calc-input-group";
      wrap.innerHTML =
        '<label class="calc-input-label">' + f.label + "</label>" +
        '<div class="calc-input-with-symbol">' +
          '<span class="calc-symbol">' + state.currencySymbol + '</span>' +
          '<input type="number" min="0" inputmode="decimal" data-field="' + f.id + '" class="calc-input" placeholder="0">' +
        "</div>" +
        (f.hint ? '<p class="calc-hint">' + f.hint + "</p>" : "");
      costFieldsEl.appendChild(wrap);
    });

    // Build output fields
    outputFieldsEl.innerHTML = "";
    var yieldWrap = document.createElement("div");
    yieldWrap.className = "calc-input-group";
    yieldWrap.innerHTML =
      '<label class="calc-input-label">' + ent.output.yieldLabel + " (" + ent.output.yieldUnit + ")</label>" +
      '<input type="number" min="0" inputmode="decimal" id="calc-yield" class="calc-input" placeholder="0">';
    outputFieldsEl.appendChild(yieldWrap);

    var priceWrap = document.createElement("div");
    priceWrap.className = "calc-input-group";
    priceWrap.innerHTML =
      '<label class="calc-input-label">' + ent.output.priceLabel + "</label>" +
      '<div class="calc-input-with-symbol">' +
        '<span class="calc-symbol">' + state.currencySymbol + '</span>' +
        '<input type="number" min="0" inputmode="decimal" id="calc-price" class="calc-input" placeholder="0">' +
      "</div>" +
      (ent.output.hint ? '<p class="calc-hint">' + ent.output.hint + "</p>" : "");
    outputFieldsEl.appendChild(priceWrap);

    attachInputListeners();
    updateResults();
  }

  function attachInputListeners() {
    costFieldsEl.querySelectorAll("[data-field]").forEach(function (input) {
      input.addEventListener("input", function () {
        state.costValues[input.dataset.field] = parseFloat(input.value) || 0;
        updateResults();
      });
    });
    var yieldInput = document.getElementById("calc-yield");
    var priceInput = document.getElementById("calc-price");
    if (yieldInput) {
      yieldInput.addEventListener("input", function () {
        state.outputValues.yield = parseFloat(yieldInput.value) || 0;
        updateResults();
      });
    }
    if (priceInput) {
      priceInput.addEventListener("input", function () {
        state.outputValues.price = parseFloat(priceInput.value) || 0;
        updateResults();
      });
    }
  }

  function updateResults() {
    var totalCost = Object.keys(state.costValues).reduce(function (sum, k) {
      return sum + (state.costValues[k] || 0);
    }, 0);
    var totalRevenue = (state.outputValues.yield || 0) * (state.outputValues.price || 0);
    var profit = totalRevenue - totalCost;
    var margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    document.getElementById("calc-total-cost").textContent = formatMoney(totalCost);
    document.getElementById("calc-total-revenue").textContent = formatMoney(totalRevenue);
    document.getElementById("res-cost").textContent = formatMoney(totalCost);
    document.getElementById("res-revenue").textContent = formatMoney(totalRevenue);
    document.getElementById("res-profit").textContent = formatMoney(profit);
    document.getElementById("res-margin").textContent = totalRevenue > 0 ? margin.toFixed(1) + "%" : "\u2014";

    var profitCard = document.getElementById("res-profit").closest(".calc-result-card");
    profitCard.classList.toggle("calc-negative", profit < 0);

    var costBar = document.getElementById("calc-bar-cost");
    var profitBar = document.getElementById("calc-bar-profit");
    if (totalRevenue > 0) {
      var costPct = Math.min(100, (totalCost / totalRevenue) * 100);
      var profitPct = Math.max(0, 100 - costPct);
      costBar.style.width = costPct + "%";
      profitBar.style.width = profitPct + "%";
    } else {
      costBar.style.width = "0%";
      profitBar.style.width = "0%";
    }
  }

  countrySelect.addEventListener("change", populateEnterprises);
  typeSelect.addEventListener("change", populateEnterprises);
  enterpriseSelect.addEventListener("change", loadEnterprise);

  populateCountries();
  populateEnterprises();
})();
