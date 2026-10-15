module.exports = {
  testDir: "./scripts",
  testMatch: "browser-smoke.spec.cjs",
  timeout: 30000,
  expect: { timeout: 10000 },
  retries: 1,
  workers: 1,
  reporter: "list",
  use: { headless: true }
};
