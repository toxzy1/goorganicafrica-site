const { test, expect } = require("@playwright/test");

const countries = ["ng", "gh", "et"];
const languages = ["fr", "ar", "pt", "sw", "en"];

for (const country of countries) {
  for (const language of languages) {
    test(`${country}: calculator ${language} route loads with working language controls`, async ({ page }) => {
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));

      await page.goto(`/${country}/${language}/farm-profit-calculator/`, { waitUntil: "networkidle" });
      await expect(page).toHaveURL(new RegExp(`/${country}/${language}/farm-profit-calculator/?$`));
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      await expect(page.locator("#calc-language-switcher")).toHaveCount(1);
      await expect(page.locator("#calc-country-switcher")).toHaveCount(1);
      await expect(page.locator("#calc-root .calc-action-bar .btn-primary")).toHaveCount(1);
      expect(errors).toEqual([]);
    });
  }
}

for (const storedLanguage of ["en", "pt"]) {
  test(`NG: URL language wins over stored language ${storedLanguage}`, async ({ browser }) => {
    const context = await browser.newContext();
    await context.addInitScript(language => localStorage.setItem("goa_language", language), storedLanguage);
    const page = await context.newPage();

    await page.goto("/ng/pt/farm-profit-calculator/", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/ng\/pt\/farm-profit-calculator\/?$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "pt");
    await expect(page.locator("#calc-language-switcher")).toHaveValue("pt");
    await context.close();
  });
}

test("NG: calculator language selector changes the URL language without breaking the app", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  await page.goto("/ng/en/farm-profit-calculator/", { waitUntil: "networkidle" });
  await page.locator("#calc-language-switcher").selectOption("pt");
  await page.waitForURL(/\/ng\/pt\/farm-profit-calculator\/?$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "pt");
  await expect(page.locator("#calc-language-switcher")).toHaveValue("pt");
  await expect(page.locator("#calc-root .calc-action-bar .btn-primary")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("NG: calculator reaches the complete final results page", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  await page.goto("/ng/en/farm-profit-calculator/", { waitUntil: "networkidle" });

  // Country -> region.
  await page.locator("#calc-root .calc-action-bar .btn-primary").click();
  // Region -> farming type.
  await page.locator("#calc-root .calc-action-bar .btn-primary").click();

  // Choose the first available crop and continue.
  await page.locator("#calc-root .calc-option-card:not(.disabled)").first().click();
  await page.locator("#calc-root .calc-action-bar .btn-primary").click();

  // Choose the first available commodity and continue.
  await page.locator("#calc-root .calc-option-card:not(.disabled)").first().click();
  await page.locator("#calc-root .calc-action-bar .btn-primary").click();

  // Enter farm size and continue.
  const sizeInput = page.locator("#calc-root .calc-input").first();
  await sizeInput.fill("1");
  await page.locator("#calc-root .calc-action-bar .btn-primary").click();

  // Yield -> price -> costs.
  await page.locator("#calc-root .calc-action-bar .btn-primary").click();
  await page.locator("#calc-root .calc-action-bar .btn-primary").click();
  await page.getByRole("button", { name: /calculate profit/i }).click();

  await expect(page.locator(".calc-hero-result")).toBeVisible();
  await expect(page.locator(".calc-result-grid")).toBeVisible();
  await expect(page.locator(".calc-disclaimer")).toBeVisible();
  await expect(page.getByRole("button", { name: /start new|new calculation/i })).toBeVisible();
  await expect(page.locator("#calc-root a.btn-outline").filter({ hasText: /home/i })).toBeVisible();
  expect(errors).toEqual([]);
});


test("Homepage: language selector switches to a language-specific homepage", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator("#site-language-select")).toHaveCount(1);
  await page.locator("#site-language-select").selectOption("pt");
  await page.waitForURL(/\/pt\/?$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "pt");
  await expect(page.locator("#site-language-select")).toHaveValue("pt");
  expect(errors).toEqual([]);
});

for (const section of ["blog", "ebooks"]) {
  for (const language of ["en", "fr", "ar", "pt", "sw"]) {
    test(`${section}: ${language} page has no global language selector`, async ({ page }) => {
      const prefix = language === "en" ? "" : "/" + language;
      await page.goto(prefix + "/" + section + "/", { waitUntil: "networkidle" });
      await expect(page.locator("#site-language-select")).toHaveCount(0);
    });
  }
}
