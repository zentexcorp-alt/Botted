const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  itemId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  emoji: { type: String, default: '📦' },
  description: { type: String, default: '' },
  category: {
    type: String,
    enum: ['tool', 'boost', 'collectible', 'lootbox', 'material', 'property', 'special'],
    required: true,
  },
  rarity: {
    type: String,
    enum: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'],
    default: 'common',
  },
  buyPrice: { type: Number, default: 0 },
  sellPrice: { type: Number, default: 0 },
  buyable: { type: Boolean, default: true },
  sellable: { type: Boolean, default: true },
  usable: { type: Boolean, default: false },
  stackable: { type: Boolean, default: true },
  effect: { type: String, default: null },
  effectValue: { type: Number, default: 0 },
  effectDuration: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
});

module.exports = mongoose.model('Item', itemSchema);