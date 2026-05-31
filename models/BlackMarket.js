const mongoose = require('mongoose');

const blackMarketItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true },
  stock: { type: Number, required: true },
  originalStock: { type: Number, required: true },
  type: {
    type: String,
    enum: ['commodity', 'cash', 'boost', 'special'],
    default: 'special',
  },
  effect: { type: String, default: null },
  effectValue: { type: Number, default: 0 },
  symbol: { type: String, default: null },
  quantity: { type: Number, default: 0 },
});

const blackMarketSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  items: [blackMarketItemSchema],
  opensAt: { type: Date, default: Date.now },
  closesAt: { type: Date, required: true },
  active: { type: Boolean, default: true },
  openedBy: { type: String, required: true },
  buyers: [{
    userId: String,
    username: String,
    itemName: String,
    quantity: Number,
    paid: Number,
    boughtAt: { type: Date, default: Date.now },
  }],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('BlackMarket', blackMarketSchema);