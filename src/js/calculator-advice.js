window.FarmAdviceEngine = (function () {

  function fmt(n, sym) {
    if (!n && n !== 0) return "—";
    return (sym || "₦") + Math.round(n).toLocaleString();
  }

  /**
   * Generate contextual advice blocks based on calculation results.
   * Returns an array of {type, icon, heading, body} objects.
   */
  function t(key, vars) {
    return window.GOA_I18N && window.GOA_I18N.t ? window.GOA_I18N.t("advice", key, vars) : key;
  }

  function generateAdvice(result, commodity, countryData, currency) {
    var advice = [];
    var sym = currency || "₦";
    var currentLang = window.GOA_I18N && window.GOA_I18N.lang ? window.GOA_I18N.lang() : "en";
    var configuredAdvice = Array.isArray(commodity.advice) ? commodity.advice : [];
    var configuredRecommendations = Array.isArray(commodity.recommendations) ? commodity.recommendations : [];
    if (countryData && Array.isArray(countryData.recommendations)) configuredRecommendations = configuredRecommendations.concat(countryData.recommendations);
    configuredAdvice.forEach(function (item) {
      if (!item || (item.language && item.language !== currentLang) || !item.heading || !item.body) return;
      advice.push({ type: item.type || "tip", icon: item.icon || "💡", heading: item.heading, body: item.body });
    });
    configuredRecommendations.forEach(function (item) {
      if (!item || (typeof item === "object" && item.language && item.language !== currentLang)) return;
      var text = typeof item === "object" ? item.text : item;
      if (text) advice.push({ type: "tip", icon: "💡", heading: t("practicalRecommendation"), body: String(text) });
    });
    var roi = result.roi;
    if (result.profit < 0) advice.push({ type: "danger", icon: "⚠️", heading: t("loss"), body: t("lossBody", {cost: fmt(result.totalCost, sym), revenue: fmt(result.totalRevenue, sym)}) });
    else if (roi !== null && roi < 20) advice.push({ type: "warning", icon: "📉", heading: t("thin"), body: t("thinBody", {roi: roi.toFixed(1)}) });
    else if (roi !== null && roi < 60) advice.push({ type: "info", icon: "✅", heading: t("reasonable"), body: t("reasonableBody", {roi: roi.toFixed(1)}) });
    else if (roi !== null) advice.push({ type: "success", icon: "🌱", heading: t("strong"), body: t("strongBody", {roi: roi.toFixed(1)}) });
    if (result.breakEvenPrice !== null && countryData && countryData.price_low && result.breakEvenPrice > countryData.price_low * 0.85) advice.push({ type: "warning", icon: "📊", heading: t("breakEvenClose"), body: t("breakEvenBody", {price: fmt(result.breakEvenPrice, sym), commodity: commodity.name, low: fmt(countryData.price_low, sym)}) });
    var tips = {tomato:["🍅","tipTomato"], cucumber:["🥒","tipCucumber"], cassava:["🍠","tipCassava"], maize:["🌽","tipMaize"], rice:["🌾","tipRice"], habanero:["🌶️","tipHabanero"], broiler:["🐔","tipBroiler"], layer:["🥚","tipLayer"], fish:["🐟","tipFish"], pig:["🐷","tipPig"], cattle:["🐄","tipCattle"], goat:["🐐","tipGoat"] };
    var tip = tips[commodity.id];
    if (tip) advice.push({ type: "tip", icon: tip[0], heading: t(tip[1] + "Title"), body: t(tip[1] + "Body") });
    if (commodity.related_ebook_slug) advice.push({ type: "ebook", icon: "📗", heading: t("ebookHeading"), body: null, ebookSlug: commodity.related_ebook_slug });
    return advice;
  }

  /**
   * Render advice blocks into a container element.
   */
  function renderAdvice(containerEl, advice, ebookUrl) {
    if (!advice || !advice.length) return;

    var heading = document.createElement("h3");
    heading.style.cssText = "font-family:var(--font-display);color:var(--green-deep);margin:28px 0 16px;font-size:1.2rem;";
    heading.textContent = window.GOA_I18N ? window.GOA_I18N.t("advice","adviceInsights") : "Advice & Insights";
    containerEl.appendChild(heading);

    var colors = {
      danger:  { bg: "#fff0f0", border: "#e05252", color: "#8b1a1a" },
      warning: { bg: "#fff8e8", border: "#c9a961", color: "#6b4e10" },
      info:    { bg: "#edf4ff", border: "#4a7cc7", color: "#1a3a6b" },
      success: { bg: "#edf9f0", border: "#2c5240", color: "#1f3a2e" },
      tip:     { bg: "#f4f1e9", border: "#8a6b4f", color: "#3d2b15" },
      ebook:   { bg: "var(--paper)", border: "var(--soil-light)", color: "var(--ink)" },
    };

    advice.forEach(function (item) {
      if (item.type === "ebook") {
        // Render as the existing ebook CTA card
        var cta = document.createElement("div");
        cta.className = "calc-ebook-cta";
        var translate = window.GOA_I18N ? window.GOA_I18N.t : function (_section, key) { return key; };
        cta.innerHTML =
          "<h4>" + item.icon + " " + translate("calc", "ebookHeading") + "</h4>" +
          "<p>" + translate("calc", "ebookBody") + "</p>" +
          '<a class="btn btn-primary btn-sm" href="/ebooks/' + item.ebookSlug + '/"><span>' + translate("calc", "ebookCta") + "</span></a>";
        containerEl.appendChild(cta);
        return;
      }

      var c = colors[item.type] || colors.info;
      var block = document.createElement("div");
      block.style.cssText = "background:" + c.bg + ";border-left:4px solid " + c.border + ";border-radius:0 10px 10px 0;padding:14px 16px;margin-bottom:12px;";

      var h = document.createElement("div");
      h.style.cssText = "font-weight:700;color:" + c.color + ";margin-bottom:6px;font-size:0.95rem;";
      h.textContent = item.icon + " " + item.heading;
      block.appendChild(h);

      var p = document.createElement("p");
      p.style.cssText = "margin:0;font-size:0.88rem;color:var(--ink-soft);line-height:1.6;";
      p.textContent = item.body;
      block.appendChild(p);

      containerEl.appendChild(block);
    });
  }

  return { generateAdvice: generateAdvice, renderAdvice: renderAdvice };
})();
