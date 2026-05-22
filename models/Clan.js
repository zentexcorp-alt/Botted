const mongoose = require('mongoose');

const clanSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  tag: { type: String, required: true, unique: true },
  ownerId: { type: String, required: true },
  description: { type: String, default: '' },
  members: [{ userId: String, username: String, role: { type: String, default: 'member' }, joinedAt: { type: Date, default: Date.now } }],
  bank: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  xp: { type: Number, default: 0 },
  maxMembers: { type: Number, default: 10 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Clan', clanSchema);