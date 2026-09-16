const countries = require('./calculatorCountries.json').list || [];
const languages = require('./siteLanguages.json').languages || [];

module.exports = countries
  .filter(c => c.available !== false)
  .flatMap(c => languages.filter(l => l.enabled !== false).map(l => ({
    country: c,
    language: l,
    countryCode: c.code,
    languageCode: l.code
  })));
