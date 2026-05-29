require('dotenv').config();
const mongoose = require('mongoose');
const Asset = require('./models/Asset');

const DEFAULT_CRYPTOS = [
  { symbol: 'BTC', name: 'Bitcoin', currentPrice: 45000, volatility: 0.04, description: 'The original cryptocurrency', sector: 'Layer 1', totalSupply: 21_000_000, circulatingSupply: 19_000_000 },
  { symbol: 'ETH', name: 'Ethereum', currentPrice: 2500, volatility: 0.06, description: 'Smart contract platform', sector: 'Layer 1', totalSupply: 120_000_000, circulatingSupply: 120_000_000 },
  { symbol: 'SOL', name: 'Solana', currentPrice: 25, volatility: 0.10, description: 'Fast L1 blockchain', sector: 'Layer 1', totalSupply: 570_000_000, circulatingSupply: 430_000_000 },
  { symbol: 'DOGE', name: 'Dogecoin', currentPrice: 0.10, volatility: 0.15, description: 'The meme coin', sector: 'Meme', totalSupply: 132_000_000_000, circulatingSupply: 145_000_000_000 },
  { symbol: 'LINK', name: 'Chainlink', currentPrice: 10, volatility: 0.08, description: 'Decentralized oracle', sector: 'DeFi', totalSupply: 1_000_000_000, circulatingSupply: 600_000_000 },
];

const DEFAULT_STOCKS = [
  { symbol: 'AAPL', name: 'Apple Inc.', currentPrice: 180, volatility: 0.02, sector: 'Technology', description: 'Consumer electronics giant' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', currentPrice: 130, volatility: 0.025, sector: 'Technology', description: 'Search and advertising' },
  { symbol: 'TSLA', name: 'Tesla Inc.', currentPrice: 250, volatility: 0.06, sector: 'Automotive', description: 'Electric vehicle manufacturer' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', currentPrice: 500, volatility: 0.05, sector: 'Semiconductors', description: 'GPU and AI chip leader' },
  { symbol: 'GME', name: 'GameStop Corp.', currentPrice: 20, volatility: 0.15, sector: 'Retail', description: 'The meme stock' },
];

const DEFAULT_COMMODITIES = [
  // Energy
  { symbol: 'OIL', name: 'Crude Oil', currentPrice: 85, volatility: 0.04, commodityCategory: 'energy', unit: 'barrel', description: 'Crude oil — the worlds most traded commodity', sector: 'Energy', totalSupply: 1_000_000_000, circulatingSupply: 500_000_000 },
  { symbol: 'GAS', name: 'Natural Gas', currentPrice: 3.5, volatility: 0.06, commodityCategory: 'energy', unit: 'unit', description: 'Natural gas for energy and heating', sector: 'Energy', totalSupply: 5_000_000_000, circulatingSupply: 2_000_000_000 },
  // Metals
  { symbol: 'XAU', name: 'Gold', currentPrice: 2000, volatility: 0.02, commodityCategory: 'metals', unit: 'oz', description: 'The safe haven precious metal', sector: 'Metals', totalSupply: 200_000_000, circulatingSupply: 185_000_000 },
  { symbol: 'XAG', name: 'Silver', currentPrice: 25, volatility: 0.03, commodityCategory: 'metals', unit: 'oz', description: 'Industrial and precious metal', sector: 'Metals', totalSupply: 1_000_000_000, circulatingSupply: 800_000_000 },
  // Agriculture
  { symbol: 'CORN', name: 'Corn', currentPrice: 5, volatility: 0.04, commodityCategory: 'agriculture', unit: 'bushel', description: 'The worlds most produced crop', sector: 'Agriculture', totalSupply: 50_000_000_000, circulatingSupply: 30_000_000_000 },
  { symbol: 'WEAT', name: 'Wheat', currentPrice: 6, volatility: 0.05, commodityCategory: 'agriculture', unit: 'bushel', description: 'Staple food crop worldwide', sector: 'Agriculture', totalSupply: 30_000_000_000, circulatingSupply: 20_000_000_000 },
  { symbol: 'COFF', name: 'Coffee', currentPrice: 1.8, volatility: 0.06, commodityCategory: 'agriculture', unit: 'lb', description: 'The worlds favorite beverage crop', sector: 'Agriculture', totalSupply: 10_000_000_000, circulatingSupply: 7_000_000_000 },
  // Industrial
  { symbol: 'COPR', name: 'Copper', currentPrice: 4, volatility: 0.035, commodityCategory: 'industrial', unit: 'lb', description: 'Essential industrial metal', sector: 'Industrial', totalSupply: 20_000_000_000, circulatingSupply: 15_000_000_000 },
  { symbol: 'STLL', name: 'Steel', currentPrice: 800, volatility: 0.03, commodityCategory: 'industrial', unit: 'ton', description: 'Foundation of construction and manufacturing', sector: 'Industrial', totalSupply: 5_000_000_000, circulatingSupply: 3_000_000_000 },
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
    } else console.log(`⏭ Skipped: ${c.symbol}`);
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
    } else console.log(`⏭ Skipped: ${s.symbol}`);
  }

  for (const comm of DEFAULT_COMMODITIES) {
    const exists = await Asset.findOne({ symbol: comm.symbol });
    if (!exists) {
      await Asset.create({
        ...comm, type: 'commodity',
        previousPrice: comm.currentPrice, openPrice: comm.currentPrice,
        marketCap: comm.currentPrice * comm.circulatingSupply,
        priceHistory: [{ open: comm.currentPrice, high: comm.currentPrice * 1.005, low: comm.currentPrice * 0.995, close: comm.currentPrice }],
      });
      console.log(`✅ Added commodity: ${comm.symbol}`);
    } else console.log(`⏭ Skipped: ${comm.symbol}`);
  }

  console.log('\n🎉 Seed complete!');
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });