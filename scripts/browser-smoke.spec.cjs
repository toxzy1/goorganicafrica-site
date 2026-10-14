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

test("Nigeria agricultural-news page has content or a useful fallback, and language switch reaches Swahili route", async ({ page }) => {
  await page.goto(baseURL + "/agricultural-news/nigeria/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.locator("body")).toContainText(/Nigeria|habari|news|rasilimali/i);
  await page.locator("#site-language-select").selectOption("sw");
  await expect(page).toHaveURL(/\/sw\/agricultural-news\/nigeria\//, { timeout: 15000 });
  await expect(page.locator("html")).toHaveAttribute("lang", "sw");
});
