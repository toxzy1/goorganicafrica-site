const managedCountries = require('./calculatorCountries.json');
const regionsSource = require('./calculator/regions.json');

const countries = (managedCountries.list || []).map((c) => ({
  code: c.code,
  name: c.name,
  slug: c.slug || c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  currency_code: c.currency || c.currency_code,
  currency_symbol: c.symbol || c.currency_symbol,
  flag: c.flag || '',
  active: c.available !== false,
  default_language: c.default_language || 'en',
  source_profile: c.source_profile || `${String(c.code).toLowerCase()}-ag-data`
}));

const regions = Array.isArray(regionsSource.regions)
  ? Object.fromEntries(regionsSource.regions.map((r) => [r.country_code, r.regions || []]))
  : regionsSource;

module.exports = { countries, regions };
