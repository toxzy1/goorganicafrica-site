const { test, expect } = require("@playwright/test");

const baseURL = process.env.GOA_PREVIEW_URL || "https://qa-decision-centre-search-fa.goorganicafrica-site.pages.dev";

test("Markets commodity names localize in all supported languages", async ({ page }) => {
  const expected = {
    en: ["Agricultural products", "Basic food commodities", "Beans (Cowpea) - Nambale", "Beef", "Cassava - Fresh", "Dry Maize", "Livestock", "Livestock and fish", "Local agricultural commodities", "Maize", "Matooke", "Milk", "Red Irish potato", "Rice (Paddy)", "Soybean", "Wheat"],
    fr: ["Produits agricoles", "Produits alimentaires de base", "Haricot (niébé)", "Bœuf", "Manioc", "Maïs", "Élevage", "Élevage et poisson", "Produits agricoles locaux", "Matooke (banane plantain verte)", "Lait", "Pomme de terre rouge irlandaise", "Riz (paddy)", "Soja", "Blé"],
    ar: ["المنتجات الزراعية", "السلع الغذائية الأساسية", "الفاصوليا (اللوبيا)", "لحم البقر", "الكسافا", "الذرة", "الثروة الحيوانية", "الثروة الحيوانية والأسماك", "السلع الزراعية المحلية", "ماتوكي (موز أخضر للطبخ)", "الحليب", "البطاطس الأيرلندية الحمراء", "الأرز (أرز شَلبي)", "فول الصويا", "القمح"],
    pt: ["Produtos agrícolas", "Produtos alimentares básicos", "Feijão (feijão-frade)", "Carne bovina", "Mandioca", "Milho", "Pecuária", "Pecuária e pescado", "Produtos agrícolas locais", "Matoke (banana-da-terra verde)", "Leite", "Batata irlandesa vermelha", "Arroz (em casca)", "Soja", "Trigo"],
    sw: ["Mazao ya kilimo", "Bidhaa za msingi za chakula", "Maharagwe (kunde)", "Nyama ya ng'ombe", "Muhogo", "Mahindi", "Mifugo", "Mifugo na samaki", "Mazao ya kilimo ya eneo husika", "Matoke (ndizi za kupika)", "Maziwa", "Viazi vyekundu vya aina ya Irish", "Mpunga", "Maharagwe ya soya", "Ngano"]
  };
  await page.goto(baseURL + "/markets/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#market-commodity")).toBeVisible({ timeout: 15000 });
  for (const [language, labels] of Object.entries(expected)) {
    if (language !== "en") {
      await page.locator("#site-language-select").selectOption(language);
      await expect(page.locator("html")).toHaveAttribute("lang", language);
    }
    const options = page.locator("#market-commodity");
    for (const label of labels) {
      await expect(options).toContainText(label);
    }
  }
});

