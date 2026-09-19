const countries = require('./calculatorCountries.json').list || [];
const languages = require('./siteLanguages.json').languages || [];
const localeCopy = require('./locales');

// Generate a country + language page for every active country and enabled language.
// The localized copy is merged into each language object so templates can render
// SEO-friendly, fully localized headings/navigation without hard-coded English.
module.exports = countries
  .filter(c => c.available !== false)
  .flatMap(c => languages
    .filter(l => l.enabled !== false)
    .map(l => ({
      country: c,
      language: Object.assign({}, l, localeCopy[l.code] || {}),
      countryCode: c.code,
      languageCode: l.code
    })));
