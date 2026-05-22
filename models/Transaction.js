const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  type: {
    type: String,
    enum: [
      'buy_crypto',
      'sell_crypto',
      'buy_stock',
      'sell_stock',
      'deposit',
      'withdraw',
      'transfer',
      'work',
      'daily',
      'casino_win',
      'casino_loss',
      'interest',
      'admin',
    ],
    required: true,
  },
  symbol: { type: String, default: null },
  quantity: { type: Number, default: 0 },
  price: { type: Number, default: 0 },
  total: { type: Number, required: true },
  balanceAfter: { type: Number, default: 0 },
  note: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Transaction', transactionSchema);
