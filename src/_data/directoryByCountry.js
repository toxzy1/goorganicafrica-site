const listings = require("./directoryListings.json").listings || [];
const coverage = require("../../config/directory-country-coverage.json").countries || [];

const active = listings.filter((item) => item && item.active !== false);

module.exports = coverage.reduce((result, country) => {
  const key = String(country.code || "").toLowerCase();
  result[key] = {
    countryListings: active.filter((item) => item.country === country.name),
    multiListings: active.filter((item) => item.country === "MULTI")
  };
  return result;
}, {});