test("Markets page translates data labels and explanatory copy across languages", async ({ page }) => {
  const cases = {
    en: { freshness: "Freshness:", sourceReference: "Source Reference", recent: "Recent", note: "Use the official market selector and observation period before quoting a price.", market: "National market coverage", dryMaize: "Dry Maize" },
    fr: { freshness: "Actualité :", sourceReference: "Référence de source", recent: "Récent", note: "Utilisez le sélecteur officiel de marché et la période d’observation avant de citer un prix.", market: "Couverture nationale du marché", dryMaize: "Maïs sec" },
    ar: { freshness: "حداثة البيانات:", sourceReference: "مرجع المصدر", recent: "حديث", note: "استخدم محدد السوق الرسمي وفترة الرصد قبل ذكر أي سعر.", market: "تغطية السوق الوطنية", dryMaize: "ذرة جافة" },
    pt: { freshness: "Atualidade:", sourceReference: "Referência da fonte", recent: "Recente", note: "Utilize o seletor oficial de mercado e o período de observação antes de citar um preço.", market: "Cobertura nacional do mercado", dryMaize: "Milho seco" },
    sw: { freshness: "Uhalisia wa muda:", sourceReference: "Rejea ya chanzo", recent: "Mpya", note: "Tumia kichaguzi rasmi cha soko na kipindi cha uchunguzi kabla ya kutaja bei.", market: "Ufunikaji wa soko la kitaifa", dryMaize: "Mahindi makavu" }
  };
  await page.goto(baseURL + "/markets/", { waitUntil: "domcontentloaded" });
  for (const [language, expected] of Object.entries(cases)) {
    if (language !== "en") {
      await page.locator("#site-language-select").selectOption(language);
      await expect(page.locator("html")).toHaveAttribute("lang", language);
    }
    await expect(page.locator(".market-card > div").first()).toContainText(expected.market);
    await expect(page.locator(".market-card p").filter({ has: page.locator('strong[data-i18n="markets.freshnessLabel"]') }).first()).toContainText(expected.freshness);
    await expect(page.locator("#market-freshness option[value='recent']")).toHaveText(expected.recent);
    if (language !== "en") {
      const freshnessRows = await page.locator(".market-card p")
        .filter({ has: page.locator('strong[data-i18n="markets.freshnessLabel"]') }).allTextContents();
      expect(freshnessRows.join(" ")).not.toMatch(/\bRecent\b|\bOlder\b|\bStale\b|\bSource Reference\b/);
      const priceTypes = await page.locator("#market-price-type option").allTextContents();
      for (const english of ["Farm-gate", "Farm gate", "Retail", "Wholesale", "Producer price", "Consumer price", "Market price", "Official benchmark"]) {
        if (priceTypes.some((label) => label.trim().toLowerCase() === english.toLowerCase())) {
          expect(priceTypes.map((label) => label.trim())).not.toContain(english);
        }
      }
    }
    const freshnessStatusRow = page.locator(".market-card p")
      .filter({ has: page.locator('strong[data-i18n="markets.freshnessLabel"]') })
      .filter({ hasText: expected.sourceReference }).first();
    await expect(freshnessStatusRow).toContainText(expected.sourceReference);
    await expect(page.locator(".market-card").filter({ hasText: expected.note }).first()).toContainText(expected.note);
    await expect(page.locator(".market-card h2").filter({ hasText: expected.dryMaize }).first()).toContainText(expected.dryMaize);
  }
});

test("Markets dates and connecting labels follow the selected language", async ({ page }) => {
  const expected = {
    en: { compared: "compared with", locale: "en-GB", tier: "Tier", verified: "Verified", international: "International" },
    fr: { compared: "comparé au", locale: "fr-FR", tier: "Niveau", verified: "Vérifié", international: "International" },
    ar: { compared: "مقارنةً بـ", locale: "ar", tier: "المستوى", verified: "تم التحقق", international: "دولي" },
    pt: { compared: "em comparação com", locale: "pt-PT", tier: "Nível", verified: "Verificado", international: "Internacional" },
    sw: { compared: "ikilinganishwa na", locale: "sw-TZ", tier: "Daraja", verified: "Imethibitishwa", international: "Kimataifa" }
  };
  await page.goto(baseURL + "/markets/", { waitUntil: "domcontentloaded" });
  const dates = page.locator("[data-market-date]");
  await expect(dates.first()).toBeVisible();
  for (const [language, labels] of Object.entries(expected)) {
    if (language !== "en") {
      await page.locator("#site-language-select").selectOption(language);
      await expect(page.locator("html")).toHaveAttribute("lang", language);
    }
    const compared = page.locator("[data-market-compared-label]");
    if (await compared.count()) await expect(compared.first()).toHaveText(labels.compared);

    const firstDate = dates.first();
    const expectedDate = await firstDate.evaluate((el, locale) => {
      const raw = el.getAttribute("data-market-date") || "";
      const match = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
      const date = match
        ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12))
        : new Date(raw);
      return Number.isNaN(date.getTime()) ? raw : new Intl.DateTimeFormat(locale, {
        day: "numeric", month: "short", year: "numeric", timeZone: "UTC"
      }).format(date);
    }, labels.locale);
    await expect(firstDate).toHaveText(expectedDate);

    const verifiedDate = page.locator(".market-card p")
      .filter({ has: page.locator('strong[data-i18n="markets.verifiedLabel"]') })
      .first().locator("[data-market-date]");
    if (await verifiedDate.count()) {
      const expectedVerifiedDate = await verifiedDate.evaluate((el, locale) => {
        const raw = el.getAttribute("data-market-date") || "";
        const match = raw.trim().match(/^(\\d{4})-(\\d{2})-(\\d{2})(?:$|T)/);
        const date = match
          ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12))
          : new Date(raw);
        return Number.isNaN(date.getTime()) ? raw : new Intl.DateTimeFormat(locale, {
          day: "numeric", month: "short", year: "numeric", timeZone: "UTC"
        }).format(date);
      }, labels.locale);
      await expect(verifiedDate).toHaveText(expectedVerifiedDate);
    }

    const internationalScope = page.locator('[data-market-scope-value="International"]');
    if (await internationalScope.count()) {
      await expect(internationalScope.first()).toHaveText(labels.international);
    }

    const tier = page.locator('[data-market-word="tier"]').first();
    if (await tier.count()) await expect(tier).toHaveText(labels.tier);
    const verified = page.locator('[data-market-word="verified"]').first();
    if (await verified.count()) await expect(verified).toHaveText(labels.verified);
  }
});

