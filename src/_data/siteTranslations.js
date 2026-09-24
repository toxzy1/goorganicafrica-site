const translations = require('./siteTranslations.json');
module.exports = Object.fromEntries(Object.entries(translations).map(([code, language]) => [code, language.translations]));
