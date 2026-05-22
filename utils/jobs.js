// Jobs available per level
const JOBS = [
  {
    id: 'beggar',
    name: '🧤 Street Beggar',
    description: 'Beg for coins on the street corner.',
    minLevel: 1,
    maxLevel: 4,
    minPay: 50,
    maxPay: 150,
    cooldown: 30 * 60 * 1000, // 30 min
    xpReward: 10,
    responses: [
      'You held out your hat and collected {amount} coins.',
      'A kind stranger tossed {amount} coins your way.',
      'After hours of begging, you scraped together {amount} coins.',
    ],
  },
  {
    id: 'delivery',
    name: '🛵 Delivery Driver',
    description: 'Deliver packages across the city.',
    minLevel: 3,
    maxLevel: 9,
    minPay: 200,
    maxPay: 500,
    cooldown: 25 * 60 * 1000,
    xpReward: 20,
    responses: [
      'You delivered 12 packages and earned {amount} in tips.',
      'A rainy day but you completed all deliveries for {amount}.',
      'Fast delivery bonus! You earned {amount} today.',
    ],
  },
  {
    id: 'programmer',
    name: '💻 Freelance Programmer',
    description: 'Write code for small clients.',
    minLevel: 5,
    maxLevel: 14,
    minPay: 500,
    maxPay: 1200,
    cooldown: 20 * 60 * 1000,
    xpReward: 35,
    responses: [
      'You fixed a bug and got paid {amount}.',
      'A client loved your work and paid {amount} + bonus!',
      'Late-night debugging session earned you {amount}.',
    ],
  },
  {
    id: 'trader',
    name: '📈 Market Analyst',
    description: 'Analyze markets for firms.',
    minLevel: 10,
    maxLevel: 19,
    minPay: 1000,
    maxPay: 3000,
    cooldown: 15 * 60 * 1000,
    xpReward: 60,
    responses: [
      'Your market report earned the firm money, they paid you {amount}.',
      'Accurate prediction! Bonus pay of {amount} received.',
      'Presented analysis to board — received {amount} consulting fee.',
    ],
  },
  {
    id: 'ceo',
    name: '🏢 Tech CEO',
    description: 'Run your own company.',
    minLevel: 20,
    maxLevel: 999,
    minPay: 5000,
    maxPay: 15000,
    cooldown: 10 * 60 * 1000,
    xpReward: 120,
    responses: [
      'Quarterly earnings are up. You pulled {amount} in salary.',
      'Board meeting went great — executive bonus of {amount}.',
      'Your IPO just made you {amount} today.',
    ],
  },
];

function getAvailableJobs(level) {
  return JOBS.filter((j) => level >= j.minLevel && level <= j.maxLevel);
}

function getJobById(id) {
  return JOBS.find((j) => j.id === id);
}

// XP needed to level up (increases each level)
function xpForLevel(level) {
  return Math.floor(100 * Math.pow(1.4, level - 1));
}

// Check and handle level up
async function checkLevelUp(user) {
  let leveled = false;
  while (user.xp >= user.xpToNextLevel) {
    user.xp -= user.xpToNextLevel;
    user.level += 1;
    user.xpToNextLevel = xpForLevel(user.level);
    leveled = true;
  }
  return leveled;
}

module.exports = { JOBS, getAvailableJobs, getJobById, xpForLevel, checkLevelUp };
