window.FarmAdviceEngine = (function () {

  function fmt(n, sym) {
    if (!n && n !== 0) return "—";
    return (sym || "₦") + Math.round(n).toLocaleString();
  }

  /**
   * Generate contextual advice blocks based on calculation results.
   * Returns an array of {type, icon, heading, body} objects.
   */
  function generateAdvice(result, commodity, countryData, currency) {
    var advice = [];
    var sym = currency || "₦";
    var roi = result.roi;
    var profit = result.profit;
    var totalCost = result.totalCost;
    var totalRevenue = result.totalRevenue;
    var breakEvenPrice = result.breakEvenPrice;
    var profitPerUnit = result.profitPerUnit;
    var mode = commodity.unit_mode;
    var name = commodity.name;

    // 0. DATA-DRIVEN ADVICE: new crops/livestock can supply recommendations
    // through CMS-managed enterprise fields without changing this JavaScript.
    var configuredAdvice = Array.isArray(commodity.advice) ? commodity.advice : [];
    var configuredRecommendations = Array.isArray(commodity.recommendations) ? commodity.recommendations : [];
    if (countryData && Array.isArray(countryData.recommendations)) {
      configuredRecommendations = configuredRecommendations.concat(countryData.recommendations);
    }
    configuredAdvice.forEach(function (item) {
      if (item && item.heading && item.body) advice.push({
        type: item.type || "tip", icon: item.icon || "💡", heading: item.heading, body: item.body
      });
    });
    configuredRecommendations.forEach(function (text) {
      if (text) advice.push({type:"tip", icon:"💡", heading:"Practical recommendation", body:String(text)});
    });

    // 1. PROFIT/LOSS SUMMARY ADVICE
    if (profit < 0) {
      advice.push({
        type: "danger",
        icon: "⚠️",
        heading: "This enterprise is showing a loss",
        body: "Your projected costs (" + fmt(totalCost, sym) + ") exceed your projected revenue (" + fmt(totalRevenue, sym) + "). " +
              "Before committing funds, review three key levers: " +
              "(1) Can you reduce your input costs — especially labour, fertilizer and any hired equipment? " +
              "(2) Can you achieve a higher yield through better seed variety, soil preparation or management? " +
              "(3) Can you access a better market — direct hotel/restaurant sales or urban markets usually pay more than local middlemen. " +
              "Running a loss-making enterprise at scale will deplete your capital quickly."
      });
    } else if (roi !== null && roi < 20) {
      advice.push({
        type: "warning",
        icon: "📉",
        heading: "Thin margin — this enterprise carries risk",
        body: "An ROI of " + roi.toFixed(1) + "% is low for agriculture, where input prices and yields are variable. " +
              "A 10–15% drop in your selling price, or a 10% yield shortfall, could wipe out your profit entirely. " +
              "Consider whether you can negotiate better input prices in bulk, reduce hired labour costs, or sell directly to end buyers rather than market middlemen."
      });
    } else if (roi !== null && roi >= 20 && roi < 60) {
      advice.push({
        type: "info",
        icon: "✅",
        heading: "Reasonable profit — but watch these risks",
        body: "An ROI of " + roi.toFixed(1) + "% is a solid return if your inputs and selling price hold. " +
              "Key risks to monitor: (1) Seasonal gluts — prices for " + name + " can fall sharply at peak harvest season when many farmers sell at once. " +
              "Consider staggered planting to spread harvest timing. " +
              "(2) Input cost inflation — fertilizer and labour costs in Nigeria have risen significantly. Build a 10–15% cost buffer into your planning."
      });
    } else if (roi !== null && roi >= 60) {
      advice.push({
        type: "success",
        icon: "🌱",
        heading: "Strong projected profit",
        body: "An ROI of " + roi.toFixed(1) + "% is excellent. To protect this: " +
              "(1) Don't scale up too fast — confirm these results on a small plot first before investing heavily. " +
              "(2) Lock in buyers before harvest if possible — off-taker agreements with restaurants, processors or exporters reduce price uncertainty. " +
              "(3) Keep detailed cost records so you can compare your actual costs against these estimates."
      });
    }

    // 2. BREAK-EVEN ADVICE
    if (breakEvenPrice !== null && countryData) {
      var refLow = mode === "crop" ? countryData.price_low : countryData.price_low;
      if (refLow && breakEvenPrice > refLow * 0.85) {
        advice.push({
          type: "warning",
          icon: "📊",
          heading: "Your break-even price is close to the market floor",
          body: "Your break-even selling price is " + fmt(breakEvenPrice, sym) + ". " +
                "The reference low-end market price for " + name + " is around " + fmt(refLow, sym) + ". " +
                "If prices fall to their seasonal low, you may struggle to break even. " +
                "Either reduce your cost of production or target premium buyers (hotels, supermarkets, processors) who pay above farm-gate prices."
        });
      }
    }

    // 3. CROP-SPECIFIC ADVICE
    if (commodity.id === "tomato") {
      advice.push({
        type: "tip",
        icon: "🍅",
        heading: "Tomato farming tip",
        body: "Tomato prices in Nigeria are highly seasonal — they crash during flush harvest periods (March–May and August–October) and peak in the dry season. " +
              "Consider dry-season (harmattan) production using irrigation, when prices are typically higher and fewer farmers are producing. " +
              "Post-harvest losses are also a major profit killer — invest in quick transport to urban markets or small-scale processing (tomato paste/puree) to avoid waste."
      });
    } else if (commodity.id === "cucumber") {
      advice.push({
        type: "tip",
        icon: "🥒",
        heading: "Cucumber farming tip",
        body: "Cucumbers grow fast (35–50 days to first harvest) and can yield multiple harvests from one planting. " +
              "Proper staking with trellis netting keeps fruits off the ground, reduces disease, and improves quality and marketability. " +
              "Target urban supermarkets, hotels and restaurants — they pay a premium for clean, well-sized cucumbers over open-market buyers."
      });
    } else if (commodity.id === "cassava") {
      advice.push({
        type: "tip",
        icon: "🍠",
        heading: "Cassava farming tip",
        body: "Cassava's main profit lever is value addition — fresh roots sell for much less than processed garri, starch, or cassava flour. " +
              "If you are producing at scale, consider partnering with a processor or investing in a simple garri processing setup. " +
              "Weed management in the first 3 months is critical — poor weeding at this stage is the single biggest yield killer in cassava."
      });
    } else if (commodity.id === "maize") {
      advice.push({
        type: "tip",
        icon: "🌽",
        heading: "Maize farming tip",
        body: "Maize prices in Nigeria peak in the dry season (November–March) when stocks run low. " +
              "Farmers who can store their harvest (even in simple hermetic bags) for 2–3 months after harvest typically earn significantly more than those who sell immediately at harvest glut prices. " +
              "Proper storage is one of the highest-ROI investments in maize farming."
      });
    } else if (commodity.id === "rice") {
      advice.push({
        type: "tip",
        icon: "🌾",
        heading: "Rice farming tip",
        body: "Paddy rice must be milled before sale to consumers, which reduces your raw weight but increases your selling price significantly. " +
              "If you sell as paddy (unprocessed), your price per kg will be much lower than the milled rice retail price. " +
              "Consider pooling with neighbouring farmers to access a shared mill and sell directly to traders or retailers for better margins."
      });
    } else if (commodity.id === "habanero") {
      advice.push({
        type: "tip",
        icon: "\ud83c\udf36\ufe0f",
        heading: "Habanero pepper farming tip",
        body: "Habanero (ata rodo / scotch bonnet) commands the highest price per kg of any pepper in Nigeria and has strong export potential. " +
              "The biggest yield gap is between conventional open-field farmers (~2 tonnes/ha) and those using drip irrigation with hybrid seeds and good soil preparation (9-15 tonnes/ha). " +
              "Soil testing before planting, chicken manure as the base amendment, and consistent irrigation during fruit set are the three most impactful practices. " +
              "For export or premium buyers, dry-season production commands even higher prices. " +
              "Consider connecting with agro-exporters through the Mile 12 Market network to access buyers paying above local market rates."
      });
    } else if (commodity.id === "broiler") {
      advice.push({
        type: "tip",
        icon: "🐔",
        heading: "Broiler farming tip",
        body: "Feed accounts for 60–70% of your total broiler production cost. " +
              "Introducing hydroponic fodder as a partial feed supplement (up to 15–20% of ration) can meaningfully reduce your feed bill while maintaining or improving bird performance. " +
              "Also ensure your flock is sold at 6–7 weeks — holding broilers beyond 8 weeks increases feed cost faster than the birds add useful weight."
      });
    } else if (commodity.id === "layer") {
      advice.push({
        type: "tip",
        icon: "🥚",
        heading: "Layer farming tip",
        body: "Your break-even depends heavily on maintaining close to the expected egg output per bird. " +
              "Nutrition, lighting (14–16 hours/day) and flock health are the biggest drivers of egg production rate. " +
              "Sell eggs as frequently as possible — storing large quantities exposes you to breakage losses and quality deterioration. " +
              "Direct sales to schools, restaurants and estates eliminate the middleman and improve your per-crate margin."
      });
    } else if (commodity.id === "fish") {
      advice.push({
        type: "tip",
        icon: "🐟",
        heading: "Catfish farming tip",
        body: "Feed is your biggest cost (typically 70%+ of production cost). " +
              "Ensuring accurate feeding (avoid overfeeding — it pollutes water and wastes feed) and managing water quality closely will protect both survival rate and growth rate. " +
              "Harvesting at 1–1.2kg live weight hits the sweet spot for Nigerian markets — beyond that, feed conversion efficiency declines. " +
              "Black soldier fly (BSF) larvae as a feed supplement can cut feed costs significantly."
      });
    } else if (commodity.id === "pig") {
      advice.push({
        type: "tip",
        icon: "🐷",
        heading: "Pig farming tip",
        body: "Pig growth rate is highly dependent on consistent, quality feeding. " +
              "Substituting part of your commercial feed with kitchen/market waste, cassava peels, or BSF larvae can reduce your feed cost by 20–40%. " +
              "Target the festive season (Christmas, Eid) for selling — live pig prices typically peak sharply in December in Nigeria."
      });
    } else if (commodity.id === "cattle") {
      advice.push({
        type: "tip",
        icon: "🐄",
        heading: "Cattle fattening tip",
        body: "Cattle fattening profit is very sensitive to the price you pay for store cattle. " +
              "Buying thin cattle at the right time (end of dry season when prices are lower) and fattening through the rains (when grazing and supplements are cheaper) is the classic West African fattening strategy. " +
              "Supplementing with hydroponic fodder or crop residues alongside concentrates is one of the most cost-effective ways to improve daily weight gain."
      });
    } else if (commodity.id === "goat") {
      advice.push({
        type: "tip",
        icon: "🐐",
        heading: "Goat farming tip",
        body: "Goats are hardy and adaptable, but their biggest profit driver is timing of sales. " +
              "Eid-el-Kabir (Sallah) creates the single biggest demand spike for goats in Nigeria — mature bucks can fetch double their off-season price at this period. " +
              "Plan your production cycle so animals reach market weight just before peak demand."
      });
    }

    // 4. EBOOK CROSS-SELL (if related)
    if (commodity.related_ebook_slug) {
      advice.push({
        type: "ebook",
        icon: "📗",
        heading: "Go deeper with the complete guide",
        body: null,
        ebookSlug: commodity.related_ebook_slug
      });
    }

    return advice;
  }

  /**
   * Render advice blocks into a container element.
   */
  function renderAdvice(containerEl, advice, ebookUrl) {
    if (!advice || !advice.length) return;

    var heading = document.createElement("h3");
    heading.style.cssText = "font-family:var(--font-display);color:var(--green-deep);margin:28px 0 16px;font-size:1.2rem;";
    heading.textContent = "Advice & Insights";
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
        cta.innerHTML =
          "<h4>" + item.icon + " Want to go deeper?</h4>" +
          "<p>Get the complete step-by-step guide for this enterprise — written from real research and farm experience.</p>" +
          '<a class="btn btn-primary btn-sm" href="/ebooks/' + item.ebookSlug + '/">Get the Complete Guide</a>';
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
