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
  type: {
    type: String,
    enum: ['crypto', 'stock', 'commodity'],
    required: true,
  },
  // For commodities
  commodityCategory: {
    type: String,
    enum: ['energy', 'metals', 'agriculture', 'industrial', null],
    default: null,
  },
  unit: { type: String, default: 'unit' }, // barrel, oz, bushel etc

  currentPrice: { type: Number, required: true },
  previousPrice: { type: Number, default: 0 },
  openPrice: { type: Number, default: 0 },

  totalSupply: { type: Number, default: 1_000_000 },
  circulatingSupply: { type: Number, default: 500_000 },
  totalVolume24h: { type: Number, default: 0 },
  buyPressure: { type: Number, default: 0 },
  sellPressure: { type: Number, default: 0 },

  marketCap: { type: Number, default: 0 },
  volatility: { type: Number, default: 0.05 },
  trend: { type: Number, default: 0 },
  trendStrength: { type: Number, default: 0.3 },

  priceHistory: [pricePointSchema],

  adminPriceTarget: { type: Number, default: null },
  adminInfluence: { type: Number, default: 0 },

  description: { type: String, default: '' },
  sector: { type: String, default: 'General' },
  imageUrl: { type: String, default: null },
  active: { type: Boolean, default: true },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Asset', assetSchema);