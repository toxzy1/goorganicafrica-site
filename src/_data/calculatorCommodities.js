const fs = require('fs');
const path = require('path');

const commoditiesDir = path.join(__dirname, 'calculator/commodities');

function normalizeCommodity(commodity) {
  const countryData = commodity && commodity.country_data;
  if (Array.isArray(countryData)) {
    return {
      ...commodity,
      country_data: Object.fromEntries(
        countryData.filter((x) => x && x.country_code).map((x) => {
          const copy = { ...x };
          delete copy.country_code;
          return [x.country_code, copy];
        })
      )
    };
  }
  return commodity;
}

module.exports = () => {
  const files = fs.readdirSync(commoditiesDir)
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .sort();
  const commodities = files.map((name) => {
    const file = path.join(commoditiesDir, name);
    return normalizeCommodity(JSON.parse(fs.readFileSync(file, 'utf8')));
  });
  return commodities.filter((c) => c.active !== false).slice().sort((a, b) => {
    if (a.category !== b.category) return a.category === 'crop' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
};
