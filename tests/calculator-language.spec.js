const { test, expect } = require("@playwright/test");

const countries = ["ng", "gh", "et"];
const languages = ["fr", "ar", "pt", "sw", "en"];

for (const country of countries) {
  for (const language of languages) {
    test(`${country}: calculator language ${language} stays selected`, async ({ page }) => {
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));

      await page.goto(`/${country}/en/farm-profit-calculator/`, { waitUntil: "networkidle" });
      await page.locator("#calc-language-switcher").selectOption(language);
      await page.waitForTimeout(2000);

      await expect(page).toHaveURL(new RegExp(`/${country}/${language}/farm-profit-calculator/?$`));
      await expect(page.locator("html")).toHaveAttribute("lang", language);
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
    await page.waitForTimeout(2000);

    await expect(page).toHaveURL(/\/ng\/pt\/farm-profit-calculator\/?$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "pt");
    await context.close();
  });
}
