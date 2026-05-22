const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} = require('discord.js');

const CATEGORIES = {
  overview: {
    label: '🏠 Overview',
    emoji: '🏠',
    description: 'Getting started & bot overview',
    color: 0x5865f2,
    fields: [
      { name: '👋 Welcome to EconomyBot!', value: 'A full trading & economy simulation game. Earn money, invest in crypto & stocks, gamble in the casino, build businesses, farm crops, buy real estate and climb the leaderboard!\n\n**Quick Start:** Use `/start` to create your account and get starter cash.', inline: false },
      { name: '💳 Your 5 Accounts', value: ['`🪙 Wallet` — Liquid cash', '`🏦 Bank` — Safe storage', '`₿ Crypto` — Crypto trading', '`📈 Stock` — Stock trading', '`🎰 Casino` — Gambling'].join('\n'), inline: false },
      { name: '⭐ Leveling', value: 'Earn XP from work, trades, casino and daily. Higher levels unlock better jobs and rewards.', inline: false },
    ],
  },
  economy: {
    label: '💰 Economy',
    emoji: '💰',
    description: 'Wallet, bank, transfers, daily & gifts',
    color: 0x00d4aa,
    fields: [
      { name: '`/start`', value: 'Create your account and receive **$1,000** starter cash.', inline: false },
      { name: '`/balance [user]`', value: 'View all 5 account balances.', inline: false },
      { name: '`/transfer <from> <to> <amount>`', value: 'Move funds between accounts.', inline: false },
      { name: '`/daily`', value: 'Claim your daily reward. 24h cooldown.', inline: false },
      { name: '`/gift @user <amount> [message]`', value: 'Send money to another player. 5% tax on gifts over $10,000.', inline: false },
    ],
  },
  work: {
    label: '💼 Work & Jobs',
    emoji: '💼',
    description: 'Jobs, working and leveling up',
    color: 0xf39c12,
    fields: [
      { name: '`/work jobs`', value: 'Browse jobs available at your level.', inline: false },
      { name: '`/work join <id>`', value: 'Join a job.', inline: false },
      { name: '`/work do`', value: 'Earn money + XP from your job.', inline: false },
      { name: '`/work quit`', value: 'Quit your current job.', inline: false },
      { name: '📋 Job Tiers', value: ['🧤 Beggar (Lv1–4) — $50–150', '🛵 Delivery (Lv3–9) — $200–500', '💻 Programmer (Lv5–14) — $500–1,200', '📈 Analyst (Lv10–19) — $1,000–3,000', '🏢 CEO (Lv20+) — $5,000–15,000'].join('\n'), inline: false },
    ],
  },
  crypto: {
    label: '₿ Crypto',
    emoji: '₿',
    description: 'Buy, sell and track cryptocurrency',
    color: 0xf7931a,
    fields: [
      { name: '`/crypto list`', value: 'List all cryptocurrencies with live prices.', inline: false },
      { name: '`/crypto price <symbol>`', value: 'Detailed price info and market stats.', inline: false },
      { name: '`/crypto buy <symbol> <amount>`', value: 'Buy crypto from your Crypto Account.', inline: false },
      { name: '`/crypto sell <symbol> <qty>`', value: 'Sell crypto back to USD.', inline: false },
      { name: '`/crypto portfolio`', value: 'View your holdings with P&L.', inline: false },
    ],
  },
  stocks: {
    label: '📈 Stocks',
    emoji: '📈',
    description: 'Buy, sell and trade shares',
    color: 0x1e90ff,
    fields: [
      { name: '`/stocks list`', value: 'View all listed stocks.', inline: false },
      { name: '`/stocks price <symbol>`', value: 'Check stock price and info.', inline: false },
      { name: '`/stocks buy <symbol> <amount>`', value: 'Buy shares from your Stock Account.', inline: false },
      { name: '`/stocks sell <symbol> <shares>`', value: 'Sell shares for USD.', inline: false },
      { name: '`/stocks portfolio`', value: 'View your stock holdings.', inline: false },
    ],
  },
  charts: {
    label: '📊 Charts',
    emoji: '📊',
    description: 'Price charts for any asset',
    color: 0x9b59b6,
    fields: [
      { name: '`/chart <symbol> [type]`', value: 'Generate a price chart.', inline: false },
      { name: 'Chart Types', value: '🕯️ **Candlestick** — Open/High/Low/Close per tick\n⛰️ **Mountain** — Smooth area chart', inline: false },
    ],
  },
  casino: {
    label: '🎰 Casino',
    emoji: '🎰',
    description: 'Gambling games',
    color: 0xe74c3c,
    fields: [
      { name: '`/casino slots <bet>`', value: 'Spin the slots. Up to **20x jackpot**!', inline: false },
      { name: '`/casino coinflip <bet> <heads|tails>`', value: '50/50 — win **2x**.', inline: false },
      { name: '`/casino blackjack <bet>`', value: 'Beat the dealer to 21.', inline: false },
      { name: '`/casino dice <bet> <1-6>`', value: 'Guess the roll — win **5x**.', inline: false },
    ],
  },
  business: {
    label: '🏢 Business',
    emoji: '🏢',
    description: 'Start and grow your business',
    color: 0x2ecc71,
    fields: [
      { name: '`/business start <type> <name>`', value: 'Launch a business. Costs vary by type.', inline: false },
      { name: '`/business collect`', value: 'Collect your earnings.', inline: false },
      { name: '`/business upgrade`', value: 'Level up for more income.', inline: false },
      { name: '`/business hire <role>`', value: 'Hire staff to boost your business.', inline: false },
      { name: '`/business advertise`', value: 'Boost reputation for more income.', inline: false },
      { name: '`/business info`', value: 'Full business dashboard.', inline: false },
      { name: '`/business leaderboard`', value: 'Top businesses on the server.', inline: false },
    ],
  },
  farm: {
    label: '🌾 Farm',
    emoji: '🌾',
    description: 'Plant and harvest crops',
    color: 0x27ae60,
    fields: [
      { name: '`/farm start`', value: 'Start your farm.', inline: false },
      { name: '`/farm plant <crop>`', value: 'Plant a crop. Grows over real time.', inline: false },
      { name: '`/farm harvest`', value: 'Harvest all ready crops for cash.', inline: false },
      { name: '`/farm water`', value: 'Speed up growth by 10%.', inline: false },
      { name: '`/farm fertilize`', value: 'Pay $500 for 2x yield on next harvest.', inline: false },
      { name: '`/farm upgrade`', value: 'Unlock more planting plots.', inline: false },
      { name: '🌱 Crops', value: '🌾 Wheat → 🌽 Corn → 🍅 Tomato → 🍓 Strawberry → 🎃 Pumpkin → 🍇 Grape → 🍄 Truffle → 🐉 Dragon Fruit', inline: false },
    ],
  },
  realestate: {
    label: '🏠 Real Estate',
    emoji: '🏠',
    description: 'Buy properties and collect rent',
    color: 0xe67e22,
    fields: [
      { name: '`/realestate buy <type> <name>`', value: 'Buy a property.', inline: false },
      { name: '`/realestate list`', value: 'View all your properties.', inline: false },
      { name: '`/realestate collect <name>`', value: 'Collect rent from a property.', inline: false },
      { name: '`/realestate collectall`', value: 'Collect from all ready properties.', inline: false },
      { name: '`/realestate upgrade <name>`', value: 'Upgrade a property for more rent.', inline: false },
      { name: '`/realestate sell <name>`', value: 'Sell a property for 80% of value.', inline: false },
      { name: '🏘️ Property Types', value: '🏠 Apartment → 🏡 House → 🏘️ Villa → 🏢 Office → 🏙️ Skyscraper', inline: false },
    ],
  },
  clan: {
    label: '⚔️ Clans',
    emoji: '⚔️',
    description: 'Create and manage clans',
    color: 0x8e44ad,
    fields: [
      { name: '`/clan create <name> <tag>`', value: 'Create a clan for **$10,000**.', inline: false },
      { name: '`/clan invite @user`', value: 'Invite someone to your clan.', inline: false },
      { name: '`/clan deposit <amount>`', value: 'Add money to the clan bank.', inline: false },
      { name: '`/clan withdraw <amount>`', value: 'Withdraw from clan bank (Owner only).', inline: false },
      { name: '`/clan info`', value: 'View your clan dashboard.', inline: false },
      { name: '`/clan leaderboard`', value: 'Top clans by bank balance.', inline: false },
    ],
  },
  tournament: {
    label: '🏆 Tournament',
    emoji: '🏆',
    description: 'Compete in server tournaments',
    color: 0xf1c40f,
    fields: [
      { name: '`/tournament join`', value: 'Join the current open tournament.', inline: false },
      { name: '`/tournament info`', value: 'View current tournament details.', inline: false },
      { name: '`/tournament leaderboard`', value: 'Recent tournament winners.', inline: false },
      { name: 'Game Types', value: '🧠 **Trivia** — Answer questions first\n🔢 **Number Guess** — Guess 1–10\n⚡ **Reaction** — Type GO first', inline: false },
      { name: 'Admin Only', value: '`/tournament start` — Start tournament\n`/tournament begin` — Launch the game', inline: false },
    ],
  },
  lottery: {
    label: '🎟️ Lottery',
    emoji: '🎟️',
    description: 'Buy tickets and win the jackpot',
    color: 0xf39c12,
    fields: [
      { name: '`/lottery buy <amount>`', value: 'Buy tickets at **$500 each**. More tickets = better odds.', inline: false },
      { name: '`/lottery info`', value: 'View jackpot, your tickets and win odds.', inline: false },
      { name: '`/lottery draw`', value: 'Draw the winner (Admin only). Winner gets the full jackpot!', inline: false },
    ],
  },
  profile: {
    label: '🏆 Profile & Stats',
    emoji: '🏆',
    description: 'Profile, leaderboard and net worth',
    color: 0xffd700,
    fields: [
      { name: '`/profile [user]`', value: 'Full financial profile with all balances, holdings, level and stats.', inline: false },
      { name: '`/leaderboard [type]`', value: '💎 Net Worth | ⭐ Level | 🎰 Casino Wins', inline: false },
    ],
  },
};

