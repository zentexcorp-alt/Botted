const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema({
  itemId: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  acquiredAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null },
});

const activeEffectSchema = new mongoose.Schema({
  itemId: { type: String, required: true },
  effect: { type: String, required: true },
  effectValue: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});

const inventorySchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  items: [inventoryItemSchema],
  activeEffects: [activeEffectSchema],
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Inventory', inventorySchema);