test("Markets indicator period month names follow the selected language", async ({ page }) => {
  await page.goto(baseURL + "/markets/", { waitUntil: "domcontentloaded" });
  const period = page.locator("[data-market-period]").first();
  await expect(period).toBeVisible({ timeout: 15000 });
  const original = (await period.getAttribute("data-market-period")) || "";
  test.skip(!/^(January|February|March|April|May|June|July|August|September|October|November|December)\\s+\\d{4}$/i.test(original.trim()),
    "No English month/year indicator period is available to verify on this fixture.");

  const englishMonths = /\\b(January|February|March|April|May|June|July|August|September|October|November|December)\\b/i;
  for (const language of ["fr", "ar", "pt", "sw"]) {
    await page.locator("#site-language-select").selectOption(language);
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    await expect(period).not.toContainText(englishMonths);
  }

  await page.locator("#site-language-select").selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(period).toHaveText(original);
});

test("mobile navigation can scroll to every page link on a short screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await page.goto(baseURL + "/", { waitUntil: "domcontentloaded" });

  const toggle = page.locator(".nav-toggle");
  const links = page.locator(".nav-links");
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(links).toHaveClass(/open/);
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(links).toHaveCSS("overflow-y", "auto");

  const lastLink = links.locator("a").last();
  await lastLink.scrollIntoViewIfNeeded();
  await expect(lastLink).toBeInViewport();
  expect(await links.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});

test("Global Search returns useful live results and a helpful no-results state", async ({ page }) => {
  await page.goto(baseURL + "/search/", { waitUntil: "domcontentloaded" });
  const input = page.locator("#goa-global-search");
  await expect(input).toBeVisible();
  await input.fill("farm loans");
  await expect(page.locator(".goa-search-card").first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".goa-search-card a").first()).toHaveAttribute("href", /.+/);

  await input.fill("rabbit farming ebook");
  await expect(page.locator(".goa-search-empty")).toBeVisible();
  await expect(page.locator(".goa-search-empty a[href*='ebooks']")).toBeVisible();
});

test("shared Search page preserves Portuguese selection without inventing a route", async ({ page }) => {
  await page.goto(baseURL + "/search/", { waitUntil: "domcontentloaded" });
  const before = new URL(page.url()).pathname;
  await page.locator("#site-language-select").selectOption("pt");
  await expect.poll(() => page.locator("html").getAttribute("lang")).toBe("pt");
  await expect(page.locator("#site-language-select")).toHaveValue("pt");
  expect(new URL(page.url()).pathname).toBe(before);
});

