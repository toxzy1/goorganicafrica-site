// Writes _site/build-info.json so the exact commit behind any deployment can be read
// (used by CI to wait for the Cloudflare preview to reach the commit under test).
// Must run AFTER eleventy, because eleventy rewrites _site.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
function gitSha() {
  try { return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (_) { return ''; }
}
const commit = process.env.CF_PAGES_COMMIT_SHA || process.env.WORKERS_CI_COMMIT_SHA || process.env.GITHUB_SHA || gitSha() || 'unknown';
const info = { commit, branch: process.env.CF_PAGES_BRANCH || process.env.WORKERS_CI_BRANCH || process.env.GITHUB_REF_NAME || '', builtAt: new Date().toISOString() };
fs.mkdirSync(path.join(__dirname, '..', '_site'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', '_site', 'build-info.json'), JSON.stringify(info) + '\n');
console.log(`Wrote _site/build-info.json (commit ${commit.slice(0, 7)})`);
