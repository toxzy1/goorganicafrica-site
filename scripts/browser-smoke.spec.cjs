const { test, expect } = require("@playwright/test");

const baseURL = process.env.GOA_PREVIEW_URL || "https://qa-decision-centre-search-fa.goorganicafrica-site.pages.dev";

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
  const homepageHead = homepageSource.match(/<head\\b[^>]*>([\\s\\S]*?)<\\/head>/i);
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
  const calculatorHead = calculatorSource.match(/<head\\b[^>]*>([\\s\\S]*?)<\\/head>/i);
  expect(calculatorHead, "calculator page should have a head element").not.toBeNull();
  expect(calculatorHead[1]).not.toContain("{{");
});
