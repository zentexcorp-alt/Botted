const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  role: String,
  salary: Number,
  hiredAt: { type: Date, default: Date.now },
});

const businessSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  partnerId: { type: String, default: null },
  name: { type: String, required: true },
  type: { type: String, required: true },
  level: { type: Number, default: 1 },
  reputation: { type: Number, default: 50 },
  vault: { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },
  staff: [staffSchema],
  lastCollect: { type: Date, default: Date.now },
  lastAdvertise: { type: Date, default: null },
  lastEvent: { type: Date, default: null },
  incomeBoost: { type: Number, default: 1 },
  incomeBoostExpiry: { type: Date, default: null },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Business', businessSchema);