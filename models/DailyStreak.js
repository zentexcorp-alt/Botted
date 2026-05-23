const mongoose = require('mongoose');

const dailyStreakSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  currentStreak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  lastClaim: { type: Date, default: null },
  totalClaims: { type: Number, default: 0 },
});

module.exports = mongoose.model('DailyStreak', dailyStreakSchema);