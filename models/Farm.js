const mongoose = require('mongoose');

const cropSchema = new mongoose.Schema({
  cropType: String,
  plantedAt: { type: Date, default: Date.now },
  readyAt: Date,
  quantity: { type: Number, default: 1 },
  harvested: { type: Boolean, default: false },
});

const farmSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  level: { type: Number, default: 1 },
  plots: { type: Number, default: 3 },
  crops: [cropSchema],
  totalHarvested: { type: Number, default: 0 },
  lastWatered: { type: Date, default: null },
  fertilized: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Farm', farmSchema);