const mongoose = require('mongoose');

const lotterySchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  tickets: [{ userId: String, username: String, count: { type: Number, default: 1 } }],
  jackpot: { type: Number, default: 10000 },
  ticketPrice: { type: Number, default: 500 },
  lastDraw: { type: Date, default: Date.now },
  winnerId: { type: String, default: null },
  active: { type: Boolean, default: true },
});

module.exports = mongoose.model('Lottery', lotterySchema);