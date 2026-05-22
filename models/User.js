const mongoose = require('mongoose');

const holdingSchema = new mongoose.Schema({
  symbol: String,
  quantity: { type: Number, default: 0 },
  avgBuyPrice: { type: Number, default: 0 },
});

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  username: { type: String },

  // Wallet (liquid cash)
  wallet: { type: Number, default: 1000 },

  // Bank account (interest-bearing)
  bank: { type: Number, default: 0 },
  bankInterestRate: { type: Number, default: 0.01 }, // 1% daily
  lastInterestClaim: { type: Date, default: Date.now },

  // Crypto account
  cryptoBalance: { type: Number, default: 0 }, // USD in crypto account
  cryptoHoldings: [holdingSchema],

  // Stock account
  stockBalance: { type: Number, default: 0 }, // USD in stock account
  stockHoldings: [holdingSchema],

  // Casino account
  casinoBalance: { type: Number, default: 0 },
  casinoWins: { type: Number, default: 0 },
  casinoLosses: { type: Number, default: 0 },
  casinoTotalWon: { type: Number, default: 0 },
  casinoTotalLost: { type: Number, default: 0 },

  // Leveling system
  level: { type: Number, default: 1 },
  xp: { type: Number, default: 0 },
  xpToNextLevel: { type: Number, default: 100 },

  // Work system
  job: { type: String, default: null },
  lastWork: { type: Date, default: null },
  workStreak: { type: Number, default: 0 },

  // Daily/cooldowns
  lastDaily: { type: Date, default: null },
  lastRob: { type: Date, default: null },

  // Stats
  totalEarned: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  totalTrades: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
});

// Net worth virtual
userSchema.virtual('netWorth').get(function () {
  return (
    this.wallet +
    this.bank +
    this.cryptoBalance +
    this.stockBalance +
    this.casinoBalance
  );
});

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema);
