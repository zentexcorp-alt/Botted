const mongoose = require('mongoose');

const taxSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  taxRate: { type: Number, default: 0.05 }, // 5% default
  taxVault: { type: Number, default: 0 },
  totalCollected: { type: Number, default: 0 },
  lastDistributed: { type: Date, default: null },
});

module.exports = mongoose.model('Tax', taxSchema);