const mongoose = require('mongoose');

const warehouseItemSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  quantity: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
});

const warehouseSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  items: [warehouseItemSchema],
  capacity: { type: Number, default: 10000 },
  usedCapacity: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Warehouse', warehouseSchema);