test("Decision Centre renders a country brief or an explicit fallback instead of staying blank", async ({ page }) => {
  await page.goto(baseURL + "/farmer-decision-centre/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#dc-country")).toBeVisible();
  await page.locator("#dc-country").selectOption("NG");
  await page.locator("#dc-topic").selectOption("poultry");
  await page.locator("#dc-build").click();
  await expect.poll(async () => (await page.locator("#dc-output").innerText()).trim().length).toBeGreaterThan(35);
  await expect(page.locator("#dc-output")).toContainText(/Nigeria|exact matches|records|information/i);
});

test("country-language farm calculator loads and keeps the selected country when changing language", async ({ page }) => {
  await page.goto(baseURL + "/ng/en/farm-profit-calculator/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#calc-country-switcher")).toBeVisible({ timeout: 15000 });
  await expect(page.locator("#calc-language-switcher")).toHaveValue("en");
  await expect(page.locator("#calc-root .calc-option-card").first()).toBeVisible({ timeout: 15000 });
  await page.locator("#calc-language-switcher").selectOption("pt");
  await expect(page).toHaveURL(/\/ng\/pt\/farm-profit-calculator\//, { timeout: 15000 });
  await expect(page.locator("html")).toHaveAttribute("lang", "pt");
  await expect(page.locator("#calc-country-switcher")).toBeVisible();
  await expect(page.locator("#calc-language-switcher")).toHaveValue("pt");
});

