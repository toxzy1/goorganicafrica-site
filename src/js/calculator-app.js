(function () {
  "use strict";

  var STEPS = ["country", "region", "type", "commodity", "size", "yield", "price", "costs", "results"];

  // Land unit conversion factors to hectares
  var LAND_UNITS = {
    hectare: { label: "Hectares", abbr: "ha", toHectare: 1 },
    acre:    { label: "Acres",    abbr: "ac", toHectare: 0.404686 },
    plot:    { label: "Plots",    abbr: "plots", toHectare: 0.046452,
               note: "1 plot \u2248 50ft \u00d7 100ft \u2248 0.046 ha. Plot sizes vary by region \u2014 adjust if yours differs." }
  };

  var state = {
    stepIndex: 0,
    country: null,
    region: null,
    category: null, // "crop" | "livestock"
    commodity: null, // full commodity object
    landUnit: "acre",  // default to acres for small-scale farmers
    quantity: null,
    yieldMode: "recommended", // "recommended" | "custom"
    yieldValue: null,
    priceMode: "recommended",
    priceValue: null,
    outputMode: "recommended", // for livestock_recurring
    outputValue: null,
    costMode: "recommended",
    costItems: [], // [{label, amount}]
    scenarioTab: "expected",
  };

  var root, commodities, countries, regions, engine;

  function init(rootEl, data) {
    root = rootEl;
    commodities = data.commodities;
    countries = data.countries;
    regions = data.regions;
    engine = window.FarmCalcEngine;

    var savedCountry = null;
    try {
      savedCountry = localStorage.getItem("fpc_country");
    } catch (e) {}
    state.country = data.defaultCountry || savedCountry || "NG";
    state.language = data.defaultLanguage || localStorage.getItem("goa_language") || "en";
    setupToolbar();
    render();
  }

  function goNext() {
    if (state.stepIndex < STEPS.length - 1) {
      state.stepIndex++;
      render();
      root.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
  function goBack() {
    if (state.stepIndex > 0) {
      state.stepIndex--;
      render();
      root.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
  function goToStep(name) {
    var idx = STEPS.indexOf(name);
    if (idx >= 0) {
      state.stepIndex = idx;
      render();
    }
  }

  function fmtMoney(n, currencySymbol) {
    if (n === null || n === undefined || isNaN(n)) return "\u2014";
    var sym = currencySymbol || "\u20a6";
    var rounded = Math.round(n);
    return sym + rounded.toLocaleString();
  }

  function currentCountryObj() {
    return countries.find(function (c) { return c.code === state.country; }) || countries[0];
  }

  function currencySymbol() {
    return currentCountryObj().currency_symbol;
  }

  function getCommodityCountryData(commodity, countryCode) {
    if (!commodity || !commodity.country_data) return null;
    if (Array.isArray(commodity.country_data)) {
      var match = commodity.country_data.find(function (x) { return x.country_code === countryCode; });
      if (!match) return null;
      var copy = Object.assign({}, match);
      delete copy.country_code;
      return copy;
    }
    return commodity.country_data[countryCode] || null;
  }

  /* ---------- RENDER DISPATCH ---------- */


  function T(section, key, vars) { return window.GOA_I18N && window.GOA_I18N.t ? window.GOA_I18N.t(section, key, vars) : key; }
  function locale() { return { label: (window.GOA_LANGUAGES || []).find(function (item) { return item.code === state.language; })?.native || "English", country: T("calc", "country"), region: T("calc", "region"), type: T("calc", "farmingType"), crop: T("calc", "crop"), livestock: T("calc", "livestock"), continue: T("calc", "continue"), back: T("calc", "back"), step: T("calc", "step"), countryLabel: T("calc", "country"), languageLabel: T("common", "language"), homeLabel: T("common", "home") }; }
  function localizedCommodityName(c) { return c ? (T("commodity", c.id) || c.name) : ""; }
  function localizedCountryName(c) {
    if (!c) return "";
    try {
      if (window.Intl && Intl.DisplayNames) {
        var localeCode = state.language === "sw" ? "sw" : state.language;
        var name = new Intl.DisplayNames([localeCode], { type: "region" }).of(c.code);
        if (name) return name;
      }
    } catch (e) {}
    return c.name;
  }
  function localizedUnit(key, fallback) { return T("units", key) || fallback || key; }
  function localizedDataUnit(unit) {
    var u = String(unit || "").toLowerCase();
    if (u === "hectare" || u === "hectares") return localizedUnit("hectare", unit);
    if (u === "acre" || u === "acres") return localizedUnit("acre", unit);
    if (u === "plot" || u === "plots") return localizedUnit("plot", unit);
    if (u === "bird" || u === "birds") return localizedUnit("bird", unit);
    if (u === "head" || u === "heads") return localizedUnit("head", unit);
    if (u === "fish") return localizedUnit("fish", unit);
    if (u === "goat" || u === "goats") return localizedUnit("goat", unit);
    if (u === "pig" || u === "pigs") return localizedUnit("pig", unit);
    return unit;
  }
  function setupToolbar(){
    var cs=document.getElementById("calc-country-switcher"), ls=document.getElementById("calc-language-switcher");
    if(!cs || !ls) return;
    cs.innerHTML=""; countries.forEach(function(c){ var o=document.createElement("option"); o.value=c.code; o.textContent=(c.flag||"")+" "+localizedCountryName(c); o.selected=c.code===state.country; cs.appendChild(o); });
    ls.innerHTML=""; (window.GOA_LANGUAGES || []).filter(function(item){ return item.enabled !== false; }).forEach(function(item){ var o=document.createElement("option"); o.value=item.code; o.textContent=item.native; o.selected=item.code===state.language; ls.appendChild(o); });
    cs.onchange=function(){
      state.country=this.value; state.region=null; state.commodity=null;
      try{localStorage.setItem("fpc_country",state.country)}catch(e){}
      var c=currentCountryObj();
      // Country selection always gets its own country/language URL for SEO and shareable localized pages.
      window.location.href="/"+String(c.code).toLowerCase()+"/"+state.language+"/farm-profit-calculator/";
    };
    ls.onchange=function(){
      state.language=this.value;
      if (window.GOA_I18N) { window.GOA_I18N.setLanguage(state.language); window.GOA_I18N.refresh(); } else { render(); }
    };
    document.documentElement.lang=state.language; document.documentElement.dir=state.language==="ar"?"rtl":"ltr";
  }
  function localizeToolbar(){
    var l=locale(); var ls=document.getElementById("calc-language-switcher"); var cs=document.getElementById("calc-country-switcher");
    if(ls) ls.setAttribute("aria-label",l.languageLabel || l.label); if(cs) cs.setAttribute("aria-label",l.countryLabel || l.country);
  }

  document.addEventListener('goa:languagechange', function (event) { if (state) { state.language = event.detail.language; render(); } });

  function render() {
    localizeToolbar();
    var stepName = STEPS[state.stepIndex];
    root.innerHTML = "";

    var progress = document.createElement("div");
    progress.className = "calc-progress";
    STEPS.slice(0, -1).forEach(function (s, i) {
      var dot = document.createElement("div");
      dot.className = "dot" + (i < state.stepIndex ? " done" : i === state.stepIndex ? " active" : "");
      progress.appendChild(dot);
    });
    if (stepName !== "results") root.appendChild(progress);

    var renderers = {
      country: renderCountryStep,
      region: renderRegionStep,
      type: renderTypeStep,
      commodity: renderCommodityStep,
      size: renderSizeStep,
      yield: renderYieldStep,
      price: renderPriceStep,
      costs: renderCostsStep,
      results: renderResultsStep,
    };

    renderers[stepName]();
  }

  function stepHeader(container, label, title) {
    var l = document.createElement("div");
    l.className = "calc-step-label";
    l.textContent = label;
    container.appendChild(l);
    var t = document.createElement("h2");
    t.className = "calc-step-title";
    t.textContent = title;
    container.appendChild(t);
  }

  function actionBar(container, opts) {
    var bar = document.createElement("div");
    bar.className = "calc-action-bar";
    if (opts.back) {
      var backBtn = document.createElement("button");
      backBtn.className = "btn btn-outline";
      backBtn.textContent = locale().back;
      backBtn.onclick = opts.back;
      bar.appendChild(backBtn);
    }
    var nextBtn = document.createElement("button");
    nextBtn.className = "btn btn-primary";
    nextBtn.textContent = opts.nextLabel || locale().continue;
    nextBtn.disabled = !!opts.nextDisabled;
    if (opts.nextDisabled) nextBtn.style.opacity = "0.5";
    nextBtn.onclick = opts.next;
    bar.appendChild(nextBtn);
    container.appendChild(bar);
  }

  /* ---------- STEP: COUNTRY ---------- */

  function renderCountryStep() {
    stepHeader(root, T("calc", "step", {current: 1, total: 8}), locale().country);
    var grid = document.createElement("div");
    grid.className = "calc-option-grid";
    countries.forEach(function (c) {
      var card = document.createElement("div");
      card.className = "calc-option-card" + (state.country === c.code ? " selected" : "") + (!c.active ? " disabled" : "");
      card.innerHTML = '<span class="emoji">' + c.flag + "</span><span>" + localizedCountryName(c) + "</span>" +
        (!c.active ? '<span style="font-size:0.68rem;color:var(--soil);">' + T("common", "comingSoon") + '</span>' : "");
      if (c.active) {
        card.onclick = function () {
          state.country = c.code;
          state.region = null; // reset region when country changes
          try { localStorage.setItem("fpc_country", c.code); } catch (e) {}
          render();
        };
      }
      grid.appendChild(card);
    });
    root.appendChild(grid);
    actionBar(root, { next: goNext });
  }

  /* ---------- STEP: REGION ---------- */

  function renderRegionStep() {
    stepHeader(root, T("calc", "step", {current: 2, total: 8}), locale().region);
    var note = document.createElement("div");
    note.className = "calc-reference-box";
    note.textContent = T("calc","nationalReference");
    root.appendChild(note);

    var regionList = regions[state.country] || [];

    // Auto-select first region if none selected yet (so Continue is never blocked)
    if (!state.region && regionList.length > 0) {
      state.region = regionList[0];
    }

    var list = document.createElement("div");
    list.className = "calc-option-list";
    regionList.forEach(function (r) {
      var row = document.createElement("div");
      row.className = "calc-option-row" + (state.region === r ? " selected" : "");
      row.textContent = r;
      row.onclick = function () {
        state.region = r;
        render();
      };
      list.appendChild(row);
    });
    root.appendChild(list);
    actionBar(root, { back: goBack, next: goNext });
  }

  /* ---------- STEP: TYPE (crop vs livestock) ---------- */

  function renderTypeStep() {
    stepHeader(root, T("calc", "step", {current: 3, total: 8}), locale().type);
    var grid = document.createElement("div");
    grid.className = "calc-option-grid";
    [
      { id: "crop", label: locale().crop, emoji: "\ud83c\udf3e" },
      { id: "livestock", label: locale().livestock, emoji: "\ud83d\udc04" },
    ].forEach(function (opt) {
      var card = document.createElement("div");
      card.className = "calc-option-card" + (state.category === opt.id ? " selected" : "");
      card.innerHTML = '<span class="emoji">' + opt.emoji + "</span><span>" + opt.label + "</span>";
      card.onclick = function () {
        state.category = opt.id;
        state.commodity = null;
        render();
      };
      grid.appendChild(card);
    });
    root.appendChild(grid);
    actionBar(root, { back: goBack, next: goNext, nextDisabled: !state.category });
  }

  /* ---------- STEP: COMMODITY ---------- */

  function renderCommodityStep() {
    stepHeader(root, T("calc", "step", {current: 4, total: 8}), state.category === "crop" ? T("calc","selectCrop") : T("calc","selectLivestock"));
    var grid = document.createElement("div");
    grid.className = "calc-option-grid";
    var filtered = commodities.filter(function (c) { return c.category === state.category; });
    filtered.forEach(function (c) {
      var hasData = !!getCommodityCountryData(c, state.country);
      var card = document.createElement("div");
      card.className = "calc-option-card" + (state.commodity && state.commodity.id === c.id ? " selected" : "") + (!hasData ? " disabled" : "");
      card.innerHTML = '<span class="emoji">' + c.icon + "</span><span>" + localizedCommodityName(c) + "</span>" +
        (!hasData ? '<span style="font-size:0.65rem;color:var(--soil);">' + T("common", "dataComingSoon") + '</span>' : "");
      if (hasData) {
        card.onclick = function () {
          state.commodity = c;
          state.costItems = [];
          render();
        };
      }
      grid.appendChild(card);
    });
    root.appendChild(grid);
    actionBar(root, { back: goBack, next: goNext, nextDisabled: !state.commodity });
  }

  /* ---------- STEP: SIZE / QUANTITY ---------- */

  function quantityInHectares() {
    if (!state.quantity) return 0;
    if (state.commodity.unit_mode !== "crop") return state.quantity;
    return state.quantity * LAND_UNITS[state.landUnit].toHectare;
  }

  function renderSizeStep() {
    var isCrop = state.commodity.unit_mode === "crop";
    var animalLabel = localizedDataUnit(state.commodity.unit_label).charAt(0).toUpperCase() + localizedDataUnit(state.commodity.unit_label).slice(1);
    stepHeader(root, T("calc", "step", {current: 5, total: 8}), isCrop ? T("calc","farmSize") : T("calc","quantity") + " " + animalLabel + "s?");

    if (isCrop) {
      // Land unit switcher
      var unitLabel = document.createElement("div");
      unitLabel.className = "calc-step-label";
      unitLabel.textContent = T("calc", "selectLandUnit");
      root.appendChild(unitLabel);

      var unitGroup = document.createElement("div");
      unitGroup.className = "calc-toggle-group";
      unitGroup.style.marginBottom = "20px";

      Object.keys(LAND_UNITS).forEach(function (key) {
        var u = LAND_UNITS[key];
        var btn = document.createElement("button");
        btn.className = "calc-toggle-btn" + (state.landUnit === key ? " active" : "");
        btn.textContent = T("calc", key === "hectare" ? "hectares" : key === "acre" ? "acres" : "plots");
        btn.onclick = function () {
          state.landUnit = key;
          render();
        };
        unitGroup.appendChild(btn);
      });
      root.appendChild(unitGroup);

      // Plot note if plots selected
      if (LAND_UNITS[state.landUnit].note) {
        var plotNote = document.createElement("div");
        plotNote.className = "calc-reference-box";
        plotNote.style.marginBottom = "16px";
        plotNote.textContent = T("calc", "plotNote");
        root.appendChild(plotNote);
      }
    }

    var field = document.createElement("div");
    field.className = "calc-field";
    var label = document.createElement("label");
    if (isCrop) {
      var u = LAND_UNITS[state.landUnit];
      label.textContent = T("calc", "farmSizeUnit", {unit: T("calc", state.landUnit === "hectare" ? "hectares" : state.landUnit === "acre" ? "acres" : "plots").toLowerCase()});
    } else {
      label.textContent = state.commodity.quantity_label || T("calc", "numberOf", {unit: localizedDataUnit(animalLabel) + "s"});
    }
    field.appendChild(label);

    var input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = isCrop && state.landUnit === "plot" ? "1" : "0.5";
    input.className = "calc-input";
    input.value = state.quantity !== null ? state.quantity : "";
    input.placeholder = isCrop ? T("calc", state.landUnit === "plot" ? "examplePlots" : state.landUnit === "acre" ? "exampleAcre" : "exampleHectares") : T("calc", "exampleNumber");
    input.oninput = function () {
      state.quantity = this.value === "" ? null : parseFloat(this.value);
      updateNextBtn();
    };
    field.appendChild(input);

    // Conversion helper note for crops
    if (isCrop && state.quantity > 0) {
      var convNote = document.createElement("div");
      convNote.className = "hint";
      var ha = quantityInHectares();
      convNote.textContent = T("calc", "hectareEquivalent", {value: ha.toFixed(3)});
      field.appendChild(convNote);
    }

    root.appendChild(field);
    actionBar(root, { back: goBack, next: goNext, nextDisabled: !(state.quantity > 0) });

    function updateNextBtn() {
      var btn = root.querySelector(".calc-action-bar .btn-primary");
      if (btn) btn.disabled = !(state.quantity > 0);
    }
  }

  /* ---------- STEP: YIELD (crop) / OUTPUT (livestock_recurring) ---------- */

  function renderYieldStep() {
    var cd = getCommodityCountryData(state.commodity, state.country);
    var mode = state.commodity.unit_mode;

    if (mode === "livestock_unit") {
      stepHeader(root, T("calc", "step", {current: 6, total: 8}), T("calc","expectedSurvival"));
      var box = document.createElement("div");
      box.className = "calc-reference-box";
      box.innerHTML = T("calc", "referenceSurvival", {commodity: state.commodity.name, rate: cd.survival_rate, source: cd.source});
      root.appendChild(box);

      var field = document.createElement("div");
      field.className = "calc-field";
      var label = document.createElement("label");
      label.textContent = T("calc", "survivalInput");
      field.appendChild(label);
      var input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.max = "100";
      input.className = "calc-input";
      input.value = state.yieldValue !== null ? state.yieldValue : cd.survival_rate;
      input.oninput = function () { state.yieldValue = parseFloat(this.value); };
      field.appendChild(input);
      root.appendChild(field);
      if (state.yieldValue === null) state.yieldValue = cd.survival_rate;

      actionBar(root, { back: goBack, next: goNext });
      return;
    }

    var isRecurring = mode === "livestock_recurring";
    stepHeader(root, T("calc", "step", {current: 6, total: 8}), isRecurring ? T("calc","expectedOutput") : T("calc","expectedYield"));

    var refBox = document.createElement("div");
    refBox.className = "calc-reference-box";
    if (isRecurring) {
      refBox.innerHTML = T("calc", "referenceOutput", {low: cd.output_low, high: cd.output_high, unit: T("units","eggsPerBirdYear"), expected: cd.output_expected, source: cd.source, date: cd.as_of});
    } else {
      refBox.innerHTML = T("calc", "referenceYield", {low: cd.yield_low, high: cd.yield_high, unit: cd.yield_unit, expected: cd.yield_expected, source: cd.source, date: cd.as_of});
    }
    root.appendChild(refBox);

    var toggleGroup = document.createElement("div");
    toggleGroup.className = "calc-toggle-group";
    var btnRec = document.createElement("button");
    btnRec.className = "calc-toggle-btn" + (state.yieldMode === "recommended" ? " active" : "");
    btnRec.textContent = T("calc","recommendedEstimate");
    btnRec.onclick = function () {
      state.yieldMode = "recommended";
      state.yieldValue = isRecurring ? cd.output_expected : cd.yield_expected;
      render();
    };
    var btnCustom = document.createElement("button");
    btnCustom.className = "calc-toggle-btn" + (state.yieldMode === "custom" ? " active" : "");
    btnCustom.textContent = T("calc","enterOwn");
    btnCustom.onclick = function () {
      state.yieldMode = "custom";
      render();
    };
    toggleGroup.appendChild(btnRec);
    toggleGroup.appendChild(btnCustom);
    root.appendChild(toggleGroup);

    if (state.yieldValue === null) {
      state.yieldValue = isRecurring ? cd.output_expected : cd.yield_expected;
    }

    var field = document.createElement("div");
    field.className = "calc-field";
    var label = document.createElement("label");
    label.textContent = isRecurring ? T("units","eggsPerBirdYear") : T("calc", "yieldInput", {unit: cd.yield_unit, area: localizedUnit(state.landUnit === "hectare" ? "hectare" : state.landUnit === "acre" ? "acre" : "plot", "area")});
    field.appendChild(label);
    var input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "0.1";
    input.className = "calc-input";
    input.value = state.yieldValue;
    input.disabled = state.yieldMode === "recommended";
    input.oninput = function () { state.yieldValue = parseFloat(this.value); };
    field.appendChild(input);
    root.appendChild(field);

    actionBar(root, { back: goBack, next: goNext });
  }

  /* ---------- STEP: PRICE ---------- */

  function renderPriceStep() {
    var cd = getCommodityCountryData(state.commodity, state.country);
    var mode = state.commodity.unit_mode;
    stepHeader(root, T("calc", "step", {current: 7, total: 8}), T("calc","sellingPrice"));

    var refBox = document.createElement("div");
    refBox.className = "calc-reference-box";
    var currency = currencySymbol();
    var priceLabel, defaultPrice;

    if (mode === "crop") {
      priceLabel = T("calc", "sellingPriceUnit", {currency: currency, unit: localizedUnit("perKg", "per kg")});
      defaultPrice = cd.price_expected;
      refBox.innerHTML = T("calc", "referencePriceRange", {low: fmtMoney(cd.price_low, currency), high: fmtMoney(cd.price_high, currency), unit: cd.price_unit, source: cd.source, date: cd.as_of});
    } else if (mode === "livestock_unit") {
      priceLabel = T("calc", "sellingPriceUnit", {currency: currency, unit: cd.price_unit});
      defaultPrice = cd.price_per_unit;
      refBox.innerHTML = T("calc", "referencePriceRange", {low: fmtMoney(cd.price_low, currency), high: fmtMoney(cd.price_high, currency), unit: cd.price_unit, source: cd.source, date: cd.as_of});
    } else {
      priceLabel = T("calc", "pricePerUnit", {currency: currency, unit: cd.price_unit});
      defaultPrice = cd.price_per_unit;
      refBox.innerHTML = T("calc", "referencePriceRange", {low: fmtMoney(cd.price_low, currency), high: fmtMoney(cd.price_high, currency), unit: cd.price_unit, source: cd.source, date: cd.as_of});
    }
    root.appendChild(refBox);

    var toggleGroup = document.createElement("div");
    toggleGroup.className = "calc-toggle-group";
    var btnRec = document.createElement("button");
    btnRec.className = "calc-toggle-btn" + (state.priceMode === "recommended" ? " active" : "");
    btnRec.textContent = T("calc","referencePrice");
    btnRec.onclick = function () {
      state.priceMode = "recommended";
      state.priceValue = defaultPrice;
      render();
    };
    var btnCustom = document.createElement("button");
    btnCustom.className = "calc-toggle-btn" + (state.priceMode === "custom" ? " active" : "");
    btnCustom.textContent = T("calc","enterOwnPrice");
    btnCustom.onclick = function () {
      state.priceMode = "custom";
      render();
    };
    toggleGroup.appendChild(btnRec);
    toggleGroup.appendChild(btnCustom);
    root.appendChild(toggleGroup);

    if (state.priceValue === null) state.priceValue = defaultPrice;

    var field = document.createElement("div");
    field.className = "calc-field";
    var label = document.createElement("label");
    label.textContent = priceLabel;
    field.appendChild(label);
    var input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.className = "calc-input";
    input.value = state.priceValue;
    input.disabled = state.priceMode === "recommended";
    input.oninput = function () { state.priceValue = parseFloat(this.value); };
    field.appendChild(input);
    root.appendChild(field);

    actionBar(root, { back: goBack, next: goNext });
  }

  /* ---------- STEP: COSTS ---------- */

  function renderCostsStep() {
    var cd = getCommodityCountryData(state.commodity, state.country);
    stepHeader(root, T("calc", "step", {current: 8, total: 8}), T("calc","productionCosts"));

    var currency = currencySymbol();
    var isCrop = state.commodity.unit_mode === "crop";
    var unitInfo = isCrop ? (LAND_UNITS[state.landUnit] || LAND_UNITS.hectare) : null;
    var hectares = isCrop ? quantityInHectares() : null;

    // Reference box — show per-hectare cost AND the scaled actual cost for their farm size
    var refBox = document.createElement("div");
    refBox.className = "calc-reference-box";
    if (isCrop && hectares && hectares !== 1) {
      var scaledTotal = cd.cost_per_unit * hectares;
      refBox.innerHTML = T("calc", "referenceCostScaled", {
        cost: fmtMoney(cd.cost_per_unit, currency),
        hectares: hectares.toFixed(3),
        quantity: state.quantity,
        unit: unitInfo.abbr,
        total: fmtMoney(scaledTotal, currency),
        source: cd.source,
        date: cd.as_of
      });
    } else {
      refBox.innerHTML = T("calc", "referenceTotalCost", {
        unit: localizedDataUnit(isCrop ? "hectare" : state.commodity.unit_label),
        cost: fmtMoney(cd.cost_per_unit, currency),
        source: cd.source,
        date: cd.as_of
      });
    }
    root.appendChild(refBox);

    var toggleGroup = document.createElement("div");
    toggleGroup.className = "calc-toggle-group";
    var btnRec = document.createElement("button");
    btnRec.className = "calc-toggle-btn" + (state.costMode === "recommended" ? " active" : "");
    btnRec.textContent = T("calc","estimatedCosts");
    btnRec.onclick = function () {
      state.costMode = "recommended";
      state.costItems = cd.cost_breakdown.map(function (i) { return { label: i.label, amount: i.amount }; });
      render();
    };
    var btnCustom = document.createElement("button");
    btnCustom.className = "calc-toggle-btn" + (state.costMode === "custom" ? " active" : "");
    btnCustom.textContent = T("calc","editCosts");
    btnCustom.onclick = function () {
      state.costMode = "custom";
      if (!state.costItems.length) {
        state.costItems = cd.cost_breakdown.map(function (i) { return { label: i.label, amount: i.amount }; });
      }
      render();
    };
    toggleGroup.appendChild(btnRec);
    toggleGroup.appendChild(btnCustom);
    root.appendChild(toggleGroup);

    if (!state.costItems.length) {
      state.costItems = cd.cost_breakdown.map(function (i) { return { label: i.label, amount: i.amount }; });
    }

    var list = document.createElement("div");
    list.style.marginTop = "16px";
    state.costItems.forEach(function (item, idx) {
      var row = document.createElement("div");
      row.className = "calc-cost-row";
      var lbl = document.createElement("label");
      lbl.textContent = item.label;
      row.appendChild(lbl);
      var inp = document.createElement("input");
      inp.type = "number";
      inp.min = "0";
      inp.value = item.amount;
      inp.disabled = state.costMode === "recommended";
      inp.oninput = function () {
        state.costItems[idx].amount = parseFloat(this.value) || 0;
        updateTotal();
      };
      row.appendChild(inp);
      list.appendChild(row);
    });
    root.appendChild(list);

    // Total row — show per-hectare total AND scaled actual total for their farm size
    var totalRow = document.createElement("div");
    totalRow.className = "calc-cost-total";
    var totalLabel = isCrop && hectares && hectares !== 1
      ? T("calc", "totalScaled", {hectares: hectares.toFixed(3)})
      : T("calc", "totalPer", {unit: isCrop ? "hectare" : state.commodity.unit_label});
    var actualTotal = isCrop ? (sumCosts() * hectares) : sumCosts();
    totalRow.innerHTML = '<span>' + totalLabel + '</span><span id="calc-cost-total-val">' + fmtMoney(actualTotal, currency) + "</span>";
    root.appendChild(totalRow);

    function updateTotal() {
      var el = document.getElementById("calc-cost-total-val");
      if (el) {
        var h = isCrop ? quantityInHectares() : 1;
        el.textContent = fmtMoney(sumCosts() * h, currency);
      }
    }

    actionBar(root, { back: goBack, next: goToResults, nextLabel: T("calc","calculateProfit") });
  }

  function sumCosts() {
    return state.costItems.reduce(function (sum, i) { return sum + (parseFloat(i.amount) || 0); }, 0);
  }

  function goToResults() {
    state.stepIndex = STEPS.indexOf("results");
    render();
    root.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------- STEP: RESULTS ---------- */

  function buildEngineInput() {
    var mode = state.commodity.unit_mode;
    var cd = getCommodityCountryData(state.commodity, state.country);
    var costPerUnit = sumCosts();

    if (mode === "crop") {
      // Convert entered quantity to hectares for the engine
      var hectares = quantityInHectares();
      // costPerUnit from reference data is always PER HECTARE.
      // The engine multiplies costPerUnit × quantity (hectares) internally,
      // so we must pass costPerUnit as-is (per hectare) and quantity as hectares.
      // This correctly scales total cost = costPerHectare × hectares regardless of
      // whether the farmer entered acres, plots or hectares.
      return {
        mode: "crop",
        quantity: hectares,
        costPerUnit: costPerUnit,
        yieldPerUnit: state.yieldValue,
        pricePerKg: state.priceValue,
        displayQuantity: state.quantity,
        displayUnit: LAND_UNITS[state.landUnit].abbr,
        displayLabel: LAND_UNITS[state.landUnit].label,
      };
    } else if (mode === "livestock_unit") {
      return {
        mode: "livestock_unit",
        quantity: state.quantity,
        costPerUnit: costPerUnit,
        survivalRatePct: state.yieldValue,
        pricePerAnimal: state.priceValue,
      };
    } else {
      return {
        mode: "livestock_recurring",
        quantity: state.quantity,
        costPerUnit: costPerUnit,
        survivalRatePct: cd.survival_rate,
        outputPerAnimal: state.yieldValue,
        pricePerOutput: state.priceValue,
      };
    }
  }

  function renderResultsStep() {
    // Safety guard - engine must be ready
    if (!engine || !engine.calculateScenarios) {
      root.innerHTML = '<p style="color:red;padding:24px;text-align:center;">' + T("calc", "engineError") + "</p>";
      return;
    }

    var currency = currencySymbol();

    // Build input with null safety
    var input;
    try {
      input = buildEngineInput();
    } catch (e) {
      root.innerHTML = '<p style="color:red;padding:24px;text-align:center;">' + T("calc","inputError") + "</p>";
      return;
    }

    // Run calculation with null safety
    var scenarios;
    try {
      scenarios = engine.calculateScenarios(input, 15);
    } catch (e) {
      root.innerHTML = '<p style="color:red;padding:24px;text-align:center;">' + T("calc","calculationError") + "</p>";
      return;
    }

    var result = scenarios[state.scenarioTab] || scenarios.expected;
    if (!result) {
      root.innerHTML = '<p style="color:red;padding:24px;">' + T("calc", "resultsError") + "</p>";
      return;
    }

    var isCrop = state.commodity.unit_mode === "crop";
    var unitInfo = isCrop ? (LAND_UNITS[state.landUnit] || LAND_UNITS.hectare) : null;
    var displayQty = state.quantity + " " + (isCrop ? unitInfo.abbr : localizedDataUnit(state.commodity.unit_label) + (state.quantity != 1 ? "s" : ""));
    var profitPerLabel = T("calc", "profitPer", {unit: isCrop ? localizedUnit(state.landUnit === "hectare" ? "hectare" : state.landUnit === "acre" ? "acre" : "plot", unitInfo.label.replace(/s$/, "").toLowerCase()) : localizedDataUnit(state.commodity.unit_label)});

    // --- HEADER ---
    var summary = document.createElement("div");
    summary.style.marginBottom = "16px";
    summary.innerHTML =
      '<div class="calc-step-label">' + T("calc", "profitReport") + '</div>' +
      '<h2 class="calc-step-title" style="margin-bottom:4px;">' + localizedCommodityName(state.commodity) + "</h2>" +
      '<p style="color:var(--ink-soft);font-size:0.9rem;">' +
        localizedCountryName(currentCountryObj()) + (state.region ? " \u2014 " + state.region : "") +
        " \u00b7 " + displayQty +
      "</p>";
    root.appendChild(summary);

    // --- HERO PROFIT ---
    var isLoss = result.profit < 0;
    var hero = document.createElement("div");
    hero.className = "calc-hero-result";
    hero.innerHTML =
      '<div class="label">' + T("calc", "estimatedProfit", {scenario: T("calc", state.scenarioTab)}) + '</div>' +
      '<div class="value' + (isLoss ? " negative" : "") + '">' + fmtMoney(result.profit, currency) + "</div>" +
      (isLoss ? '<div style="font-size:0.85rem;opacity:0.8;margin-top:6px;">&#9888; ' + T("calc","lossNotice") + '</div>' : "");
    root.appendChild(hero);

    // --- SCENARIO TABS ---
    var scenarioTabs = document.createElement("div");
    scenarioTabs.className = "calc-scenario-tabs";
    ["conservative", "expected", "optimistic"].forEach(function (s) {
      var tab = document.createElement("div");
      tab.className = "calc-scenario-tab" + (state.scenarioTab === s ? " active" : "");
      var scenResult = scenarios[s];
      var scenProfit = scenResult ? fmtMoney(scenResult.profit, currency) : "\u2014";
      tab.innerHTML = '<strong>' + T("calc", s) + '</strong><br>' +
        '<span style="font-size:0.78rem;opacity:0.85;">' + scenProfit + '</span>';
      tab.onclick = function () {
        state.scenarioTab = s;
        render();
      };
      scenarioTabs.appendChild(tab);
    });
    root.appendChild(scenarioTabs);

    // --- KEY METRICS GRID ---
    var grid = document.createElement("div");
    grid.className = "calc-result-grid";
    var roi = result.roi !== null ? result.roi.toFixed(1) + "%" : "\u2014";
    var bep = result.breakEvenPrice !== null ? fmtMoney(result.breakEvenPrice, currency) : "\u2014";
    var bey = result.breakEvenYield !== null ? (typeof result.breakEvenYield === "number" ? result.breakEvenYield.toFixed(2) : result.breakEvenYield) : "\u2014";
    var ppu = result.profitPerUnit !== null ? fmtMoney(result.profitPerUnit, currency) : "\u2014";

    var cards = [
      { label: T("calc","totalInvestment"), value: fmtMoney(result.totalCost, currency), icon: "\ud83d\udcb0" },
      { label: T("calc","expectedRevenue"), value: fmtMoney(result.totalRevenue, currency), icon: "\ud83d\udcb5" },
      { label: T("calc","roi"), value: roi, icon: "\ud83d\udcc8" },
      { label: T("calc","breakEvenPrice"), value: bep, icon: "\u2696\ufe0f" },
      { label: T("calc","breakEvenYield"), value: bey, icon: "\ud83c\udf31" },
      { label: profitPerLabel, value: ppu, icon: "\ud83c\udfe1" },
    ];
    cards.forEach(function (c) {
      var card = document.createElement("div");
      card.className = "calc-result-card";
      card.innerHTML =
        '<div class="label">' + c.icon + " " + c.label + "</div>" +
        '<div class="value">' + c.value + "</div>";
      grid.appendChild(card);
    });
    root.appendChild(grid);

    // --- TECHNICAL ADVICE SECTION ---
    var adviceSection = document.createElement("div");
    adviceSection.style.cssText = "margin:24px 0;";
    var adviceTitle = document.createElement("h3");
    adviceTitle.style.cssText = "font-family:var(--font-display);color:var(--green-deep);margin-bottom:14px;font-size:1.15rem;";
    adviceTitle.textContent = "💡 " + T("calc","technical");
    adviceSection.appendChild(adviceTitle);

    var profitBlock = document.createElement("div");
    profitBlock.style.cssText = "background:var(--sage-light);border-left:4px solid var(--green-deep);border-radius:0 10px 10px 0;padding:14px 16px;margin-bottom:12px;";
    var profitText = "";
    if (result.roi === null) {
      profitText = T("analysis","roiUnavailable");
    } else if (result.profit < 0) {
      profitText = "⚠️ " + T("analysis","loss", {amount:fmtMoney(Math.abs(result.profit), currency), roi:Math.abs(result.roi).toFixed(1)});
    } else if (result.roi < 20) {
      profitText = "📉 " + T("analysis","thin", {roi:result.roi.toFixed(1)});
    } else if (result.roi < 60) {
      profitText = "✅ " + T("analysis","reasonable", {roi:result.roi.toFixed(1)});
    } else {
      profitText = "🌟 " + T("analysis","strong", {roi:result.roi.toFixed(1)});
    }
    profitBlock.innerHTML = '<div style="font-weight:700;color:var(--green-deep);margin-bottom:6px;font-size:0.95rem;">📊 ' + T("calc","profitability") + '</div>' +
      '<p style="margin:0;font-size:0.88rem;color:var(--ink-soft);line-height:1.7;">' + profitText + "</p>";
    adviceSection.appendChild(profitBlock);

    if (result.breakEvenPrice !== null && result.breakEvenPrice > 0) {
      var cd2 = getCommodityCountryData(state.commodity, state.country);
      var bepBlock = document.createElement("div");
      bepBlock.style.cssText = "background:#edf4ff;border-left:4px solid #4a7cc7;border-radius:0 10px 10px 0;padding:14px 16px;margin-bottom:12px;";
      var bepVars = {price:fmtMoney(result.breakEvenPrice, currency), unit:(cd2 ? cd2.price_unit || "" : ""), low:fmtMoney(cd2 && cd2.price_low ? cd2.price_low : 0, currency)};
      var bepText = (cd2 && cd2.price_low && result.breakEvenPrice > cd2.price_low * 0.9) ? T("analysis","breakEvenLow",bepVars) : T("analysis","breakEvenBuffer",bepVars);
      bepBlock.innerHTML = '<div style="font-weight:700;color:#1a3a6b;margin-bottom:6px;font-size:0.95rem;">⚖️ ' + T("calc","breakEven") + '</div>' +
        '<p style="margin:0;font-size:0.88rem;color:var(--ink-soft);line-height:1.7;">' + bepText + "</p>";
      adviceSection.appendChild(bepBlock);
    }

    var scenBlock = document.createElement("div");
    scenBlock.style.cssText = "background:#fff8e8;border-left:4px solid var(--gold);border-radius:0 10px 10px 0;padding:14px 16px;margin-bottom:12px;";
    var consProfit = scenarios.conservative ? scenarios.conservative.profit : null;
    var optProfit = scenarios.optimistic ? scenarios.optimistic.profit : null;
    var scenText = T("analysis","scenarioBase");
    if (consProfit !== null && optProfit !== null) {
      var range = fmtMoney(Math.abs(optProfit - consProfit), currency);
      scenText += " " + (consProfit < 0 ? T("analysis","scenarioLoss",{range:range}) : T("analysis","scenarioProfit",{range:range}));
    }
    scenBlock.innerHTML = '<div style="font-weight:700;color:#6b4e10;margin-bottom:6px;font-size:0.95rem;">📊 ' + T("calc","scenario") + '</div>' +
      '<p style="margin:0;font-size:0.88rem;color:var(--ink-soft);line-height:1.7;">' + scenText + "</p>";
    adviceSection.appendChild(scenBlock);

    var nextBlock = document.createElement("div");
    nextBlock.style.cssText = "background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin-bottom:12px;";
    nextBlock.innerHTML = '<div style="font-weight:700;color:var(--green-deep);margin-bottom:8px;font-size:0.95rem;">🚦 ' + T("calc","nextSteps") + '</div>' +
      '<ul style="margin:0;padding-left:18px;font-size:0.88rem;color:var(--ink-soft);line-height:1.9;">' +
      '<li>' + T("analysis","next1") + '</li><li>' + T("analysis","next2") + '</li><li>' + T("analysis","next3") + '</li><li>' + T("analysis","next4") + '</li><li>' + T("analysis","next5") + '</li></ul>';
    adviceSection.appendChild(nextBlock);

    // --- COMMODITY-SPECIFIC ADVICE (from advice engine) ---
    if (window.FarmAdviceEngine) {
      var cd3 = getCommodityCountryData(state.commodity, state.country);
      var advice = window.FarmAdviceEngine.generateAdvice(result, state.commodity, cd3, currency);
      var adviceContainer = document.createElement("div");
      root.appendChild(adviceContainer);
      window.FarmAdviceEngine.renderAdvice(adviceContainer, advice);
    }

    // --- ADSENSE SLOT ---
    var adSlot = document.createElement("div");
    adSlot.className = "calc-ad-slot";
    adSlot.textContent = T("calc","advertisement");
    root.appendChild(adSlot);

    // --- DISCLAIMER ---
    var disclaimer = document.createElement("div");
    disclaimer.className = "calc-disclaimer";
    disclaimer.innerHTML = "<strong>" + T("calc","importantDisclaimer") + ":</strong> " + T("calc","disclaimerText") + "";
    root.appendChild(disclaimer);

    // --- ACTION BUTTONS ---
    var actions = document.createElement("div");
    actions.className = "calc-action-bar";
    var restartBtn = document.createElement("button");
    restartBtn.className = "btn btn-outline";
    restartBtn.textContent = T("calc","startNew");
    restartBtn.onclick = function () {
      var keepCountry = state.country;
      state = {
        stepIndex: 0, country: keepCountry, region: null, category: null, commodity: null,
        landUnit: "acre", quantity: null, yieldMode: "recommended", yieldValue: null,
        priceMode: "recommended", priceValue: null, outputMode: "recommended",
        outputValue: null, costMode: "recommended", costItems: [], scenarioTab: "expected",
      };
      render();
    };
    var editBtn = document.createElement("button");
    editBtn.className = "btn btn-primary";
    editBtn.textContent = T("calc","editInputs");
    editBtn.onclick = function () { goToStep("size"); };
    var homeBtn = document.createElement("a");
    homeBtn.className = "btn btn-outline";
    homeBtn.href = "/";
    homeBtn.textContent = T("common","home");
    homeBtn.setAttribute("aria-label", T("common","home"));
    actions.appendChild(homeBtn);
    actions.appendChild(restartBtn);
    actions.appendChild(editBtn);
    root.appendChild(actions);
  }


  window.FarmProfitCalculator = { init: init };
})();
