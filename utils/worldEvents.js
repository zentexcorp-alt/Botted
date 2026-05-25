const WorldEvent = require('../models/WorldEvent');

async function getActiveEvents(guildId) {
  const now = new Date();
  // Auto expire old events
  await WorldEvent.updateMany(
    { guildId, active: true, endsAt: { $lt: now } },
    { active: false }
  );
  return WorldEvent.find({ guildId, active: true });
}

async function getEventMultiplier(guildId, type) {
  const events = await getActiveEvents(guildId);
  let multiplier = 1;
  for (const event of events) {
    if (event.affectedStat === type || event.affectedStat === 'all') {
      multiplier *= event.multiplier;
    }
  }
  return multiplier;
}

const EVENT_TYPES = {
  bull_run: {
    name: '🐂 Bull Run',
    description: 'All crypto prices surging! Buy pressure increased massively.',
    affectedStat: 'crypto',
    defaultMultiplier: 1.2,
    color: 0x00ff88,
  },
  bear_market: {
    name: '🐻 Bear Market',
    description: 'Markets crashing! Sell pressure increasing across all assets.',
    affectedStat: 'stocks',
    defaultMultiplier: 0.8,
    color: 0xff4545,
  },
  harvest_season: {
    name: '🌾 Harvest Season',
    description: 'Perfect growing conditions! Farm yields doubled.',
    affectedStat: 'farm',
    defaultMultiplier: 2,
    color: 0x2ecc71,
  },
  job_fair: {
    name: '💼 Job Fair',
    description: 'Companies hiring! Work pay doubled for everyone.',
    affectedStat: 'work',
    defaultMultiplier: 2,
    color: 0xf39c12,
  },
  lucky_weekend: {
    name: '🎰 Lucky Weekend',
    description: 'Casino payouts doubled! Try your luck!',
    affectedStat: 'casino',
    defaultMultiplier: 2,
    color: 0xffd700,
  },
  flash_sale: {
    name: '⚡ Flash Sale',
    description: 'Shop items 50% off! Limited time only.',
    affectedStat: 'shop',
    defaultMultiplier: 0.5,
    color: 0x9b59b6,
  },
  housing_boom: {
    name: '🏠 Housing Boom',
    description: 'Property values spiking! Real estate income doubled.',
    affectedStat: 'realestate',
    defaultMultiplier: 2,
    color: 0xe67e22,
  },
  airdrop: {
    name: '💰 Airdrop',
    description: 'Free money for everyone! Check your wallet.',
    affectedStat: 'airdrop',
    defaultMultiplier: 1,
    color: 0x00d4aa,
  },
  xp_boost: {
    name: '⭐ XP Boost Event',
    description: 'Double XP for all activities!',
    affectedStat: 'xp',
    defaultMultiplier: 2,
    color: 0x5865f2,
  },
  tax_holiday: {
    name: '🎉 Tax Holiday',
    description: 'No taxes on all earnings! Enjoy it while it lasts.',
    affectedStat: 'tax',
    defaultMultiplier: 0,
    color: 0x00ff88,
  },
};

module.exports = { getActiveEvents, getEventMultiplier, EVENT_TYPES };