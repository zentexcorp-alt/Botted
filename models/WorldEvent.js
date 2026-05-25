const mongoose = require('mongoose');

const worldEventSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
  description: { type: String, default: '' },
  multiplier: { type: Number, default: 1 },
  affectedStat: { type: String, default: 'all' },
  startedAt: { type: Date, default: Date.now },
  endsAt: { type: Date, required: true },
  active: { type: Boolean, default: true },
  startedBy: { type: String, default: null },
});

module.exports = mongoose.model('WorldEvent', worldEventSchema);