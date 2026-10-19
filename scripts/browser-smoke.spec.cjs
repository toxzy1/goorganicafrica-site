const { test, expect } = require("@playwright/test");

const baseURL = process.env.GOA_PREVIEW_URL || "https://qa-decision-centre-search-fa.goorganicafrica-site.pages.dev";

test("Markets commodity names localize in all supported languages", async ({ page }) => {
  const expected = {
    en: ["Beans (Cowpea)", "Maize", "Rice (Paddy)"],
    fr: ["Haricot (niébé)", "Maïs", "Riz (paddy)"],
    ar: ["الفاصوليا (اللوبيا)", "الذرة", "الأرز (أرز شَلبي)"],
    pt: ["Feijão (feijão-frade)", "Milho", "Arroz (em casca)"],
    sw: ["Maharagwe (kunde)", "Mahindi", "Mpunga"]
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
