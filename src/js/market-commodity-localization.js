(function () {
  "use strict";

  // The Markets records keep their original commodity values for filtering and
  // source traceability. Only visible labels are translated.
  var knownKeys = {
    "agricultural-products": true, "basic-food-commodities": true,
    beans: true, beef: true, "bell-pepper": true, broiler: true, cassava: true,
    cattle: true, cucumber: true, fish: true, goat: true, habanero: true,
    layer: true, "livestock-and-fish": true, livestock: true, maize: true,
    matooke: true, milk: true, "local-agricultural-commodities": true,
    pepper: true, pig: true, rice: true, "red-irish-potato": true,
    soybean: true, tomato: true, watermelon: true, wheat: true
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
    soybeans: "soybean",
    soya: "soybean",
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
    "red-irish-potatoes": "red-irish-potato",
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
    var source = String(raw || "").trim();
    var key = slug(source);
    key = aliases[key] || key;
    if (!window.GOA_I18N || !window.GOA_I18N.t) return null;

    if (knownKeys[key]) {
      var exact = window.GOA_I18N.t("commodity", key);
      if (exact && exact !== "undefined" && exact !== key) return exact;
    }

    // Market datasets also contain cultivar and quality labels such as
    // "Beans - Nambale", "Beans — Canadian Wonder", "Dry Maize" and "Rice — IRRR".
    // Translate the food commodity name while retaining the market-specific suffix.
    var patterns = [
      { regex: /^(dry\s+)?maize\b/i, key: "maize", replace: function (m, prefix, value) { var lang = (document.documentElement.lang || "en").slice(0, 2); var dry = { fr: "Maïs sec ", ar: "ذرة جافة ", pt: "Milho seco ", sw: "Mahindi makavu " }; return prefix ? (dry[lang] || (prefix + value)) : value; } },
      { regex: /^corn\b/i, key: "maize", replace: function (m, prefix, value) { return value + m.slice(4); } },
      { regex: /^beans?\b/i, key: "beans", replace: function (m, prefix, value) { return value + source.slice(m.length); } },
      { regex: /^cassava\b/i, key: "cassava", replace: function (m, prefix, value) { var suffix = source.slice(m.length); var lang = (document.documentElement.lang || "en").slice(0, 2); if (/^\s*-\s*Fresh$/i.test(suffix)) suffix = ({ fr: " - Frais", ar: " - طازج", pt: " - Fresca", sw: " - Safi" })[lang] || suffix; return value + suffix; } },
      { regex: /^soybeans?\b/i, key: "soybean", replace: function (m, prefix, value) { return value + source.slice(m.length); } },
      { regex: /^soya\s+beans?\b/i, key: "soybean", replace: function (m, prefix, value) { return value + source.slice(m.length); } },
      { regex: /^rice\b/i, key: "rice", replace: function (m, prefix, value) { return value + source.slice(m.length); } }
    ];

    for (var i = 0; i < patterns.length; i++) {
      var match = source.match(patterns[i].regex);
      if (!match) continue;
      var translated = window.GOA_I18N.t("commodity", patterns[i].key);
      if (translated && translated !== "undefined" && translated !== patterns[i].key) {
        return patterns[i].replace(match[0], match[1], translated);
      }
    }
    return null;
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


  // Translate recurring explanatory copy supplied by market datasets, while
  // leaving official organization names, cultivar names and ISO dates intact.
  var copyTranslations = {
    "Use the official market selector and observation period before quoting a price.": {
      fr: "Utilisez le sélecteur officiel de marché et la période d’observation avant de citer un prix.",
      ar: "استخدم محدد السوق الرسمي وفترة الرصد قبل ذكر أي سعر.",
      pt: "Utilize o seletor oficial de mercado e o período de observação antes de citar um preço.",
      sw: "Tumia kichaguzi rasmi cha soko na kipindi cha uchunguzi kabla ya kutaja bei."
    },
    "NAERLS interface includes livestock and fishery market information.": {
      fr: "L’interface NAERLS comprend des informations sur les marchés du bétail et de la pêche.",
      ar: "تتضمن واجهة NAERLS معلومات عن أسواق الماشية ومصايد الأسماك.",
      pt: "A interface da NAERLS inclui informações sobre os mercados pecuários e das pescas.",
      sw: "Kiolesura cha NAERLS kinajumuisha taarifa za masoko ya mifugo na uvuvi."
    },
    "AMIS monitors wheat, maize, rice and soybeans; use as international context, not as a local farm-gate quotation.": {
      fr: "AMIS suit le blé, le maïs, le riz et le soja ; utilisez ces données comme contexte international, et non comme prix local à la ferme.",
      ar: "يرصد AMIS القمح والذرة والأرز وفول الصويا؛ استخدمه للسياق الدولي وليس كسعر محلي عند باب المزرعة.",
      pt: "O AMIS acompanha trigo, milho, arroz e soja; utilize-o como contexto internacional, não como cotação local à saída da exploração.",
      sw: "AMIS hufuatilia ngano, mahindi, mpunga na soya; itumie kama muktadha wa kimataifa, si bei ya eneo la shamba."
    },
    "AMIS international benchmark context; local price requires a country, market, unit and observation date.": {
      fr: "Référence internationale AMIS ; un prix local exige un pays, un marché, une unité et une date d’observation.",
      ar: "مرجع دولي من AMIS؛ يتطلب السعر المحلي تحديد البلد والسوق والوحدة وتاريخ الرصد.",
      pt: "Referência internacional do AMIS; o preço local exige país, mercado, unidade e data de observação.",
      sw: "Muktadha wa kipimo cha kimataifa cha AMIS; bei ya eneo inahitaji nchi, soko, kipimo na tarehe ya uchunguzi."
    },
    "AMIS international benchmark context; FAO also publishes a monthly Rice Price Update.": {
      fr: "Référence internationale AMIS ; la FAO publie également une mise à jour mensuelle des prix du riz.",
      ar: "مرجع دولي من AMIS؛ وتنشر منظمة FAO أيضاً تحديثاً شهرياً لأسعار الأرز.",
      pt: "Referência internacional do AMIS; a FAO também publica uma atualização mensal dos preços do arroz.",
      sw: "Muktadha wa kimataifa wa AMIS; FAO pia huchapisha taarifa ya kila mwezi ya bei ya mpunga."
    },
    "Annual change in food prices; this is an inflation indicator, not a commodity quotation.": {
      fr: "Variation annuelle des prix alimentaires ; il s’agit d’un indicateur d’inflation, et non d’un prix de produit.",
      ar: "التغير السنوي في أسعار الغذاء؛ هذا مؤشر للتضخم وليس سعراً لسلعة.",
      pt: "Variação anual dos preços dos alimentos; é um indicador de inflação, não uma cotação de produto.",
      sw: "Mabadiliko ya kila mwaka ya bei za chakula; hiki ni kiashiria cha mfumuko wa bei, si bei ya bidhaa."
    },
    "Annual non-food inflation indicator; retained for market-cost context, not commodity pricing.": {
      fr: "Indicateur annuel de l’inflation hors alimentation, conservé pour contextualiser les coûts du marché et non les prix des produits.",
      ar: "مؤشر سنوي للتضخم غير الغذائي، يُحتفظ به لفهم تكاليف السوق وليس لتسعير السلع.",
      pt: "Indicador anual da inflação não alimentar, mantido para contextualizar os custos do mercado e não os preços dos produtos.",
      sw: "Kiashiria cha kila mwaka cha mfumuko wa bei usio wa chakula, kinachotumika kuelewa gharama za soko, si bei za bidhaa."
    },
    "Never present a source-reference record as a current quotation.": {
      fr: "Ne présentez jamais une référence de source comme un prix actuel.",
      ar: "لا تعرض سجل مرجع المصدر على أنه سعر حالي.",
      pt: "Nunca apresente um registo de referência de fonte como uma cotação atual.",
      sw: "Usiwasilishe rekodi ya rejea ya chanzo kama bei ya sasa."
    },
    "A current quotation requires market, commodity, price, currency, unit and observation date.": {
      fr: "Un prix actuel nécessite le marché, le produit, le prix, la devise, l’unité et la date d’observation.",
      ar: "يتطلب السعر الحالي تحديد السوق والسلعة والسعر والعملة والوحدة وتاريخ الرصد.",
      pt: "Uma cotação atual exige mercado, produto, preço, moeda, unidade e data de observação.",
      sw: "Bei ya sasa inahitaji soko, bidhaa, bei, sarafu, kipimo na tarehe ya uchunguzi."
    },
    "Keep historical and stale observations for trend analysis but label their freshness.": {
      fr: "Conservez les observations historiques ou anciennes pour analyser les tendances, en indiquant leur ancienneté.",
      ar: "احتفظ بالملاحظات التاريخية والقديمة لتحليل الاتجاهات مع توضيح حداثة البيانات.",
      pt: "Mantenha observações históricas e desatualizadas para analisar tendências, identificando a sua atualidade.",
      sw: "Hifadhi uchunguzi wa zamani kwa uchanganuzi wa mwenendo lakini onyesha muda wake."
    },
    "Coarse-grain prices elevated in Sudan, South Sudan and Somalia": {
      fr: "Les prix des céréales secondaires sont élevés au Soudan, au Soudan du Sud et en Somalie",
      ar: "ارتفاع أسعار الحبوب الخشنة في السودان وجنوب السودان والصومال",
      pt: "Os preços dos cereais secundários estão elevados no Sudão, Sudão do Sul e Somália",
      sw: "Bei za nafaka zisizo laini zimepanda nchini Sudan, Sudan Kusini na Somalia"
    },
    "Coarse-grain prices varied but remained lower year-on-year in monitored markets": {
      fr: "Les prix des céréales secondaires ont varié, mais sont restés inférieurs à ceux de l’année précédente sur les marchés suivis",
      ar: "تفاوتت أسعار الحبوب الخشنة لكنها ظلت أقل من العام الماضي في الأسواق المرصودة",
      pt: "Os preços dos cereais secundários variaram, mas permaneceram abaixo dos do ano anterior nos mercados monitorizados",
      sw: "Bei za nafaka zisizo laini zilitofautiana lakini zilibaki chini ya mwaka uliopita katika masoko yaliyofuatiliwa"
    },
    "Seasonal maize price increases emerged while abundant supplies contained upward pressure": {
      fr: "Des hausses saisonnières du prix du maïs sont apparues, tandis que l’abondance de l’offre limitait la pression à la hausse",
      ar: "ظهرت زيادات موسمية في أسعار الذرة، بينما حدّت وفرة الإمدادات من الضغوط التصاعدية",
      pt: "Surgiram aumentos sazonais do preço do milho, enquanto a abundância da oferta limitou a pressão ascendente",
      sw: "Ongezeko la msimu la bei ya mahindi lilitokea huku ugavi mwingi ukipunguza shinikizo la kupanda kwa bei"
    },
    "Use regional signals as context, not as a substitute for a market-specific price.": {
      fr: "Utilisez les signaux régionaux comme contexte, et non comme substitut à un prix propre à un marché.",
      ar: "استخدم المؤشرات الإقليمية كسياق، لا بديلاً عن سعر خاص بسوق معين.",
      pt: "Utilize os sinais regionais como contexto, não como substituto de um preço específico de mercado.",
      sw: "Tumia ishara za kikanda kama muktadha, si badala ya bei ya soko mahususi."
    }
  };

  function translatedCopy(raw) {
    var language = (document.documentElement.lang || "en").slice(0, 2);
    var entry = copyTranslations[String(raw || "").trim()];
    return entry && entry[language] ? entry[language] : null;
  }

  function refreshMarketCopy() {
    var lang = (document.documentElement.lang || "en").slice(0, 2);
    if (lang === "en") {
      document.querySelectorAll("[data-market-copy-original]").forEach(function (el) {
        el.textContent = el.getAttribute("data-market-copy-original");
      });
    }
    document.querySelectorAll(".market-card p, #market-indicators p, #market-source-map p, section article p, section li, #market-signals small").forEach(function (el) {
      if (el.querySelector("strong, a, span[data-i18n]")) return;
      var original = el.getAttribute("data-market-copy-original");
      if (!original) {
        original = el.textContent.trim();
        if (!copyTranslations[original]) return;
        el.setAttribute("data-market-copy-original", original);
      }
      var translated = translatedCopy(original);
      el.textContent = translated || original;
    });
    document.querySelectorAll("#market-list .market-card > div").forEach(function (el) {
      var original = el.getAttribute("data-market-meta-original");
      if (!original) {
        original = el.textContent;
        el.setAttribute("data-market-meta-original", original);
      }
      var parts = original.split(" · ");
      if (parts.length >= 3) parts[2] = translatedCommodity(parts[2]) || parts[2];
      if (parts.length >= 2) {
        parts[1] = ({
          "National market coverage": { fr: "Couverture nationale du marché", ar: "تغطية السوق الوطنية", pt: "Cobertura nacional do mercado", sw: "Ufunikaji wa soko la kitaifa" },
          "Kenya weekly market analysis": { fr: "Analyse hebdomadaire du marché kényan", ar: "تحليل السوق الأسبوعي في كينيا", pt: "Análise semanal do mercado do Quénia", sw: "Uchambuzi wa soko la Kenya wa kila wiki" },
          "73 monitored markets": { fr: "73 marchés suivis", ar: "73 سوقاً خاضعة للرصد", pt: "73 mercados monitorizados", sw: "Masoko 73 yanayofuatiliwa" },
          "National / export-linked commodity reference": { fr: "Référence nationale des produits liée à l’exportation", ar: "مرجع وطني للسلع مرتبط بالتصدير", pt: "Referência nacional de produtos ligada à exportação", sw: "Rejea ya kitaifa ya bidhaa zinazohusiana na mauzo ya nje" },
          "Africa / international": { fr: "Afrique / international", ar: "أفريقيا / دولي", pt: "África / internacional", sw: "Afrika / kimataifa" },
          "International": { fr: "International", ar: "دولي", pt: "Internacional", sw: "Kimataifa" }
        })[parts[1]]?.[lang] || parts[1];
        el.textContent = parts.join(" · ");
      }
    });
    document.querySelectorAll("#market-source-map small").forEach(function (el) {
      var original = el.getAttribute("data-market-scope-original") || el.textContent;
      if (!el.hasAttribute("data-market-scope-original")) el.setAttribute("data-market-scope-original", original);
      var scope = { Regional: { fr: "Régionale", ar: "إقليمي", pt: "Regional", sw: "Kikanda" }, Continental: { fr: "Continentale", ar: "قاري", pt: "Continental", sw: "Bara" }, Domestic: { fr: "National", ar: "محلي", pt: "Nacional", sw: "Ndani ya nchi" } };
      var value = original.replace(/Regional|Continental|Domestic/g, function (word) { return scope[word] && scope[word][lang] ? scope[word][lang] : word; });
      value = value.replace(/Verified|Vérifié|تم التحقق في|Verificado|Imethibitishwa/g, ({ fr: "Vérifié", ar: "تم التحقق في", pt: "Verificado", sw: "Imethibitishwa" })[lang] || "Verified");
      el.textContent = value;
    });
    document.querySelectorAll(".market-card h2").forEach(function (el) {
      var original = el.getAttribute("data-market-commodity-original") || el.textContent.trim();
      var suffixes = [
        { re: /^Dry\s+/i, key: "dry", values: { fr: "Sec ", ar: "جاف ", pt: "Seco ", sw: "Kavu " } },
        { re: /\s+-\s+Fresh$/i, key: "fresh", values: { fr: " - Frais", ar: " - طازج", pt: " - Fresca", sw: " - Safi" } }
      ];
      var value = el.textContent;
      suffixes.forEach(function (item) {
        if (item.re.test(original) && item.values[lang]) value = value.replace(item.re, function (m) { return item.values[lang]; });
      });
      if (value !== el.textContent) el.textContent = value;
    });
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
      if (!line.hasAttribute("data-market-meta-original")) line.setAttribute("data-market-meta-original", line.textContent);
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
    refreshMarketCopy();
  }

  document.addEventListener("goa:languagechange", refresh);
  if (window.GOA_I18N && window.GOA_I18N.ready && typeof window.GOA_I18N.ready.then === "function") {
    window.GOA_I18N.ready.then(refresh);
  } else {
    document.addEventListener("DOMContentLoaded", refresh);
  }
}());