test("Nigeria agricultural-news page has content or a useful fallback, and language switch reaches Swahili route", async ({ page }) => {
  await page.goto(baseURL + "/agricultural-news/nigeria/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.locator("body")).toContainText(/Nigeria|habari|news|rasilimali/i);
  await page.locator("#site-language-select").selectOption("sw");
  await expect(page).toHaveURL(/\/sw\/agricultural-news\/nigeria\//, { timeout: 15000 });
  await expect(page.locator("html")).toHaveAttribute("lang", "sw");
});

test("country-news language selector reaches French, Arabic and Portuguese pages without falling back home", async ({ page }) => {
  for (const language of ["fr", "ar", "pt"]) {
    await page.goto(baseURL + "/agricultural-news/nigeria/", { waitUntil: "domcontentloaded" });
    await page.locator("#site-language-select").selectOption(language);
    await expect(page).toHaveURL(new RegExp("\\/" + language + "\\/agricultural-news\\/nigeria\\/"), { timeout: 15000 });
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    await expect(page.locator("h1").first()).toBeVisible();
    if (language === "ar") await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  }
});

test("homepage and Portuguese calculator expose computed SEO metadata", async ({ page }) => {
  await page.goto(baseURL + "/", { waitUntil: "domcontentloaded" });
  const homepageSource = await page.content();
  const homepageHead = homepageSource.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  expect(homepageHead, "homepage should have a head element").not.toBeNull();
  expect(homepageHead[1]).not.toContain("{{");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /across 17 farming enterprises in 54 African countries/
  );
  await expect(page.locator('body [data-i18n="home.directoryNote"]')).toHaveCount(0);

  await page.goto(baseURL + "/ng/pt/farm-profit-calculator/", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle("Calculadora gratuita de lucro agrícola — Nigeria | GoOrganicAfrica");
  const calculatorSource = await page.content();
  const calculatorHead = calculatorSource.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  expect(calculatorHead, "calculator page should have a head element").not.toBeNull();
  expect(calculatorHead[1]).not.toContain("{{");
});


test("homepage intelligence section is translated in French, Arabic, Portuguese and Swahili", async ({ page }) => {
  const cases = {
    fr: {
      eyebrow: "Intelligence agricole",
      title: "Explorer GoOrganicAfrica",
      cards: [
        ["Recherche globale", "Recherchez dans nos connaissances agricoles et nos répertoires d’informations."],
        ["Opportunités", "Trouvez des subventions, des financements, des programmes, des appels et des possibilités d’investissement."],
        ["Marchés", "Consultez des informations de marché vérifiées, des observations de prix et des tendances."],
        ["Services et machines", "Découvrez des machines, des fournisseurs, des formations, des événements et des services d’appui agricole."],
        ["Ressources", "Consultez des ressources sur le financement, les subventions, la recherche, les intrants, les machines et l’accompagnement des agriculteurs."],
        ["Actualités agricoles", "Suivez les évolutions agricoles vérifiées dans les pays africains."]
      ],
      free: "Gratuit"
    },
    ar: {
      eyebrow: "الذكاء الزراعي",
      title: "استكشف GoOrganicAfrica",
      cards: [
        ["البحث الشامل", "ابحث في معارفنا الزراعية وأدلة المعلومات."],
        ["الفرص", "اعثر على المنح والتمويل والبرامج والدعوات وفرص الاستثمار."],
        ["الأسواق", "استكشف معلومات السوق الموثوقة وملاحظات الأسعار واتجاهات السوق."],
        ["الخدمات والآلات", "اكتشف الآلات والموردين والتدريب والفعاليات وخدمات دعم الزراعة."],
        ["الموارد", "تصفح موارد التمويل والمنح والبحوث والمدخلات والآلات ودعم المزارعين."],
        ["الأخبار الزراعية", "تابع التطورات الزراعية الموثوقة في البلدان الأفريقية."]
      ],
      free: "مجاني"
    },
    pt: {
      eyebrow: "Inteligência agrícola",
      title: "Explore a GoOrganicAfrica",
      cards: [
        ["Pesquisa global", "Pesquise no nosso conhecimento agrícola e nos diretórios de informação."],
        ["Oportunidades", "Encontre subsídios, financiamento, programas, candidaturas e oportunidades de investimento."],
        ["Mercados", "Explore informações de mercado verificadas, observações de preços e tendências."],
        ["Serviços e maquinaria", "Descubra maquinaria, fornecedores, formação, eventos e serviços de apoio agrícola."],
        ["Recursos", "Consulte recursos sobre financiamento, subsídios, investigação, insumos, maquinaria e apoio aos agricultores."],
        ["Notícias agrícolas", "Acompanhe desenvolvimentos agrícolas verificados em países africanos."]
      ],
      free: "Grátis"
    },
    sw: {
      eyebrow: "Akili za kilimo",
      title: "Gundua GoOrganicAfrica",
      cards: [
        ["Utafutaji wa jumla", "Tafuta katika maarifa yetu ya kilimo na saraka za taarifa."],
        ["Fursa", "Pata ruzuku, ufadhili, programu, matangazo ya maombi na fursa za uwekezaji."],
        ["Masoko", "Chunguza taarifa za soko zilizothibitishwa, uchunguzi wa bei na mwenendo wa soko."],
        ["Huduma na mashine", "Gundua mashine, wasambazaji, mafunzo, matukio na huduma za msaada wa kilimo."],
        ["Rasilimali", "Vinjari rasilimali za fedha, ruzuku, utafiti, pembejeo, mashine na msaada kwa wakulima."],
        ["Habari za kilimo", "Fuatilia maendeleo ya kilimo yaliyothibitishwa katika nchi za Afrika."]
      ],
      free: "Bure"
    }
  };

  for (const [language, expected] of Object.entries(cases)) {
    await page.goto(baseURL + "/" + language + "/", { waitUntil: "domcontentloaded" });
    const section = page.locator('[data-i18n="home.intelligenceEyebrow"]').locator("xpath=ancestor::section[1]");
    await expect(section.locator('[data-i18n="home.intelligenceEyebrow"]')).toHaveText(expected.eyebrow, { timeout: 15000 });
    await expect(section.locator('[data-i18n="home.exploreTitle"]')).toHaveText(expected.title);
    const cards = section.locator(".category-card");
    await expect(cards).toHaveCount(6);
    for (let index = 0; index < expected.cards.length; index++) {
      await expect(cards.nth(index).locator("h3")).toHaveText(expected.cards[index][0]);
      await expect(cards.nth(index).locator("p")).toHaveText(expected.cards[index][1]);
    }
    await expect(section).not.toContainText("Agricultural Intelligence");
    await expect(section).not.toContainText("Global Search");
    await expect(page.locator('[data-i18n="home.freeValue"]')).toHaveText(expected.free);
  }
});