function buildEmbed(categoryKey) {
  const cat = CATEGORIES[categoryKey];
  return new EmbedBuilder()
    .setColor(cat.color)
    .setTitle(`${cat.emoji} ${cat.label}`)
    .setDescription(cat.description)
    .addFields(cat.fields)
    .setFooter({ text: 'EconomyBot • Use the menu below to navigate' });
}

function buildSelectMenu(current) {
  const options = Object.entries(CATEGORIES).map(([key, cat]) => ({
    label: cat.label,
    description: cat.description,
    value: key,
    default: key === current,
    emoji: cat.emoji,
  }));

  // Discord limits 25 options per menu — split into 2 rows if needed
  const row1 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('help_menu')
      .setPlaceholder('📖 Select a category...')
      .addOptions(options.slice(0, 25))
  );

  return [row1];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Browse all bot commands and features'),

  async execute(interaction) {
    const startCategory = 'overview';
    const embed = buildEmbed(startCategory);
    const components = buildSelectMenu(startCategory);

    const reply = await interaction.reply({
      embeds: [embed],
      components,
      fetchReply: true,
    });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 5 * 60 * 1000,
      filter: (i) => i.user.id === interaction.user.id,
    });

    collector.on('collect', async (i) => {
      const selected = i.values[0];
      await i.update({
        embeds: [buildEmbed(selected)],
        components: buildSelectMenu(selected),
      });
    });

    collector.on('end', async () => {
      try { await reply.edit({ components: [] }); } catch {}
    });
  },
};