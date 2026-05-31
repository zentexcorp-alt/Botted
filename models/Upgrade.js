const mongoose = require('mongoose');

const upgradeSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  assetId: { type: String, required: true }, // Production._id
  assetType: { type: String, required: true },
  upgrades: [{
    upgradeId: String,
    name: String,
    purchasedAt: { type: Date, default: Date.now },
  }],
});

upgradeSchema.index({ userId: 1, assetId: 1 }, { unique: true });
module.exports = mongoose.model('Upgrade', upgradeSchema);