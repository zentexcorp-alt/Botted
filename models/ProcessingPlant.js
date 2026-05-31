const mongoose = require('mongoose');

const processingPlantSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  plantType: {
    type: String,
    enum: ['oil_refinery', 'gas_plant', 'smelter', 'crop_processor', 'steel_mill'],
    required: true,
  },
  durability: { type: Number, default: 100 },
  isProcessing: { type: Boolean, default: false },
  processingStarted: { type: Date, default: null },
  processingInput: { type: String, default: null },
  processingQuantity: { type: Number, default: 0 },
  processingFinishTime: { type: Date, default: null },
  batchCount: { type: Number, default: 0 },
  broken: { type: Boolean, default: false },
  brokenAt: { type: Date, default: null },
  destroyed: { type: Boolean, default: false },
  upgrades: {
    speed: { type: Boolean, default: false },
    capacity: { type: Boolean, default: false },
    durability: { type: Boolean, default: false },
    hotterFurnace: { type: Boolean, default: false },
    reinforcedLining: { type: Boolean, default: false },
  },
  totalProcessed: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ProcessingPlant', processingPlantSchema);