const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  propertyType: { type: String, required: true },
  name: { type: String, required: true },
  level: { type: Number, default: 1 },
  purchasePrice: { type: Number, required: true },
  currentValue: { type: Number, required: true },
  lastCollect: { type: Date, default: Date.now },
  totalEarned: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('RealEstate', propertySchema);