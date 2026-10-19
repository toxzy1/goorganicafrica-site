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
    "Dataset covers 73 Nigerian markets and monthly observations through September 2026.": {
      fr: "Le jeu de données couvre 73 marchés nigérians et des observations mensuelles jusqu’en septembre 2026.",
      ar: "تغطي مجموعة البيانات 73 سوقاً نيجيرياً وملاحظات شهرية حتى سبتمبر 2026.",
      pt: "O conjunto de dados abrange 73 mercados nigerianos e observações mensais até setembro de 2026.",
      sw: "Seti ya data inajumuisha masoko 73 ya Nigeria na uchunguzi wa kila mwezi hadi Septemba 2026."
    },
    "August 2026 indicative local commodity prices are published by NEPC; use the source table for commodity, market, unit and exact quotation before displaying a price.": {
      fr: "La NEPC publie des prix indicatifs locaux pour août 2026 ; consultez le tableau source pour le produit, le marché, l’unité et la cotation exacte avant d’afficher un prix.",
      ar: "ينشر مجلس ترويج الصادرات النيجيري أسعاراً محلية استرشادية لشهر أغسطس 2026؛ راجع جدول المصدر لتحديد السلعة والسوق والوحدة والسعر الدقيق قبل عرض أي سعر.",
      pt: "A NEPC publica preços locais indicativos para agosto de 2026; consulte a tabela de origem para confirmar produto, mercado, unidade e cotação exata antes de apresentar um preço.",
      sw: "NEPC huchapisha bei elekezi za bidhaa za ndani za Agosti 2026; angalia jedwali la chanzo kwa bidhaa, soko, kipimo na bei kamili kabla ya kuonyesha bei."
    },
    "Provides selectable market, agricultural product and price-regime date filters; exact quotations are retrieved from the official interface.": {
      fr: "Permet de sélectionner le marché, le produit agricole et les dates du régime de prix ; les cotations exactes sont obtenues dans l’interface officielle.",
      ar: "يوفر خيارات لتحديد السوق والمنتج الزراعي وتواريخ نظام الأسعار؛ وتُستخرج الأسعار الدقيقة من الواجهة الرسمية.",
      pt: "Permite selecionar o mercado, o produto agrícola e as datas do regime de preços; as cotações exatas são obtidas na interface oficial.",
      sw: "Hutoa vichujio vya kuchagua soko, bidhaa ya kilimo na tarehe za mfumo wa bei; bei kamili hupatikana kupitia kiolesura rasmi."
    },
    "Weekly market analysis published 21 September 2026. Use the source for the stated commodity variety and unit.": {
      fr: "Analyse hebdomadaire du marché publiée le 21 septembre 2026. Consultez la source pour connaître la variété du produit et l’unité indiquées.",
      ar: "نُشر تحليل السوق الأسبوعي في 21 سبتمبر 2026. راجع المصدر لمعرفة صنف السلعة والوحدة المذكورين.",
      pt: "Análise semanal do mercado publicada em 21 de setembro de 2026. Consulte a fonte para confirmar a variedade do produto e a unidade indicadas.",
      sw: "Uchambuzi wa soko wa kila wiki ulichapishwa tarehe 21 Septemba 2026. Tumia chanzo kuthibitisha aina ya bidhaa na kipimo kilichotajwa."
    },
    "Official weekly market analysis published 5 October 2026.": {
      fr: "Analyse hebdomadaire officielle du marché publiée le 5 octobre 2026.",
      ar: "نُشر تحليل السوق الأسبوعي الرسمي في 5 أكتوبر 2026.",
      pt: "Análise semanal oficial do mercado publicada em 5 de outubro de 2026.",
      sw: "Uchambuzi rasmi wa soko wa kila wiki ulichapishwa tarehe 5 Oktoba 2026."
    },
    "Official report says average livestock prices fell in the week ending 30 September 2026, attributed largely to increased livestock supply and lower demand.": {
      fr: "Le rapport officiel indique que les prix moyens du bétail ont baissé pendant la semaine terminée le 30 septembre 2026, principalement en raison d’une offre accrue et d’une demande plus faible.",
      ar: "يفيد التقرير الرسمي بانخفاض متوسط أسعار الماشية في الأسبوع المنتهي في 30 سبتمبر 2026، ويُعزى ذلك أساساً إلى زيادة المعروض وانخفاض الطلب.",
      pt: "O relatório oficial indica que os preços médios do gado caíram na semana que terminou em 30 de setembro de 2026, sobretudo devido ao aumento da oferta e à menor procura.",
      sw: "Ripoti rasmi inasema wastani wa bei za mifugo ulipungua katika wiki iliyoishia tarehe 30 Septemba 2026, hasa kutokana na ongezeko la ugavi na kupungua kwa mahitaji."
    },
    "Current NAMIS displayed market price; observation date recorded as retrieval date.": {
      fr: "Prix de marché actuellement affiché par NAMIS ; la date d’observation correspond à la date de consultation.",
      ar: "سعر السوق المعروض حالياً في NAMIS؛ سُجل تاريخ الرصد باعتباره تاريخ الاسترجاع.",
      pt: "Preço de mercado atualmente apresentado pelo NAMIS; a data de observação corresponde à data de consulta.",
      sw: "Bei ya soko inayoonyeshwa sasa na NAMIS; tarehe ya uchunguzi imewekwa kuwa tarehe ya kupata taarifa."
    },
    "Current NAMIS displayed market price; retrieval date recorded as observation date.": {
      fr: "Prix de marché actuellement affiché par NAMIS ; la date de consultation est enregistrée comme date d’observation.",
      ar: "سعر السوق المعروض حالياً في NAMIS؛ سُجل تاريخ الاسترجاع كتاريخ للرصد.",
      pt: "Preço de mercado atualmente apresentado pelo NAMIS; a data de consulta foi registada como data de observação.",
      sw: "Bei ya soko inayoonyeshwa sasa na NAMIS; tarehe ya kupata taarifa imerekodiwa kama tarehe ya uchunguzi."
    },
    "Current NAMIS displayed retail market price; observation date recorded as retrieval date.": {
      fr: "Prix de détail actuellement affiché par NAMIS ; la date d’observation correspond à la date de consultation.",
      ar: "سعر التجزئة المعروض حالياً في NAMIS؛ سُجل تاريخ الرصد باعتباره تاريخ الاسترجاع.",
      pt: "Preço de retalho atualmente apresentado pelo NAMIS; a data de observação corresponde à data de consulta.",
      sw: "Bei ya rejareja inayoonyeshwa sasa na NAMIS; tarehe ya uchunguzi imewekwa kuwa tarehe ya kupata taarifa."
    },
    "National weekly average wholesale price. The 28 Sep–02 Oct 2026 bulletin is the current observation; the prior week is retained to calculate movement.": {
      fr: "Prix de gros moyen national hebdomadaire. Le bulletin du 28 septembre au 2 octobre 2026 constitue l’observation actuelle ; la semaine précédente est conservée pour calculer l’évolution.",
      ar: "متوسط سعر الجملة الوطني الأسبوعي. يُعد نشرة 28 سبتمبر إلى 2 أكتوبر 2026 الملاحظة الحالية؛ وتُحتفظ ببيانات الأسبوع السابق لحساب التغير.",
      pt: "Preço médio grossista nacional semanal. O boletim de 28 de setembro a 2 de outubro de 2026 é a observação atual; a semana anterior é mantida para calcular a variação.",
      sw: "Wastani wa kitaifa wa bei ya jumla ya kila wiki. Taarifa ya tarehe 28 Septemba–02 Oktoba 2026 ndiyo uchunguzi wa sasa; wiki iliyotangulia imehifadhiwa ili kukokotoa mabadiliko."
    },
    "Domestic food prices, price changes and anomalies; compare markets, commodities and seasons.": {
      fr: "Prix alimentaires intérieurs, variations de prix et anomalies ; comparez les marchés, les produits et les saisons.",
      ar: "أسعار الغذاء المحلية وتغيراتها وحالات الشذوذ؛ قارن بين الأسواق والسلع والمواسم.",
      pt: "Preços internos dos alimentos, alterações de preços e anomalias; compare mercados, produtos e épocas.",
      sw: "Bei za ndani za chakula, mabadiliko ya bei na hali zisizo za kawaida; linganisha masoko, bidhaa na misimu."
    },
    "Wheat, maize, rice and soybeans; international market developments and outlook.": {
      fr: "Blé, maïs, riz et soja ; évolutions et perspectives des marchés internationaux.",
      ar: "القمح والذرة والأرز وفول الصويا؛ تطورات الأسواق الدولية وتوقعاتها.",
      pt: "Trigo, milho, arroz e soja; evolução e perspetivas dos mercados internacionais.",
      sw: "Ngano, mahindi, mpunga na soya; maendeleo na mtazamo wa masoko ya kimataifa."
    },
    "Regional agricultural information system covering production, market, price and farmer data across ECOWAS Member States; use for regional market intelligence and cross-checking national sources.": {
      fr: "Système régional d’information agricole couvrant la production, les marchés, les prix et les données des agriculteurs dans les États membres de la CEDEAO ; à utiliser pour l’analyse régionale et la vérification croisée des sources nationales.",
      ar: "نظام معلومات زراعية إقليمي يغطي الإنتاج والأسواق والأسعار وبيانات المزارعين في الدول الأعضاء في إيكواس؛ يُستخدم للتحليل الإقليمي ومقارنة المصادر الوطنية.",
      pt: "Sistema regional de informação agrícola que abrange produção, mercados, preços e dados de agricultores nos Estados-membros da CEDEAO; utilizar para análise regional e verificação cruzada de fontes nacionais.",
      sw: "Mfumo wa kikanda wa taarifa za kilimo unaojumuisha uzalishaji, masoko, bei na taarifa za wakulima katika nchi wanachama wa ECOWAS; utumike kwa taarifa za kikanda na kulinganisha vyanzo vya kitaifa."
    },
    "Regional agricultural information system with Member State data, including market and trade indicators, agricultural statistics and food-security information.": {
      fr: "Système régional d’information agricole avec des données des États membres, notamment des indicateurs de marché et de commerce, des statistiques agricoles et des informations sur la sécurité alimentaire.",
      ar: "نظام معلومات زراعية إقليمي يضم بيانات الدول الأعضاء، بما فيها مؤشرات السوق والتجارة والإحصاءات الزراعية ومعلومات الأمن الغذائي.",
      pt: "Sistema regional de informação agrícola com dados dos Estados-membros, incluindo indicadores de mercado e comércio, estatísticas agrícolas e informações de segurança alimentar.",
      sw: "Mfumo wa kikanda wa taarifa za kilimo wenye data za nchi wanachama, ikiwemo viashiria vya soko na biashara, takwimu za kilimo na taarifa za usalama wa chakula."
    },
    "Internationally comparable domestic food-price monitoring and market intelligence; country coverage varies by commodity, market and reporting frequency.": {
      fr: "Suivi comparable à l’échelle internationale des prix alimentaires intérieurs et informations de marché ; la couverture varie selon le produit, le marché et la fréquence des rapports.",
      ar: "رصد لأسعار الغذاء المحلية ومعلومات السوق قابلة للمقارنة دولياً؛ وتختلف التغطية حسب السلعة والسوق وتواتر التقارير.",
      pt: "Monitorização comparável internacionalmente dos preços internos dos alimentos e inteligência de mercado; a cobertura varia por produto, mercado e frequência de publicação.",
      sw: "Ufuatiliaji wa bei za ndani za chakula unaoweza kulinganishwa kimataifa na taarifa za soko; ufunikaji hutofautiana kulingana na bidhaa, soko na marudio ya ripoti."
    },
    "Annual food inflation": {
      fr: "Inflation annuelle des prix alimentaires",
      ar: "التضخم السنوي لأسعار الغذاء",
      pt: "Inflação anual dos preços dos alimentos",
      sw: "Mfumuko wa bei wa chakula wa mwaka"
    },
    "Annual non-food inflation": {
      fr: "Inflation annuelle hors alimentation",
      ar: "التضخم السنوي لغير الغذاء",
      pt: "Inflação anual não alimentar",
      sw: "Mfumuko wa bei wa bidhaa zisizo za chakula wa mwaka"
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
    document.querySelectorAll(".market-card p").forEach(function (el) {
      var label = el.querySelector('strong[data-i18n="markets.freshnessLabel"]');
      if (!label) return;
      var original = el.getAttribute("data-market-freshness-original");
      if (original === null) {
        original = Array.from(el.childNodes).filter(function (node) { return node.nodeType === 3; }).map(function (node) { return node.textContent; }).join("").trim();
        el.setAttribute("data-market-freshness-original", original);
      }
      var words = {
        Recent: { fr: "Récent", ar: "حديث", pt: "Recente", sw: "Mpya" },
        Older: { fr: "Ancien", ar: "أقدم", pt: "Mais antigo", sw: "Ya zamani" },
        Stale: { fr: "Périmé", ar: "قديم", pt: "Desatualizado", sw: "Iliyopitwa na wakati" },
        "Source Reference": { fr: "Référence de source", ar: "مرجع المصدر", pt: "Referência da fonte", sw: "Rejea ya chanzo" }
      };
      var value = original;
      Object.keys(words).forEach(function (word) {
        var translated = words[word][lang];
        if (translated) value = value.replace(new RegExp(word, "g"), translated);
      });
      el.innerHTML = label.outerHTML + (value ? " " + value : "");
    });
    document.querySelectorAll("#market-source-map small").forEach(function (el) {
      var original = el.getAttribute("data-market-scope-original") || el.textContent;
      if (!el.hasAttribute("data-market-scope-original")) el.setAttribute("data-market-scope-original", original);
      var scope = { Regional: { fr: "Régionale", ar: "إقليمي", pt: "Regional", sw: "Kikanda" }, Continental: { fr: "Continentale", ar: "قاري", pt: "Continental", sw: "Bara" }, Domestic: { fr: "National", ar: "محلي", pt: "Nacional", sw: "Ndani ya nchi" }, National: { fr: "National", ar: "وطني", pt: "Nacional", sw: "Kitaifa" } };
      var value = original.replace(/Regional|Continental|Domestic|National/g, function (word) { return scope[word] && scope[word][lang] ? scope[word][lang] : word; });
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

  function formatMarketDate(raw, locale) {
    var value = String(raw || "").trim();
    if (!value) return value;
    // Accept date-only values and ISO timestamps from source datasets. Keep the
    // date at UTC noon to avoid a timezone shift into the previous/next day.
    var match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
    var date = match
      ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12))
      : new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(locale, {
      day: "numeric", month: "short", year: "numeric", timeZone: "UTC"
    }).format(date);
  }

  function refreshMarketDates() {
    var lang = (document.documentElement.lang || "en").slice(0, 2);
    var locales = { en: "en-GB", fr: "fr-FR", ar: "ar", pt: "pt-PT", sw: "sw-TZ" };
    var locale = locales[lang] || "en-GB";
    document.querySelectorAll("[data-market-date]").forEach(function (el) {
      var original = el.getAttribute("data-market-date-original") || el.getAttribute("data-market-date") || el.textContent.trim();
      if (!el.hasAttribute("data-market-date-original")) el.setAttribute("data-market-date-original", original);
      el.textContent = formatMarketDate(original, locale);
    });

    // Localize dataset-driven freshness values and price-type options as well as
    // the translated interface labels. Keep original values for filtering.
    var freshness = {
      "Recent": { fr: "Récent", ar: "حديث", pt: "Recente", sw: "Hivi karibuni" },
      "Older": { fr: "Ancien", ar: "أقدم", pt: "Mais antigo", sw: "Ya zamani" },
      "Stale": { fr: "Périmé", ar: "قديم", pt: "Desatualizado", sw: "Iliyopitwa na wakati" },
      "Source reference": { fr: "Référence de source", ar: "مرجع المصدر", pt: "Referência da fonte", sw: "Rejea ya chanzo" },
      "Source Reference": { fr: "Référence de source", ar: "مرجع المصدر", pt: "Referência da fonte", sw: "Rejea ya chanzo" }
    };
    document.querySelectorAll(".market-card p").forEach(function (p) {
      var label = p.querySelector('strong[data-i18n="markets.freshnessLabel"]');
      if (!label) return;
      var node = Array.prototype.slice.call(p.childNodes).find(function (child) {
        return child.nodeType === 3 && child.nodeValue.trim();
      });
      if (!node) return;
      if (!p.hasAttribute("data-market-freshness-original")) {
        p.setAttribute("data-market-freshness-original", node.nodeValue);
      }
      var original = p.getAttribute("data-market-freshness-original");
      var rendered = original;
      Object.keys(freshness).forEach(function (word) {
        var translated = lang === "en" ? word : ((freshness[word] && freshness[word][lang]) || word);
        rendered = rendered.split(word).join(translated);
      });
      node.nodeValue = rendered;
    });
    var priceTypes = {
      "Farm-gate": { fr: "Prix à la ferme", ar: "سعر باب المزرعة", pt: "Preço à saída da exploração", sw: "Bei ya shambani" },
      "Farm gate": { fr: "Prix à la ferme", ar: "سعر باب المزرعة", pt: "Preço à saída da exploração", sw: "Bei ya shambani" },
      "Retail": { fr: "Détail", ar: "التجزئة", pt: "Retalho", sw: "Rejareja" },
      "Wholesale": { fr: "Gros", ar: "الجملة", pt: "Atacado", sw: "Jumla" },
      "Producer price": { fr: "Prix producteur", ar: "سعر المنتج", pt: "Preço ao produtor", sw: "Bei ya mzalishaji" },
      "Consumer price": { fr: "Prix à la consommation", ar: "سعر المستهلك", pt: "Preço ao consumidor", sw: "Bei ya mtumiaji" },
      "Market price": { fr: "Prix du marché", ar: "سعر السوق", pt: "Preço de mercado", sw: "Bei ya soko" },
      "Source reference": { fr: "Référence de source", ar: "مرجع المصدر", pt: "Referência da fonte", sw: "Rejea ya chanzo" },
      "Official benchmark": { fr: "Référence officielle", ar: "مؤشر رسمي مرجعي", pt: "Referência oficial", sw: "Kipimo rasmi cha marejeo" }
    };
    document.querySelectorAll("#market-price-type option").forEach(function (option) {
      if (option.value === "all") return;
      var original = option.getAttribute("data-market-price-type-original") || option.textContent.trim();
      if (!option.hasAttribute("data-market-price-type-original")) option.setAttribute("data-market-price-type-original", original);
      var match = Object.keys(priceTypes).find(function (key) { return key.toLowerCase() === original.toLowerCase(); });
      option.textContent = lang === "en" ? original : (match && priceTypes[match][lang] ? priceTypes[match][lang] : original);
    });
    var compared = { fr: "comparé au", ar: "مقارنةً بـ", pt: "em comparação com", sw: "ikilinganishwa na" };
    document.querySelectorAll("[data-market-compared-label]").forEach(function (el) {
      var original = el.getAttribute("data-market-compared-label");
      el.textContent = lang === "en" ? original : (compared[lang] || original);
    });
    var scopes = {
      Regional: { fr: "Régionale", ar: "إقليمي", pt: "Regional", sw: "Kikanda" },
      Continental: { fr: "Continentale", ar: "قاري", pt: "Continental", sw: "Bara" },
      Domestic: { fr: "National", ar: "محلي", pt: "Nacional", sw: "Ndani ya nchi" },
      National: { fr: "National", ar: "وطني", pt: "Nacional", sw: "Kitaifa" }
    };
    var words = {
      source: { fr: "source", ar: "مصدر", pt: "fonte", sw: "chanzo" },
      tier: { fr: "Niveau", ar: "المستوى", pt: "Nível", sw: "Daraja" },
      verified: { fr: "Vérifié", ar: "تم التحقق في", pt: "Verificado", sw: "Imethibitishwa" }
    };
    document.querySelectorAll("[data-market-word]").forEach(function (el) {
      var key = el.getAttribute("data-market-word");
      var values = { tier: { fr: "Niveau", ar: "المستوى", pt: "Nível", sw: "Daraja" }, verified: { fr: "Vérifié", ar: "تم التحقق", pt: "Verificado", sw: "Imethibitishwa" } };
      var original = key === "tier" ? "Tier" : "Verified";
      el.textContent = lang === "en" ? original : ((values[key] && values[key][lang]) || original);
    });
    document.querySelectorAll("[data-market-scope-label]").forEach(function (el) {
      var scope = el.getAttribute("data-market-scope") || "";
      var tier = el.getAttribute("data-market-tier") || "";
      var date = el.getAttribute("data-market-verified") || "";
      var localizedScope = lang === "en" ? scope : ((scopes[scope] && scopes[scope][lang]) || scope);
      var source = lang === "en" ? "source" : (words.source[lang] || "source");
      var tierLabel = lang === "en" ? "Tier" : (words.tier[lang] || "Tier");
      var verified = lang === "en" ? "Verified" : (words.verified[lang] || "Verified");
      el.textContent = localizedScope + " " + source + " · " + tierLabel + " " + tier + " · " + verified + " " + formatMarketDate(date, locale);
    });
  }

  function refresh() {
    if (!window.GOA_I18N || !window.GOA_I18N.t) {
      refreshMarketDates();
      return;
    }

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
    // Run dates last so copy/metadata localization cannot overwrite formatted dates.
    refreshMarketDates();
  }

  document.addEventListener("goa:languagechange", refresh);
  if (typeof MutationObserver !== "undefined") {
    var lastMarketLanguage = (document.documentElement.lang || "en").slice(0, 2);
    new MutationObserver(function () {
      var nextMarketLanguage = (document.documentElement.lang || "en").slice(0, 2);
      if (nextMarketLanguage !== lastMarketLanguage) {
        lastMarketLanguage = nextMarketLanguage;
        refresh();
      }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  }
  if (window.GOA_I18N && window.GOA_I18N.ready && typeof window.GOA_I18N.ready.then === "function") {
    window.GOA_I18N.ready.then(refresh);
  } else {
    document.addEventListener("DOMContentLoaded", refresh);
  }
}());
