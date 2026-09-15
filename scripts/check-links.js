const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const siteDir = path.join(root, '_site');
if (!fs.existsSync(siteDir)) throw new Error('Build output _site is missing. Run npm run build first.');

const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else files.push(full);
  }
}
walk(siteDir);

function fileExists(p) {
  try { return fs.existsSync(p) && fs.statSync(p).isFile(); } catch (_) { return false; }
}

function targetExists(raw, sourceFile) {
  if (!raw || raw.startsWith('#') || /^(mailto:|tel:|javascript:|data:|blob:)/i.test(raw)) return true;
  let value = raw.trim();
  if (/^(https?:)?\/\//i.test(value)) return true; // external URLs are not checked here
  value = value.split('#')[0].split('?')[0];
  if (!value) return true;

  // Site-root absolute paths map directly into _site.
  if (value.startsWith('/')) {
    const clean = decodeURIComponent(value).replace(/^\/+/, '');
    if (!clean) return fileExists(path.join(siteDir, 'index.html'));
    return [
      path.join(siteDir, clean),
      path.join(siteDir, clean, 'index.html'),
    ].some(fileExists);
  }

  // Relative links are resolved from the built HTML file's directory.
  const sourceDir = path.dirname(sourceFile);
  const resolved = path.normalize(path.join(sourceDir, decodeURIComponent(value)));
  const relativeToSite = path.relative(siteDir, resolved);
  if (relativeToSite.startsWith('..') || path.isAbsolute(relativeToSite)) return false;
  return [resolved, path.join(resolved, 'index.html')].some(fileExists);
}

const attrRe = /(?:href|src)\s*=\s*["']([^"']+)["']/gi;
const errors = [];
for (const file of files.filter(f => /\.(html|xml|txt)$/i.test(f))) {
  const text = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = attrRe.exec(text))) {
    const target = m[1];
    if (!targetExists(target, file)) errors.push(`${path.relative(siteDir, file)} -> ${target}`);
  }
}
if (errors.length) {
  console.error('Broken internal links/assets detected:');
  errors.slice(0, 100).forEach(e => console.error(' - ' + e));
  if (errors.length > 100) console.error(` - ...and ${errors.length - 100} more`);
  process.exit(1);
}
console.log(`Internal link check passed: ${files.length} built files scanned.`);
