const mongoose = require('mongoose');

const holdingSchema = new mongoose.Schema({
  symbol: String,
  quantity: { type: Number, default: 0 },
  avgBuyPrice: { type: Number, default: 0 },
});

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  username: { type: String },

  // 3 Accounts
  wallet: { type: Number, default: 1000 },
  bank: { type: Number, default: 0 },
  tradingAccount: { type: Number, default: 0 },

  // Bank interest
  lastInterestClaim: { type: Date, default: Date.now },

  // Holdings
  cryptoHoldings: [holdingSchema],
  stockHoldings: [holdingSchema],
  commodityHoldings: [holdingSchema],

  // Leveling
  level: { type: Number, default: 1 },
  xp: { type: Number, default: 0 },
  xpToNextLevel: { type: Number, default: 100 },

  // Work
  job: { type: String, default: null },
  lastWork: { type: Date, default: null },
  workStreak: { type: Number, default: 0 },

  // Daily
  lastDaily: { type: Date, default: null },

  // Stats
  totalEarned: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  totalTrades: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', userSchema);