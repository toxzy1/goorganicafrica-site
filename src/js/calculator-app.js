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


  var LOCALES = {
    en:{label:"English",country:"Select Your Country",region:"Select Your Region",type:"What Are You Farming?",crop:"Crop",livestock:"Livestock",continue:"Continue",back:"Back"},
    fr:{label:"Français",country:"Sélectionnez votre pays",region:"Sélectionnez votre région",type:"Que cultivez-vous ou élevez-vous ?",crop:"Culture",livestock:"Élevage",continue:"Continuer",back:"Retour"},
    ar:{label:"العربية",country:"اختر بلدك",region:"اختر منطقتك",type:"ماذا تزرع أو تربي؟",crop:"محاصيل",livestock:"الثروة الحيوانية",continue:"متابعة",back:"رجوع"},
    pt:{label:"Português",country:"Selecione o seu país",region:"Selecione a sua região",type:"O que você cultiva ou cria?",crop:"Cultivo",livestock:"Pecuária",continue:"Continuar",back:"Voltar"},
    sw:{label:"Kiswahili",country:"Chagua nchi yako",region:"Chagua eneo lako",type:"Unalima au kufuga nini?",crop:"Mazao",livestock:"Mifugo",continue:"Endelea",back:"Rudi"}
  };
  function locale(){ return LOCALES[state.language] || LOCALES.en; }
  function setupToolbar(){
    var cs=document.getElementById("calc-country-switcher"), ls=document.getElementById("calc-language-switcher");
    if(!cs || !ls) return;
    cs.innerHTML=""; countries.forEach(function(c){ var o=document.createElement("option"); o.value=c.code; o.textContent=(c.flag||"")+" "+c.name; o.selected=c.code===state.country; cs.appendChild(o); });
    ls.innerHTML=""; Object.keys(LOCALES).forEach(function(k){ var o=document.createElement("option"); o.value=k; o.textContent=LOCALES[k].label; o.selected=k===state.language; ls.appendChild(o); });
    cs.onchange=function(){
      state.country=this.value; state.region=null; state.commodity=null;
      try{localStorage.setItem("fpc_country",state.country)}catch(e){}
      if (/^\/[a-z]{2}\/(en|fr|ar|pt|sw)\/farm-profit-calculator\//.test(window.location.pathname)) {
        var c=currentCountryObj();
        window.location.href="/"+String(c.code).toLowerCase()+"/"+state.language+"/farm-profit-calculator/";
      } else render();
    };
    ls.onchange=function(){
      state.language=this.value;
      try{localStorage.setItem("goa_language",state.language)}catch(e){}
      document.documentElement.lang=state.language; document.documentElement.dir=state.language==="ar"?"rtl":"ltr";
      var countryCode = String(currentCountryObj().code).toLowerCase();
      if (window.location.pathname.indexOf("/farm-profit-calculator/") !== -1) {
        window.location.href = "/" + countryCode + "/" + state.language + "/farm-profit-calculator/";
      } else { render(); }
    };
    document.documentElement.lang=state.language; document.documentElement.dir=state.language==="ar"?"rtl":"ltr";
  }
  function localizeToolbar(){
    var l=locale(); var ls=document.getElementById("calc-language-switcher"); var cs=document.getElementById("calc-country-switcher");
    if(ls) ls.setAttribute("aria-label",l.label); if(cs) cs.setAttribute("aria-label",l.country);
  }

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
    stepHeader(root, locale().step + " 1 of 8", locale().country);
    var grid = document.createElement("div");
    grid.className = "calc-option-grid";
    countries.forEach(function (c) {
      var card = document.createElement("div");
      card.className = "calc-option-card" + (state.country === c.code ? " selected" : "") + (!c.active ? " disabled" : "");
      card.innerHTML = '<span class="emoji">' + c.flag + "</span><span>" + c.name + "</span>" +
        (!c.active ? '<span style="font-size:0.68rem;color:var(--soil);">Coming soon</span>' : "");
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
    stepHeader(root, locale().step + " 2 of 8", locale().region);
    var note = document.createElement("div");
    note.className = "calc-reference-box";
    note.textContent = "We use National Reference data for cost, yield and price estimates. Your region personalizes your report but does not change the calculation figures.";
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
    stepHeader(root, locale().step + " 3 of 8", locale().type);
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
    stepHeader(root, "Step 4 of 8", state.category === "crop" ? "Select Your Crop" : "Select Your Livestock");
    var grid = document.createElement("div");
    grid.className = "calc-option-grid";
    var filtered = commodities.filter(function (c) { return c.category === state.category; });
    filtered.forEach(function (c) {
      var hasData = !!getCommodityCountryData(c, state.country);
      var card = document.createElement("div");
      card.className = "calc-option-card" + (state.commodity && state.commodity.id === c.id ? " selected" : "") + (!hasData ? " disabled" : "");
      card.innerHTML = '<span class="emoji">' + c.icon + "</span><span>" + c.name + "</span>" +
        (!hasData ? '<span style="font-size:0.65rem;color:var(--soil);">Data coming soon</span>' : "");
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
    var animalLabel = state.commodity.unit_label.charAt(0).toUpperCase() + state.commodity.unit_label.slice(1);
    stepHeader(root, "Step 5 of 8", isCrop ? "Farm Size" : "How Many " + animalLabel + "s?");

    if (isCrop) {
      // Land unit switcher
      var unitLabel = document.createElement("div");
      unitLabel.className = "calc-step-label";
      unitLabel.textContent = "Select your land unit";
      root.appendChild(unitLabel);

      var unitGroup = document.createElement("div");
      unitGroup.className = "calc-toggle-group";
      unitGroup.style.marginBottom = "20px";

      Object.keys(LAND_UNITS).forEach(function (key) {
        var u = LAND_UNITS[key];
        var btn = document.createElement("button");
        btn.className = "calc-toggle-btn" + (state.landUnit === key ? " active" : "");
        btn.textContent = u.label;
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
        plotNote.textContent = LAND_UNITS[state.landUnit].note;
        root.appendChild(plotNote);
      }
    }

    var field = document.createElement("div");
    field.className = "calc-field";
    var label = document.createElement("label");
    if (isCrop) {
      var u = LAND_UNITS[state.landUnit];
      label.textContent = "Farm size (" + u.label.toLowerCase() + ")";
    } else {
      label.textContent = state.commodity.quantity_label || ("Number of " + animalLabel + "s");
    }
    field.appendChild(label);

    var input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = isCrop && state.landUnit === "plot" ? "1" : "0.5";
    input.className = "calc-input";
    input.value = state.quantity !== null ? state.quantity : "";
    input.placeholder = isCrop ? (state.landUnit === "plot" ? "e.g. 4 plots" : state.landUnit === "acre" ? "e.g. 1 acre" : "e.g. 0.4 ha") : "e.g. 500";
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
      convNote.textContent = "\u2248 " + ha.toFixed(3) + " hectares";
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
      stepHeader(root, "Step 6 of 8", "Expected Survival Rate");
      var box = document.createElement("div");
      box.className = "calc-reference-box";
      box.innerHTML = "Reference survival rate for " + state.commodity.name + ": <strong>" + cd.survival_rate + "%</strong><br><span class=\"as-of\">Source: " + cd.source + "</span>";
      root.appendChild(box);

      var field = document.createElement("div");
      field.className = "calc-field";
      var label = document.createElement("label");
      label.textContent = "Survival rate to use in this calculation (%)";
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
    stepHeader(root, "Step 6 of 8", isRecurring ? "Expected Output" : "Expected Yield");

    var refBox = document.createElement("div");
    refBox.className = "calc-reference-box";
    if (isRecurring) {
      refBox.innerHTML = "Reference: <strong>" + cd.output_low + " \u2013 " + cd.output_high + "</strong> " + state.commodity.output_label + " (typical: " + cd.output_expected + ")<br><span class=\"as-of\">Source: " + cd.source + " \u2014 as of " + cd.as_of + "</span>";
    } else {
      refBox.innerHTML = "Reference yield: <strong>" + cd.yield_low + " \u2013 " + cd.yield_high + "</strong> " + cd.yield_unit + "/hectare (typical: " + cd.yield_expected + ")<br><span class=\"as-of\">Source: " + cd.source + " \u2014 as of " + cd.as_of + "</span>";
    }
    root.appendChild(refBox);

    var toggleGroup = document.createElement("div");
    toggleGroup.className = "calc-toggle-group";
    var btnRec = document.createElement("button");
    btnRec.className = "calc-toggle-btn" + (state.yieldMode === "recommended" ? " active" : "");
    btnRec.textContent = "Use Recommended Estimate";
    btnRec.onclick = function () {
      state.yieldMode = "recommended";
      state.yieldValue = isRecurring ? cd.output_expected : cd.yield_expected;
      render();
    };
    var btnCustom = document.createElement("button");
    btnCustom.className = "calc-toggle-btn" + (state.yieldMode === "custom" ? " active" : "");
    btnCustom.textContent = "Enter My Own";
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
    label.textContent = isRecurring ? state.commodity.output_label : ("Yield (" + cd.yield_unit + " per hectare — scaled to your " + (LAND_UNITS[state.landUnit] ? LAND_UNITS[state.landUnit].label.toLowerCase() : "area") + ")");
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
    stepHeader(root, "Step 7 of 8", "Expected Selling Price");

    var refBox = document.createElement("div");
    refBox.className = "calc-reference-box";
    var currency = currencySymbol();
    var priceLabel, defaultPrice;

    if (mode === "crop") {
      priceLabel = "Selling price (" + currency + " per kg)";
      defaultPrice = cd.price_expected;
      refBox.innerHTML = "Reference price range: <strong>" + fmtMoney(cd.price_low, currency) + " \u2013 " + fmtMoney(cd.price_high, currency) + " " + cd.price_unit + "</strong><br><span class=\"as-of\">Source: " + cd.source + " \u2014 as of " + cd.as_of + "</span>";
    } else if (mode === "livestock_unit") {
      priceLabel = "Selling price (" + currency + " " + cd.price_unit + ")";
      defaultPrice = cd.price_per_unit;
      refBox.innerHTML = "Reference price range: <strong>" + fmtMoney(cd.price_low, currency) + " \u2013 " + fmtMoney(cd.price_high, currency) + "</strong> " + cd.price_unit + "<br><span class=\"as-of\">Source: " + cd.source + " \u2014 as of " + cd.as_of + "</span>";
    } else {
      priceLabel = "Price per unit (" + currency + " " + cd.price_unit + ")";
      defaultPrice = cd.price_per_unit;
      refBox.innerHTML = "Reference price range: <strong>" + fmtMoney(cd.price_low, currency) + " \u2013 " + fmtMoney(cd.price_high, currency) + "</strong> " + cd.price_unit + "<br><span class=\"as-of\">Source: " + cd.source + " \u2014 as of " + cd.as_of + "</span>";
    }
    root.appendChild(refBox);

    var toggleGroup = document.createElement("div");
    toggleGroup.className = "calc-toggle-group";
    var btnRec = document.createElement("button");
    btnRec.className = "calc-toggle-btn" + (state.priceMode === "recommended" ? " active" : "");
    btnRec.textContent = "Use Reference Price";
    btnRec.onclick = function () {
      state.priceMode = "recommended";
      state.priceValue = defaultPrice;
      render();
    };
    var btnCustom = document.createElement("button");
    btnCustom.className = "calc-toggle-btn" + (state.priceMode === "custom" ? " active" : "");
    btnCustom.textContent = "Enter My Own Price";
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
    stepHeader(root, "Step 8 of 8", "Production Costs");

    var currency = currencySymbol();
    var isCrop = state.commodity.unit_mode === "crop";
    var unitInfo = isCrop ? (LAND_UNITS[state.landUnit] || LAND_UNITS.hectare) : null;
    var hectares = isCrop ? quantityInHectares() : null;

    // Reference box — show per-hectare cost AND the scaled actual cost for their farm size
    var refBox = document.createElement("div");
    refBox.className = "calc-reference-box";
    if (isCrop && hectares && hectares !== 1) {
      var scaledTotal = cd.cost_per_unit * hectares;
      refBox.innerHTML = "Reference cost: <strong>" + fmtMoney(cd.cost_per_unit, currency) + " per hectare</strong>" +
        " &times; " + hectares.toFixed(3) + " ha (" + state.quantity + " " + unitInfo.abbr + ")" +
        " = estimated total <strong>" + fmtMoney(scaledTotal, currency) + "</strong>" +
        "<br><span class=\"as-of\">Source: " + cd.source + " \u2014 as of " + cd.as_of + "</span>" +
        "<br><small style='opacity:0.8'>Each cost line below is per hectare. Your actual total is automatically scaled to your farm size.</small>";
    } else {
      refBox.innerHTML = "Reference total cost per " + (isCrop ? "hectare" : state.commodity.unit_label) + ": <strong>" + fmtMoney(cd.cost_per_unit, currency) + "</strong>" +
        "<br><span class=\"as-of\">Source: " + cd.source + " \u2014 as of " + cd.as_of + "</span>";
    }
    root.appendChild(refBox);

    var toggleGroup = document.createElement("div");
    toggleGroup.className = "calc-toggle-group";
    var btnRec = document.createElement("button");
    btnRec.className = "calc-toggle-btn" + (state.costMode === "recommended" ? " active" : "");
    btnRec.textContent = "Use Estimated Costs";
    btnRec.onclick = function () {
      state.costMode = "recommended";
      state.costItems = cd.cost_breakdown.map(function (i) { return { label: i.label, amount: i.amount }; });
      render();
    };
    var btnCustom = document.createElement("button");
    btnCustom.className = "calc-toggle-btn" + (state.costMode === "custom" ? " active" : "");
    btnCustom.textContent = "Edit My Own Costs";
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
      ? "Total/ha &times; " + hectares.toFixed(3) + "ha = actual total"
      : "Total per " + (isCrop ? "hectare" : state.commodity.unit_label);
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

    actionBar(root, { back: goBack, next: goToResults, nextLabel: "Calculate My Profit" });
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
      root.innerHTML = '<p style="color:red;padding:24px;text-align:center;">Calculation engine not ready. Please refresh the page and try again.</p>';
      return;
    }

    var currency = currencySymbol();

    // Build input with null safety
    var input;
    try {
      input = buildEngineInput();
    } catch (e) {
      root.innerHTML = '<p style="color:red;padding:24px;text-align:center;">Error preparing inputs: ' + e.message + '. Please go back and check your entries.</p>';
      return;
    }

    // Run calculation with null safety
    var scenarios;
    try {
      scenarios = engine.calculateScenarios(input, 15);
    } catch (e) {
      root.innerHTML = '<p style="color:red;padding:24px;text-align:center;">Calculation error: ' + e.message + '. Please go back and try again.</p>';
      return;
    }

    var result = scenarios[state.scenarioTab] || scenarios.expected;
    if (!result) {
      root.innerHTML = '<p style="color:red;padding:24px;">Results could not be calculated. Please go back and check your entries.</p>';
      return;
    }

    var isCrop = state.commodity.unit_mode === "crop";
    var unitInfo = isCrop ? (LAND_UNITS[state.landUnit] || LAND_UNITS.hectare) : null;
    var displayQty = state.quantity + " " + (isCrop ? unitInfo.abbr : state.commodity.unit_label + (state.quantity != 1 ? "s" : ""));
    var profitPerLabel = "Profit per " + (isCrop ? unitInfo.label.replace(/s$/, "").toLowerCase() : state.commodity.unit_label);

    // --- HEADER ---
    var summary = document.createElement("div");
    summary.style.marginBottom = "16px";
    summary.innerHTML =
      '<div class="calc-step-label">Your Profit Report</div>' +
      '<h2 class="calc-step-title" style="margin-bottom:4px;">' + state.commodity.name + "</h2>" +
      '<p style="color:var(--ink-soft);font-size:0.9rem;">' +
        currentCountryObj().name + (state.region ? " \u2014 " + state.region : "") +
        " \u00b7 " + displayQty +
      "</p>";
    root.appendChild(summary);

    // --- HERO PROFIT ---
    var isLoss = result.profit < 0;
    var hero = document.createElement("div");
    hero.className = "calc-hero-result";
    hero.innerHTML =
      '<div class="label">Estimated Profit (' + state.scenarioTab + " scenario)</div>" +
      '<div class="value' + (isLoss ? " negative" : "") + '">' + fmtMoney(result.profit, currency) + "</div>" +
      (isLoss ? '<div style="font-size:0.85rem;opacity:0.8;margin-top:6px;">&#9888; This enterprise shows a loss under current inputs. See advice below.</div>' : "");
    root.appendChild(hero);

    // --- SCENARIO TABS ---
    var scenarioTabs = document.createElement("div");
    scenarioTabs.className = "calc-scenario-tabs";
    ["conservative", "expected", "optimistic"].forEach(function (s) {
      var tab = document.createElement("div");
      tab.className = "calc-scenario-tab" + (state.scenarioTab === s ? " active" : "");
      var scenResult = scenarios[s];
      var scenProfit = scenResult ? fmtMoney(scenResult.profit, currency) : "\u2014";
      tab.innerHTML = '<strong>' + s.charAt(0).toUpperCase() + s.slice(1) + '</strong><br>' +
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
      { label: "Total Investment", value: fmtMoney(result.totalCost, currency), icon: "\ud83d\udcb0" },
      { label: "Expected Revenue", value: fmtMoney(result.totalRevenue, currency), icon: "\ud83d\udcb5" },
      { label: "Return on Investment", value: roi, icon: "\ud83d\udcc8" },
      { label: "Break-even Price", value: bep, icon: "\u2696\ufe0f" },
      { label: "Break-even Yield", value: bey, icon: "\ud83c\udf31" },
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
    adviceTitle.textContent = "\ud83d\udca1 Technical Analysis & Advice";
    adviceSection.appendChild(adviceTitle);

    // Profitability interpretation
    var profitBlock = document.createElement("div");
    profitBlock.style.cssText = "background:var(--sage-light);border-left:4px solid var(--green-deep);border-radius:0 10px 10px 0;padding:14px 16px;margin-bottom:12px;";
    var profitText = "";
    if (result.roi === null) {
      profitText = "Unable to calculate ROI. Check your cost and price entries.";
    } else if (result.profit < 0) {
      profitText = "\u26a0\ufe0f Loss of " + fmtMoney(Math.abs(result.profit), currency) + " projected. Your costs exceed expected revenue by " + Math.abs(result.roi).toFixed(1) + "%. Before investing, review: (1) Can you reduce input costs — especially labour, seeds or fertilizer? (2) Can you access a better selling price through direct buyers, processors or urban markets? (3) Can you improve yield through better variety selection or agronomic practice?";
    } else if (result.roi < 20) {
      profitText = "\ud83d\udcc9 Thin margin (" + result.roi.toFixed(1) + "% ROI). A 10\u201315% drop in selling price or a 10% yield shortfall could wipe out your profit. This enterprise carries significant price and yield risk. Consider whether you can reduce costs or access premium buyers before scaling up.";
    } else if (result.roi < 60) {
      profitText = "\u2705 Reasonable return (" + result.roi.toFixed(1) + "% ROI). This is a viable enterprise if your inputs and prices hold. Monitor seasonal price changes — markets for most African crops and livestock can swing significantly at peak supply periods. Build a 10\u201315% cost buffer into your planning.";
    } else {
      profitText = "\ud83c\udf1f Strong projected return (" + result.roi.toFixed(1) + "% ROI). Excellent margin if achieved. Verify your cost and price assumptions against your local market before scaling. Start at a manageable scale, confirm results, then expand.";
    }
    profitBlock.innerHTML = '<div style="font-weight:700;color:var(--green-deep);margin-bottom:6px;font-size:0.95rem;">\ud83d\udcca Profitability Assessment</div>' +
      '<p style="margin:0;font-size:0.88rem;color:var(--ink-soft);line-height:1.7;">' + profitText + "</p>";
    adviceSection.appendChild(profitBlock);

    // Break-even interpretation
    if (result.breakEvenPrice !== null && result.breakEvenPrice > 0) {
      var cd2 = getCommodityCountryData(state.commodity, state.country);
      var bepBlock = document.createElement("div");
      bepBlock.style.cssText = "background:#edf4ff;border-left:4px solid #4a7cc7;border-radius:0 10px 10px 0;padding:14px 16px;margin-bottom:12px;";
      var bepText = "Your break-even selling price is " + fmtMoney(result.breakEvenPrice, currency) + " " + (cd2 ? cd2.price_unit || "" : "") + ". This is the minimum price you must receive to cover all your costs. ";
      if (cd2 && cd2.price_low && result.breakEvenPrice > cd2.price_low * 0.9) {
        bepText += "Your break-even is close to the reference market floor price (" + fmtMoney(cd2.price_low, currency) + "). If prices fall to their seasonal low, you risk a loss. Secure buyers before harvest or target premium markets.";
      } else {
        bepText += "This gives you a reasonable buffer above the reference low-end market price. Maintain your cost discipline to protect this buffer.";
      }
      bepBlock.innerHTML = '<div style="font-weight:700;color:#1a3a6b;margin-bottom:6px;font-size:0.95rem;">\u2696\ufe0f Break-even Analysis</div>' +
        '<p style="margin:0;font-size:0.88rem;color:var(--ink-soft);line-height:1.7;">' + bepText + "</p>";
      adviceSection.appendChild(bepBlock);
    }

    // Scenario comparison advice
    var scenBlock = document.createElement("div");
    scenBlock.style.cssText = "background:#fff8e8;border-left:4px solid var(--gold);border-radius:0 10px 10px 0;padding:14px 16px;margin-bottom:12px;";
    var consProfit = scenarios.conservative ? scenarios.conservative.profit : null;
    var optProfit = scenarios.optimistic ? scenarios.optimistic.profit : null;
    var scenText = "The three scenarios above apply a \u00b115% variation to your yield and price inputs. ";
    if (consProfit !== null && optProfit !== null) {
      var range = fmtMoney(Math.abs(optProfit - consProfit), currency);
      scenText += "The difference between your Conservative and Optimistic outcomes is " + range + ". ";
      if (consProfit < 0) {
        scenText += "Your conservative scenario shows a loss \u2014 meaning if prices or yields underperform by just 15%, this enterprise loses money. This is a high-risk profile. Only proceed if you have strong buyer relationships or yield confidence.";
      } else {
        scenText += "Even in the conservative case your enterprise is profitable, which indicates a resilient enterprise with good downside protection.";
      }
    }
    scenBlock.innerHTML = '<div style="font-weight:700;color:#6b4e10;margin-bottom:6px;font-size:0.95rem;">\ud83d\udcca Scenario Range Analysis</div>' +
      '<p style="margin:0;font-size:0.88rem;color:var(--ink-soft);line-height:1.7;">' + scenText + "</p>";
    adviceSection.appendChild(scenBlock);

    // What to do next
    var nextBlock = document.createElement("div");
    nextBlock.style.cssText = "background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin-bottom:12px;";
    nextBlock.innerHTML = '<div style="font-weight:700;color:var(--green-deep);margin-bottom:8px;font-size:0.95rem;">\ud83d\udea6 Recommended Next Steps</div>' +
      '<ul style="margin:0;padding-left:18px;font-size:0.88rem;color:var(--ink-soft);line-height:1.9;">' +
      "<li>Compare these figures against your own local input costs before committing capital</li>" +
      "<li>Verify your expected selling price with at least 2\u20133 local buyers or market visits</li>" +
      "<li>Start at a scale you can afford to lose if results differ from projections</li>" +
      "<li>Keep records of your actual costs and revenue to improve future planning</li>" +
      "<li>Re-run this calculator with your real numbers once you have market price data</li>" +
      "</ul>";
    adviceSection.appendChild(nextBlock);

    root.appendChild(adviceSection);

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
    adSlot.textContent = "Advertisement (activates after AdSense approval)";
    root.appendChild(adSlot);

    // --- DISCLAIMER ---
    var disclaimer = document.createElement("div");
    disclaimer.className = "calc-disclaimer";
    disclaimer.innerHTML = "<strong>Important disclaimer:</strong> All figures are estimates based on reference data and your inputs. They are not guaranteed returns. Actual farm performance depends on yield, input prices, weather, pests, diseases, labour availability, transportation and market conditions. Always verify local prices and costs before making any investment decision. <strong>GoOrganicAfrica accepts no liability for financial decisions made based on these estimates.</strong>";
    root.appendChild(disclaimer);

    // --- ACTION BUTTONS ---
    var actions = document.createElement("div");
    actions.className = "calc-action-bar";
    var restartBtn = document.createElement("button");
    restartBtn.className = "btn btn-outline";
    restartBtn.textContent = "Start New Calculation";
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
    editBtn.textContent = "Edit My Inputs";
    editBtn.onclick = function () { goToStep("size"); };
    actions.appendChild(restartBtn);
    actions.appendChild(editBtn);
    root.appendChild(actions);
  }


  window.FarmProfitCalculator = { init: init };
})();
