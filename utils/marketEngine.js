const Asset = require('../models/Asset');

// How often the market ticks (ms)
const TICK_INTERVAL = 60 * 1000; // every 1 minute

/**
 * Core price movement algorithm.
 * Factors:
 *  1. Random walk (Brownian motion) scaled by volatility
 *  2. Supply/demand pressure from actual buys/sells
 *  3. Mean reversion toward a fair value
 *  4. Trend momentum
 *  5. Admin price target influence
 */
function calculateNewPrice(asset) {
  const { currentPrice, volatility, trend, trendStrength, buyPressure, sellPressure, adminPriceTarget, adminInfluence } = asset;

  // 1. Random walk component
  const randomFactor = (Math.random() - 0.5) * 2 * volatility;

  // 2. Supply/demand net pressure (-1 to 1 range)
  const totalPressure = buyPressure + sellPressure;
  let netDemand = 0;
  if (totalPressure > 0) {
    netDemand = ((buyPressure - sellPressure) / totalPressure) * 0.03;
  }

  // 3. Trend momentum
  const trendFactor = trend * trendStrength * 0.005;

  // 4. Mean reversion (pulls toward fair value — loosely anchored at openPrice)
  const fairValue = asset.openPrice || currentPrice;
  const deviation = (fairValue - currentPrice) / fairValue;
  const reversionFactor = deviation * 0.02;

  // 5. Admin influence
  let adminFactor = 0;
  if (adminPriceTarget && adminInfluence > 0) {
    const adminDeviation = (adminPriceTarget - currentPrice) / currentPrice;
    adminFactor = adminDeviation * adminInfluence * 0.05;
  }

  // Combined change %
  const totalChange = randomFactor + netDemand + trendFactor + reversionFactor + adminFactor;

  // Apply change
  let newPrice = currentPrice * (1 + totalChange);

  // Price floor (never below $0.00001)
  newPrice = Math.max(newPrice, 0.00001);

  return Math.round(newPrice * 100) / 100;
}

function updateTrend(asset) {
  // Trend slowly shifts based on recent price movement
  const priceChange = (asset.currentPrice - asset.previousPrice) / (asset.previousPrice || 1);
  const newTrend = asset.trend * 0.85 + priceChange * 15;
  asset.trend = Math.max(-1, Math.min(1, newTrend));
}

async function tickMarket() {
  try {
    const assets = await Asset.find({ active: true });

    for (const asset of assets) {
      const newPrice = calculateNewPrice(asset);

      // Build candlestick data point
      const candle = {
        open: asset.currentPrice,
        high: Math.max(asset.currentPrice, newPrice),
        low: Math.min(asset.currentPrice, newPrice),
        close: newPrice,
        volume: asset.buyPressure + asset.sellPressure,
        timestamp: new Date(),
      };

      // Keep last 100 candles
      asset.priceHistory.push(candle);
      if (asset.priceHistory.length > 100) {
        asset.priceHistory.shift();
      }

      // Update state
      asset.previousPrice = asset.currentPrice;
      asset.currentPrice = newPrice;
      asset.marketCap = newPrice * asset.circulatingSupply;

      // Decay buy/sell pressure each tick
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
  // Run first tick after 5 seconds
  setTimeout(tickMarket, 5000);
}

/**
 * Record buy/sell pressure when a user trades.
 * @param {string} symbol - Asset symbol
 * @param {'buy'|'sell'} side
 * @param {number} dollarValue - USD value of trade
 */
async function recordTradePressure(symbol, side, dollarValue) {
  const impact = Math.min(dollarValue * 0.00001, 500); // cap impact
  await Asset.updateOne(
    { symbol: symbol.toUpperCase() },
    side === 'buy'
      ? { $inc: { buyPressure: impact, totalVolume24h: dollarValue } }
      : { $inc: { sellPressure: impact, totalVolume24h: dollarValue } }
  );
}

module.exports = { startMarketSimulation, recordTradePressure };
