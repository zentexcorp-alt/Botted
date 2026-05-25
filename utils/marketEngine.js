const Asset = require('../models/Asset');

const TICK_INTERVAL = 60 * 1000; // every 1 minute

/**
 * Core price movement algorithm.
 * Factors:
 *  1. Random walk (Brownian motion) scaled by volatility
 *  2. Supply/demand pressure from actual buys/sells (scaled by market cap)
 *  3. Mean reversion toward fair value
 *  4. Trend momentum
 *  5. Admin price target influence
 */
function calculateNewPrice(asset) {
  const {
    currentPrice,
    volatility,
    trend,
    trendStrength,
    buyPressure,
    sellPressure,
    adminPriceTarget,
    adminInfluence,
    marketCap,
  } = asset;

  // 1. Random walk
  const randomFactor = (Math.random() - 0.5) * 2 * volatility;

  // 2. Supply/demand — scaled by market cap so big trades matter more
  const totalPressure = buyPressure + sellPressure;
  let netDemand = 0;
  if (totalPressure > 0) {
    const rawDemand = (buyPressure - sellPressure) / totalPressure;
    // Scale impact — bigger pressure = bigger price move
    const pressureStrength = Math.min(totalPressure / 100, 1); // 0 to 1
    netDemand = rawDemand * pressureStrength * 0.08; // max 8% move from pressure
  }

  // 3. Trend momentum
  const trendFactor = trend * (trendStrength || 0.3) * 0.005;

  // 4. Mean reversion toward open price
  const fairValue = asset.openPrice || currentPrice;
  const deviation = (fairValue - currentPrice) / (fairValue || 1);
  const reversionFactor = deviation * 0.02;

  // 5. Admin influence
  let adminFactor = 0;
  if (adminPriceTarget && adminInfluence > 0) {
    const adminDeviation = (adminPriceTarget - currentPrice) / (currentPrice || 1);
    adminFactor = adminDeviation * adminInfluence * 0.05;
  }

  // Combined change
  const totalChange = randomFactor + netDemand + trendFactor + reversionFactor + adminFactor;

  // Apply change
  let newPrice = currentPrice * (1 + totalChange);

  // Price floor
  newPrice = Math.max(newPrice, 0.00001);

  return Math.round(newPrice * 100) / 100;
}

function updateTrend(asset) {
  const priceChange = (asset.currentPrice - asset.previousPrice) / (asset.previousPrice || 1);
  const newTrend = asset.trend * 0.85 + priceChange * 15;
  asset.trend = Math.max(-1, Math.min(1, newTrend));
}

async function tickMarket() {
  try {
    const assets = await Asset.find({ active: true });

    for (const asset of assets) {
      const newPrice = calculateNewPrice(asset);

      // Candlestick data
      const candle = {
        open: asset.currentPrice,
        high: Math.max(asset.currentPrice, newPrice),
        low: Math.min(asset.currentPrice, newPrice),
        close: newPrice,
        volume: asset.buyPressure + asset.sellPressure,
        timestamp: new Date(),
      };

      asset.priceHistory.push(candle);
      if (asset.priceHistory.length > 100) asset.priceHistory.shift();

      asset.previousPrice = asset.currentPrice;
      asset.currentPrice = newPrice;
      asset.marketCap = newPrice * asset.circulatingSupply;

      // Decay pressure 40% each tick
      asset.buyPressure = Math.max(0, asset.buyPressure * 0.6);
      asset.sellPressure = Math.max(0, asset.sellPressure * 0.6);

      updateTrend(asset);
      await asset.save();
    }
  } catch (err) {
    console.error('Market tick error:', err.message);
  }
}

function startMarketSimulation() {
  console.log('📈 Market simulation started');
  setInterval(tickMarket, TICK_INTERVAL);
  setTimeout(tickMarket, 5000);
}

/**
 * Record buy/sell pressure when a user trades.
 * Impact scales with trade size relative to market cap.
 * Bigger trades relative to market cap = bigger price impact.
 */
async function recordTradePressure(symbol, side, dollarValue) {
  const asset = await Asset.findOne({ symbol: symbol.toUpperCase() });
  if (!asset) return;

  const marketCap = asset.marketCap || 1;

  // Impact = what % of market cap is being traded
  const impactPct = dollarValue / marketCap;

  // Scale it up so it actually moves the price
  // 1% of market cap traded = 10 impact points
  const impact = Math.min(impactPct * 1000, 50);

  // Minimum impact so small trades still register
  const finalImpact = Math.max(impact, 0.01);

  await Asset.updateOne(
    { symbol: symbol.toUpperCase() },
    side === 'buy'
      ? { $inc: { buyPressure: finalImpact, totalVolume24h: dollarValue } }
      : { $inc: { sellPressure: finalImpact, totalVolume24h: dollarValue } }
  );
}

module.exports = { startMarketSimulation, recordTradePressure };