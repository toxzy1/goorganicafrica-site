/* Farm Profit Calculator Africa — Calculation Engine
   Handles three commodity modes:
   - "crop": quantity = hectares; yield in tonnes/ha; price per kg
   - "livestock_unit": quantity = number of animals; sold as whole animals/kg at harvest
   - "livestock_recurring": quantity = number of animals; recurring output (e.g. eggs) over a cycle
   All functions are pure and defensively handle zero/negative/missing values.
*/

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Core calculation. Returns null-safe results, never throws.
 * @param {Object} input
 *   mode: "crop" | "livestock_unit" | "livestock_recurring"
 *   quantity: number (hectares, or number of animals)
 *   costPerUnit: number (cost per hectare, or per animal)
 *   yieldPerUnit: number (tonnes/ha) — crop mode only
 *   pricePerKg: number — crop mode only
 *   survivalRatePct: number (0-100) — livestock modes
 *   pricePerAnimal: number — livestock_unit mode
 *   outputPerAnimal: number (e.g. eggs/year) — livestock_recurring mode
 *   pricePerOutput: number (price per egg) — livestock_recurring mode
 */
function calculateFarmProfit(input) {
  const mode = input.mode;
  const quantity = safeNum(input.quantity);

  let totalCost = 0;
  let totalRevenue = 0;
  let breakEvenPrice = null;
  let breakEvenYield = null;
  let outputDescription = "";

  const costPerUnit = safeNum(input.costPerUnit);
  totalCost = quantity * costPerUnit;

  if (mode === "crop") {
    const yieldPerUnit = safeNum(input.yieldPerUnit);
    const pricePerKg = safeNum(input.pricePerKg);
    const totalYieldKg = quantity * yieldPerUnit * 1000;
    totalRevenue = totalYieldKg * pricePerKg;
    outputDescription = `${(quantity * yieldPerUnit).toLocaleString()} tonnes`;

    breakEvenPrice = totalYieldKg > 0 ? totalCost / totalYieldKg : null;
    breakEvenYield = pricePerKg > 0 ? totalCost / (pricePerKg * 1000 * (quantity || 1)) : null;
  } else if (mode === "livestock_unit") {
    const survivalRate = safeNum(input.survivalRatePct, 100) / 100;
    const pricePerAnimal = safeNum(input.pricePerAnimal);
    const survivingUnits = quantity * survivalRate;
    totalRevenue = survivingUnits * pricePerAnimal;
    outputDescription = `${Math.round(survivingUnits).toLocaleString()} sold`;

    breakEvenPrice = survivingUnits > 0 ? totalCost / survivingUnits : null;
    breakEvenYield = pricePerAnimal > 0 ? totalCost / pricePerAnimal / (survivalRate || 1) : null;
  } else if (mode === "livestock_recurring") {
    const survivalRate = safeNum(input.survivalRatePct, 100) / 100;
    const outputPerAnimal = safeNum(input.outputPerAnimal);
    const pricePerOutput = safeNum(input.pricePerOutput);
    const survivingUnits = quantity * survivalRate;
    const totalOutput = survivingUnits * outputPerAnimal;
    totalRevenue = totalOutput * pricePerOutput;
    outputDescription = `${Math.round(totalOutput).toLocaleString()} units produced`;

    breakEvenPrice = totalOutput > 0 ? totalCost / totalOutput : null;
    breakEvenYield = pricePerOutput > 0 ? totalCost / pricePerOutput : null;
  }

  const profit = totalRevenue - totalCost;
  const roi = totalCost > 0 ? (profit / totalCost) * 100 : null;
  const profitPerUnit = quantity > 0 ? profit / quantity : null;

  return {
    totalCost,
    totalRevenue,
    profit,
    roi,
    breakEvenPrice,
    breakEvenYield,
    profitPerUnit,
    outputDescription,
  };
}

/**
 * Generate conservative / expected / optimistic scenarios by adjusting
 * yield and price inputs by a percentage band.
 */
function calculateScenarios(baseInput, bandPct = 15) {
  const factor = bandPct / 100;

  const scale = (val, mult) => (val === undefined || val === null ? val : safeNum(val) * mult);

  const conservativeInput = { ...baseInput };
  const optimisticInput = { ...baseInput };

  if (baseInput.mode === "crop") {
    conservativeInput.yieldPerUnit = scale(baseInput.yieldPerUnit, 1 - factor);
    conservativeInput.pricePerKg = scale(baseInput.pricePerKg, 1 - factor);
    optimisticInput.yieldPerUnit = scale(baseInput.yieldPerUnit, 1 + factor);
    optimisticInput.pricePerKg = scale(baseInput.pricePerKg, 1 + factor);
  } else if (baseInput.mode === "livestock_unit") {
    conservativeInput.survivalRatePct = Math.max(0, safeNum(baseInput.survivalRatePct) - bandPct);
    conservativeInput.pricePerAnimal = scale(baseInput.pricePerAnimal, 1 - factor);
    optimisticInput.survivalRatePct = Math.min(100, safeNum(baseInput.survivalRatePct) + bandPct / 2);
    optimisticInput.pricePerAnimal = scale(baseInput.pricePerAnimal, 1 + factor);
  } else if (baseInput.mode === "livestock_recurring") {
    conservativeInput.outputPerAnimal = scale(baseInput.outputPerAnimal, 1 - factor);
    conservativeInput.pricePerOutput = scale(baseInput.pricePerOutput, 1 - factor);
    optimisticInput.outputPerAnimal = scale(baseInput.outputPerAnimal, 1 + factor);
    optimisticInput.pricePerOutput = scale(baseInput.pricePerOutput, 1 + factor);
  }

  return {
    conservative: calculateFarmProfit(conservativeInput),
    expected: calculateFarmProfit(baseInput),
    optimistic: calculateFarmProfit(optimisticInput),
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { calculateFarmProfit, calculateScenarios, safeNum };
}

// Expose globally for browser use
if (typeof window !== "undefined") {
  window.FarmCalcEngine = {
    calculateFarmProfit: calculateFarmProfit,
    calculateScenarios: calculateScenarios,
    safeNum: safeNum
  };
}
