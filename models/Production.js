const mongoose = require('mongoose');

const productionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  type: {
    type: String,
    enum: ['oil_field', 'gas_field', 'gold_mine', 'silver_mine', 'crop_farm'],
    required: true,
  },
  name: { type: String, required: true },
  level: { type: Number, default: 1 },
  outputPerHour: { type: Number, default: 0 },
  lastCollect: { type: Date, default: Date.now },
  totalProduced: { type: Number, default: 0 },
  maintenanceDue: { type: Boolean, default: false },
  lastMaintenance: { type: Date, default: Date.now },
  cropType: { type: String, default: null }, // for crop farms
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Production', productionSchema);