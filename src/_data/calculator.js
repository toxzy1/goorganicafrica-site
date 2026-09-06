const managedCountries = require('./calculatorCountries.json');
const regions = require('./calculator/regions.json');
const countries = (managedCountries.list || []).map((c) => ({
  code: c.code,
  name: c.name,
  currency_code: c.currency || c.currency_code,
  currency_symbol: c.symbol || c.currency_symbol,
  flag: c.flag || '',
  active: c.available !== false,
}));
module.exports = { countries, regions };
