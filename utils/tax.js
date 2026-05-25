const Tax = require('../models/Tax');

async function getOrCreateTax(guildId) {
  let tax = await Tax.findOne({ guildId });
  if (!tax) tax = await Tax.create({ guildId });
  return tax;
}

// Tax brackets — progressive system
function calculateTax(amount, netWorth) {
  let rate;
  if (netWorth < 10000) rate = 0;
  else if (netWorth < 100000) rate = 0.02;
  else if (netWorth < 1000000) rate = 0.05;
  else if (netWorth < 10000000) rate = 0.08;
  else rate = 0.12;

  return Math.floor(amount * rate);
}

function getTaxBracket(netWorth) {
  if (netWorth < 10000) return { rate: 0, label: '⬜ No Tax' };
  if (netWorth < 100000) return { rate: 2, label: '🟩 2% — Low Income' };
  if (netWorth < 1000000) return { rate: 5, label: '🟦 5% — Middle Class' };
  if (netWorth < 10000000) return { rate: 8, label: '🟪 8% — Upper Class' };
  return { rate: 12, label: '🟨 12% — Elite' };
}

module.exports = { getOrCreateTax, calculateTax, getTaxBracket };