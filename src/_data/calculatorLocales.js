const countries = require('./calculatorCountries.json').list || [];
const languages = require('./languages.json').languages || [];

module.exports = countries
  .filter(c => c.available !== false)
  .flatMap(c => languages.map(l => ({
    country: c,
    language: l,
    countryCode: c.code,
    languageCode: l.code
  })));
