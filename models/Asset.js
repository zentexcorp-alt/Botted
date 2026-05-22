const mongoose = require('mongoose');

const pricePointSchema = new mongoose.Schema({
  open: Number,
  high: Number,
  low: Number,
  close: Number,
  volume: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now },
});

const assetSchema = new mongoose.Schema({
  symbol: { type: String, required: true, unique: true, uppercase: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['crypto', 'stock'], required: true },

  // Current price data
  currentPrice: { type: Number, required: true },
  previousPrice: { type: Number, default: 0 },
  openPrice: { type: Number, default: 0 }, // daily open

  // Supply/demand model
  totalSupply: { type: Number, default: 1_000_000 },
  circulatingSupply: { type: Number, default: 500_000 },
  totalVolume24h: { type: Number, default: 0 },
  buyPressure: { type: Number, default: 0 },
  sellPressure: { type: Number, default: 0 },

  // Market cap
  marketCap: { type: Number, default: 0 },

  // Volatility (higher = more volatile)
  volatility: { type: Number, default: 0.05 },

  // Trend: -1 (bearish) to 1 (bullish)
  trend: { type: Number, default: 0 },
  trendStrength: { type: Number, default: 0.3 },

  // Price history for charts (candlestick data, last 60 candles)
  priceHistory: [pricePointSchema],

  // Admin-set base price influence
  adminPriceTarget: { type: Number, default: null },
  adminInfluence: { type: Number, default: 0 }, // 0-1 how strongly admin target pulls price

  // Description / sector
  description: { type: String, default: '' },
  sector: { type: String, default: 'General' },

  // Is tradeable?
  active: { type: Boolean, default: true },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Asset', assetSchema);
