require('dotenv').config();
const mongoose = require('mongoose');
const Asset = require('./models/Asset');

const DEFAULT_CRYPTOS = [
  { symbol: 'BTC', name: 'Bitcoin', currentPrice: 45000, volatility: 0.04, description: 'The original cryptocurrency', sector: 'Layer 1', totalSupply: 21_000_000, circulatingSupply: 19_000_000 },
  { symbol: 'ETH', name: 'Ethereum', currentPrice: 2500, volatility: 0.06, description: 'Smart contract platform', sector: 'Layer 1', totalSupply: 120_000_000, circulatingSupply: 120_000_000 },
  { symbol: 'SOL', name: 'Solana', currentPrice: 95, volatility: 0.1, description: 'Fast L1 blockchain', sector: 'Layer 1', totalSupply: 570_000_000, circulatingSupply: 430_000_000 },
  { symbol: 'DOGE', name: 'Dogecoin', currentPrice: 0.12, volatility: 0.15, description: 'The meme coin', sector: 'Meme', totalSupply: 132_000_000_000, circulatingSupply: 145_000_000_000 },
  { symbol: 'LINK', name: 'Chainlink', currentPrice: 14, volatility: 0.08, description: 'Decentralized oracle', sector: 'DeFi', totalSupply: 1_000_000_000, circulatingSupply: 600_000_000 },
];

const DEFAULT_STOCKS = [
  { symbol: 'AAPL', name: 'Apple Inc.', currentPrice: 185, volatility: 0.02, sector: 'Technology', description: 'Consumer electronics giant' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', currentPrice: 140, volatility: 0.025, sector: 'Technology', description: 'Search and advertising' },
  { symbol: 'TSLA', name: 'Tesla Inc.', currentPrice: 245, volatility: 0.06, sector: 'Automotive', description: 'Electric vehicle manufacturer' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', currentPrice: 480, volatility: 0.05, sector: 'Semiconductors', description: 'GPU and AI chip leader' },
  { symbol: 'GME', name: 'GameStop Corp.', currentPrice: 20, volatility: 0.15, sector: 'Retail', description: 'The meme stock' },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB...');

  for (const c of DEFAULT_CRYPTOS) {
    const exists = await Asset.findOne({ symbol: c.symbol });
    if (!exists) {
      await Asset.create({
        ...c, type: 'crypto',
        previousPrice: c.currentPrice, openPrice: c.currentPrice,
        marketCap: c.currentPrice * c.circulatingSupply,
        priceHistory: [{ open: c.currentPrice, high: c.currentPrice * 1.01, low: c.currentPrice * 0.99, close: c.currentPrice }],
      });
      console.log(`✅ Added crypto: ${c.symbol}`);
    } else {
      console.log(`⏭ Skipped (exists): ${c.symbol}`);
    }
  }

  for (const s of DEFAULT_STOCKS) {
    const exists = await Asset.findOne({ symbol: s.symbol });
    if (!exists) {
      const supply = 10_000_000_000;
      await Asset.create({
        ...s, type: 'stock',
        previousPrice: s.currentPrice, openPrice: s.currentPrice,
        totalSupply: supply, circulatingSupply: supply / 2,
        marketCap: s.currentPrice * (supply / 2),
        priceHistory: [{ open: s.currentPrice, high: s.currentPrice * 1.005, low: s.currentPrice * 0.995, close: s.currentPrice }],
      });
      console.log(`✅ Added stock: ${s.symbol}`);
    } else {
      console.log(`⏭ Skipped (exists): ${s.symbol}`);
    }
  }

  console.log('\n🎉 Seed complete!');
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
