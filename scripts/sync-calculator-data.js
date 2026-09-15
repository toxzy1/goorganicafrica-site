#!/usr/bin/env node
/**
 * Rebuild the compatibility aggregate from the editable per-enterprise files.
 * The admin panel edits individual files; this script keeps calculatorData.json
 * synchronized automatically before every Eleventy build.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dir = path.join(root, 'src/_data/calculator/commodities');
const output = path.join(root, 'src/_data/calculatorData.json');

const files = fs.readdirSync(dir)
  .filter((name) => name.toLowerCase().endsWith('.json'))
  .sort();

const commodities = files.map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')));
const ids = new Set();
for (const item of commodities) {
  if (!item.id || ids.has(item.id)) throw new Error(`Duplicate or missing enterprise ID: ${item.id || name}`);
  ids.add(item.id);
}

fs.writeFileSync(output, JSON.stringify({ commodities }, null, 2) + '\n');
console.log(`Synchronized ${commodities.length} calculator enterprises into ${path.relative(root, output)}`);
