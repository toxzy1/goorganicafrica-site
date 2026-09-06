const data = require('./calculatorData.json');

module.exports = () => {
  const commodities = Array.isArray(data.commodities) ? data.commodities : [];
  return commodities.slice().sort((a, b) => {
    if (a.category !== b.category) return a.category === 'crop' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
};
