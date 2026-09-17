window.FarmAdviceEngine = (function () {
  "use strict";

  function fmt(n, sym) {
    if (!n && n !== 0) return "—";
    return (sym || "₦") + Math.round(n).toLocaleString();
  }

  function T(section, key, vars, fallback) {
    if (window.GOA_I18N && window.GOA_I18N.t) {
      return window.GOA_I18N.t(section, key, vars);
    }
    return fallback || key;
  }

  function generateAdvice(result, commodity, countryData, currency) {
    var advice = [];
    var sym = currency || "₦";

    /*
     * CMS-MANAGED ADVICE
     * Future advice/recommendations entered through the CMS
     * continue to work without changing this JavaScript.
     */
    var configuredAdvice =
      Array.isArray(commodity.advice) ? commodity.advice : [];

    var configuredRecommendations =
      Array.isArray(commodity.recommendations)
        ? commodity.recommendations
        : [];

    if (
      countryData &&
      Array.isArray(countryData.recommendations)
    ) {
      configuredRecommendations =
        configuredRecommendations.concat(countryData.recommendations);
    }

    configuredAdvice.forEach(function (item) {
      if (item && item.heading && item.body) {
        advice.push({
          type: item.type || "tip",
          icon: item.icon || "💡",
          heading: item.heading,
          body: item.body
        });
      }
    });

    configuredRecommendations.forEach(function (text) {
      if (text) {
        advice.push({
          type: "tip",
          icon: "💡",
          heading: T(
            "advice",
            "practicalRecommendation",
            null,
            "Practical recommendation"
          ),
          body: String(text)
        });
      }
    });

    /*
     * BUILT-IN MULTILINGUAL PROFITABILITY ADVICE
     */
    var roi = result.roi;
    var profit = result.profit;

    if (roi === null) {
      advice.push({
        type: "info",
        icon: "📊",
        heading: T(
          "calc",
          "profitability",
          null,
          "Profitability Assessment"
        ),
        body: T(
          "analysis",
          "roiUnavailable",
          null,
          "Unable to calculate ROI. Check your cost and price entries."
        )
      });
    } else if (profit < 0) {
      advice.push({
        type: "danger",
        icon: "⚠️",
        heading: T(
          "advice",
          "loss",
          null,
          "This enterprise is showing a loss"
        ),
        body: T(
          "analysis",
          "loss",
          {
            amount: fmt(Math.abs(profit), sym),
            roi: Math.abs(roi).toFixed(1)
          },
          "Your projected costs exceed your projected revenue."
        )
      });
    } else if (roi < 20) {
      advice.push({
        type: "warning",
        icon: "📉",
        heading: T(
          "advice",
          "thin",
          null,
          "Thin margin — this enterprise carries risk"
        ),
        body: T(
          "analysis",
          "thin",
          { roi: roi.toFixed(1) },
          "The projected margin is relatively thin."
        )
      });
    } else if (roi < 60) {
      advice.push({
        type: "info",
        icon: "✅",
        heading: T(
          "advice",
          "reasonable",
          null,
          "Reasonable profit — but watch these risks"
        ),
        body: T(
          "analysis",
          "reasonable",
          { roi: roi.toFixed(1) },
          "This is a reasonable projected return."
        )
      });
    } else {
      advice.push({
        type: "success",
        icon: "🌱",
        heading: T(
          "advice",
          "strong",
          null,
          "Strong projected profit"
        ),
        body: T(
          "analysis",
          "strong",
          { roi: roi.toFixed(1) },
          "This enterprise has a strong projected return."
        )
      });
    }

    /*
     * BREAK-EVEN ADVICE
     */
    if (
      result.breakEvenPrice !== null &&
      countryData
    ) {
      var low = countryData.price_low;

      if (low) {
        var vars = {
          price: fmt(result.breakEvenPrice, sym),
          unit: countryData.price_unit || "",
          low: fmt(low, sym)
        };

        var key =
          result.breakEvenPrice > low * 0.9
            ? "breakEvenLow"
            : "breakEvenBuffer";

        advice.push({
          type: "warning",
          icon: "⚖️",
          heading: T(
            "advice",
            "breakEvenClose",
            null,
            "Break-even analysis"
          ),
          body: T(
            "analysis",
            key,
            vars,
            "Review your break-even selling price against the reference market price."
          )
        });
      }
    }

    /*
     * MULTILINGUAL NEXT-STEP ADVICE
     */
    [
      "next1",
      "next2",
      "next3"
    ].forEach(function (key) {
      var text = T("analysis", key, null, "");

      if (text) {
        advice.push({
          type: "tip",
          icon: "💡",
          heading: T(
            "advice",
            "practicalRecommendation",
            null,
            "Practical recommendation"
          ),
          body: text
        });
      }
    });

    /*
     * RELATED EBOOK
     */
    if (commodity.related_ebook_slug) {
      advice.push({
        type: "ebook",
        icon: "📗",
        heading: T(
          "advice",
          "deeper",
          null,
          "Want to go deeper?"
        ),
        body: null,
        ebookSlug: commodity.related_ebook_slug
      });
    }

    return advice;
  }

  function renderAdvice(containerEl, advice) {
    if (!advice || !advice.length) return;

    var heading = document.createElement("h3");

    heading.style.cssText =
      "font-family:var(--font-display);" +
      "color:var(--green-deep);" +
      "margin:28px 0 16px;" +
      "font-size:1.2rem;";

    heading.textContent =
      T(
        "advice",
        "adviceInsights",
        null,
        "Advice & Insights"
      );

    containerEl.appendChild(heading);

    var colors = {
      danger: {
        bg: "#fff0f0",
        border: "#e05252",
        color: "#8b1a1a"
      },
      warning: {
        bg: "#fff8e8",
        border: "#c9a961",
        color: "#6b4e10"
      },
      info: {
        bg: "#edf4ff",
        border: "#4a7cc7",
        color: "#1a3a6b"
      },
      success: {
        bg: "#edf9f0",
        border: "#2c5240",
        color: "#1f3a2e"
      },
      tip: {
        bg: "#f4f1e9",
        border: "#8a6b4f",
        color: "#3d2b15"
      },
      ebook: {
        bg: "var(--paper)",
        border: "var(--soil-light)",
        color: "var(--ink)"
      }
    };

    advice.forEach(function (item) {

      if (item.type === "ebook") {
        var cta = document.createElement("div");
        cta.className = "calc-ebook-cta";

        cta.innerHTML =
          "<h4>" +
          item.icon +
          " " +
          T(
            "advice",
            "deeper",
            null,
            "Want to go deeper?"
          ) +
          "</h4>" +

          "<p>" +
          T(
            "advice",
            "completeGuide",
            null,
            "Get the complete step-by-step guide."
          ) +
          "</p>" +

          '<a class="btn btn-primary btn-sm" href="/ebooks/' +
          item.ebookSlug +
          '/"><span>' +
          T(
            "advice",
            "completeGuide",
            null,
            "Get the Complete Guide"
          ) +
          "</span></a>";

        containerEl.appendChild(cta);
        return;
      }

      var c = colors[item.type] || colors.info;

      var block = document.createElement("div");

      block.style.cssText =
        "background:" +
        c.bg +
        ";border-left:4px solid " +
        c.border +
        ";border-radius:0 10px 10px 0;" +
        "padding:14px 16px;margin-bottom:12px;";

      var h = document.createElement("div");

      h.style.cssText =
        "font-weight:700;color:" +
        c.color +
        ";margin-bottom:6px;font-size:0.95rem;";

      h.textContent =
        item.icon + " " + item.heading;

      block.appendChild(h);

      var p = document.createElement("p");

      p.style.cssText =
        "margin:0;font-size:0.88rem;" +
        "color:var(--ink-soft);line-height:1.7;" +
        "word-spacing:0.04em;";

      p.textContent = item.body;

      block.appendChild(p);
      containerEl.appendChild(block);
    });
  }

  return {
    generateAdvice: generateAdvice,
    renderAdvice: renderAdvice
  };
})();
