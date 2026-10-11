#!/usr/bin/env node
"use strict";

// Combined agricultural data audit. This is intentionally report-only: known
// coverage gaps and duplicate groups are warnings for human review, not blockers.
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const EXPECTED = [
  ["DZ","Algeria"],["AO","Angola"],["BJ","Benin"],["BW","Botswana"],["BF","Burkina Faso"],
  ["BI","Burundi"],["CV","Cabo Verde"],["CM","Cameroon"],["CF","Central African Republic"],
  ["TD","Chad"],["KM","Comoros"],["CG","Republic of the Congo"],["CI","Côte d’Ivoire"],
  ["CD","Democratic Republic of the Congo"],["DJ","Djibouti"],["EG","Egypt"],["GQ","Equatorial Guinea"],
  ["ER","Eritrea"],["SZ","Eswatini"],["ET","Ethiopia"],["GA","Gabon"],["GM","Gambia"],
  ["GH","Ghana"],["GN","Guinea"],["GW","Guinea-Bissau"],["KE","Kenya"],["LS","Lesotho"],
  ["LR","Liberia"],["LY","Libya"],["MG","Madagascar"],["MW","Malawi"],["ML","Mali"],
  ["MR","Mauritania"],["MU","Mauritius"],["MA","Morocco"],["MZ","Mozambique"],["NA","Namibia"],
  ["NE","Niger"],["NG","Nigeria"],["RW","Rwanda"],["ST","São Tomé and Príncipe"],
  ["SN","Senegal"],["SC","Seychelles"],["SL","Sierra Leone"],["SO","Somalia"],
  ["ZA","South Africa"],["SS","South Sudan"],["SD","Sudan"],["TZ","Tanzania"],["TG","Togo"],
  ["TN","Tunisia"],["UG","Uganda"],["ZM","Zambia"],["ZW","Zimbabwe"]
];
const expectedCodes = new Set(EXPECTED.map(([code]) => code));
const arr = (v) => Array.isArray(v) ? v : [];
function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    if ((u.protocol === "https:" && u.port === "443") ||
        (u.protocol === "http:" && u.port === "80")) u.port = "";
    while (u.pathname.length > 1 && u.pathname.endsWith("/")) u.pathname = u.pathname.slice(0, -1);
    return u.toString().replace(/\/$/, u.pathname === "/" ? "/" : "");
  } catch (_) {
    return raw.split("#")[0].replace(/\/+$/, "").toLowerCase();
  }
}
function flattenResources(data) {
  if (Array.isArray(data.records)) return data.records;
  return arr(data.countries).flatMap((c) =>
    Object.entries(c.records || {}).flatMap(([category, records]) =>
      arr(records).map((r) => ({ ...r, country_code: r.country_code || c.code, category: r.category || category }))
    )
  );
}
function flattenNews(data) {
  if (Array.isArray(data.records)) return data.records;
  return arr(data.countries).flatMap((c) => arr(c.articles).map((a) => ({ ...a, country_code: a.country_code || c.code })));
}
function groupDuplicates(records) {
  const groups = new Map();
  for (const record of records) {
    const code = String(record.country_code || "").toUpperCase();
    const url = normalizeUrl(record.url);
    if (!expectedCodes.has(code) || !url) continue;
    const key = code + "\t" + url;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record.title || record.headline || "(untitled)");
  }
  return [...groups.entries()].filter(([, titles]) => titles.length > 1)
    .map(([key, titles]) => ({ country: key.split("\t")[0], url: key.split("\t")[1], titles }));
}
function overlapGroups(primary, supplement) {
  const keys = new Set(primary.map((r) => String(r.country_code || "").toUpperCase() + "\t" + normalizeUrl(r.url)).filter((k) => !k.endsWith("\t")));
  return supplement.filter((r) => {
    const key = String(r.country_code || "").toUpperCase() + "\t" + normalizeUrl(r.url);
    return !key.endsWith("\t") && keys.has(key);
  });
}
function counts(records) {
  const result = Object.fromEntries(EXPECTED.map(([code]) => [code, 0]));
  for (const r of records) {
    const code = String(r.country_code || "").toUpperCase();
    if (Object.hasOwn(result, code)) result[code]++;
  }
  return result;
}
const resourcePrimary = flattenResources(read("src/_data/agriculturalResources.json"));
const resourceSupplement = flattenResources(read("src/_data/agriculturalResourcesSupplement.json"));
const newsPrimary = flattenNews(read("src/_data/agriculturalNews.json"));
const newsSupplement = flattenNews(read("src/_data/agriculturalNewsSupplement.json"));
const resources = [...resourcePrimary, ...resourceSupplement];
const news = [...newsPrimary, ...newsSupplement];
const resourceDupes = groupDuplicates(resources);
const newsDupes = groupDuplicates(news);
const resourceOverlaps = overlapGroups(resourcePrimary, resourceSupplement);
const newsOverlaps = overlapGroups(newsPrimary, newsSupplement);
const resourceCounts = counts(resources);
const newsCounts = counts(news);
const resourceGaps = EXPECTED.filter(([c]) => !resourceCounts[c]).map(([,n]) => n);
const newsGaps = EXPECTED.filter(([c]) => !newsCounts[c]).map(([,n]) => n);

console.log("GoOrganicAfrica combined agriculture data audit (report-only)");
console.log(`Resources: ${resourcePrimary.length} primary + ${resourceSupplement.length} supplemental = ${resources.length} raw records`);
console.log(`News: ${newsPrimary.length} primary + ${newsSupplement.length} supplemental = ${news.length} raw records`);
console.log(`Resource same-country normalized duplicate groups: ${resourceDupes.length}; primary/supplement overlaps: ${resourceOverlaps.length}`);
console.log(`News same-country normalized duplicate groups: ${newsDupes.length}; primary/supplement overlaps: ${newsOverlaps.length}`);
console.log(`Countries with resources: ${EXPECTED.length - resourceGaps.length}/${EXPECTED.length}${resourceGaps.length ? " — gaps: " + resourceGaps.join(", ") : ""}`);
console.log(`Countries with news: ${EXPECTED.length - newsGaps.length}/${EXPECTED.length}${newsGaps.length ? " — gaps: " + newsGaps.join(", ") : ""}`);
for (const [label, groups] of [["RESOURCE DUPLICATES", resourceDupes], ["NEWS DUPLICATES", newsDupes]]) {
  if (!groups.length) continue;
  console.log("\n" + label + " (review before removing; some records may be distinct stories):");
  for (const g of groups) console.log(`- ${g.country} | ${g.url} | ${g.titles.join(" / ")}`);
}
if (resourceGaps.length || newsGaps.length || resourceDupes.length || newsDupes.length || resourceOverlaps.length || newsOverlaps.length) {
  console.log("\nReview needed. This script does not delete records or fail the build; regional applicability and story identity require editorial judgment.");
} else {
  console.log("\nNo coverage gaps, normalized same-country duplicate groups, or primary/supplement overlaps detected.");
}
