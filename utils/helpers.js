const User = require('../models/User');

async function getOrCreateUser(userId, username) {
  let user = await User.findOne({ userId });
  if (!user) {
    user = await User.create({ userId, username });
  } else if (username && user.username !== username) {
    user.username = username;
    await user.save();
  }
  return user;
}

function formatMoney(amount, decimals = 2) {
  if (amount === undefined || amount === null) return '$0.00';
  if (Math.abs(amount) < 0.01) return `$${amount.toFixed(6)}`;
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function formatPercent(pct) {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

function priceChange(current, previous) {
  if (!previous || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function checkCooldown(lastUsed, cooldownMs) {
  if (!lastUsed) return { ready: true, remaining: 0 };
  const elapsed = Date.now() - new Date(lastUsed).getTime();
  if (elapsed >= cooldownMs) return { ready: true, remaining: 0 };
  return { ready: false, remaining: cooldownMs - elapsed };
}

async function calcNetWorth(user, assetMap) {
  let worth = user.wallet + user.bank + user.tradingAccount;
  for (const h of user.cryptoHoldings) {
    const price = assetMap[h.symbol]?.currentPrice || 0;
    worth += h.quantity * price;
  }
  for (const h of user.stockHoldings) {
    const price = assetMap[h.symbol]?.currentPrice || 0;
    worth += h.quantity * price;
  }
  for (const h of user.commodityHoldings) {
    const price = assetMap[h.symbol]?.currentPrice || 0;
    worth += h.quantity * price;
  }
  return worth;
}

module.exports = {
  getOrCreateUser,
  formatMoney,
  formatPercent,
  priceChange,
  formatDuration,
  randInt,
  checkCooldown,
  calcNetWorth,
};