const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');

const CATEGORIES = {
  overview: {
    label: '🏠 Overview',
    emoji: '🏠',
    description: 'Getting started',
    color: 0x5865f2,
    fields: [
      { name: '👋 Welcome to MelonMarket!', value: 'A full trading & commodity production game.\n\n**Quick Start:** Use `/start` to create your account!', inline: false },
      { name: '💳 Your 3 Accounts', value: '🪙 **Wallet** — Cash for everyday use\n🏦 **Bank** — Safe savings\n📈 **Trading Account** — For all trading', inline: false },
      { name: '🎮 What You Can Do', value: '• Trade stocks, crypto and commodities\n• Own oil fields, mines and crop farms\n• Store produced goods in your warehouse\n• Join clans, work jobs, level up\n• Win the lottery', inline: false },
    ],
  },
  economy: {
    label: '💰 Economy',
    emoji: '💰',
    description: 'Accounts, transfers, daily',
    color: 0x00d4aa,
    fields: [
      { name: '`/start`', value: 'Create your account — get $1,000 starter cash', inline: false },
      { name: '`/balance`', value: 'View all 3 account balances', inline: false },
      { name: '`/transfer <from> <to> <amount>`', value: 'Move funds between accounts', inline: false },
      { name: '`/daily`', value: 'Claim daily reward — scales with level', inline: false },
      { name: '`/gift @user <amount>`', value: 'Send money to another player', inline: false },
    ],
  },
  trading: {
    label: '📈 Trading',
    emoji: '📈',
    description: 'Stocks, crypto and commodities',
    color: 0x1e90ff,
    fields: [
      { name: '`/stocks list`', value: 'Browse all stocks', inline: false },
      { name: '`/stocks buy/sell <symbol> <shares>`', value: 'Trade stocks', inline: false },
      { name: '`/crypto list`', value: 'Browse all crypto', inline: false },
      { name: '`/crypto buy/sell <symbol> <quantity>`', value: 'Trade crypto', inline: false },
      { name: '`/commodities list`', value: 'Browse oil, gold, crops etc.', inline: false },
      { name: '`/commodities buy/sell <symbol> <qty>`', value: 'Trade commodities', inline: false },
      { name: '`/chart <symbol> [candle|mountain]`', value: 'View price chart with refresh button', inline: false },
      { name: '`/market`', value: 'Full market overview', inline: false },
      { name: '💡 Tip', value: 'Fund your Trading Account first with `/transfer wallet tradingAccount <amount>`', inline: false },
    ],
  },
  production: {
    label: '🏭 Production',
    emoji: '🏭',
    description: 'Oil fields, mines and farms',
    color: 0xe67e22,
    fields: [
      { name: '`/shop`', value: 'Browse production assets with live prices', inline: false },
      { name: '`/oilgas buy/collect/upgrade`', value: 'Manage oil and gas fields', inline: false },
      { name: '`/mines buy/collect/upgrade`', value: 'Manage gold and silver mines', inline: false },
      { name: '`/cropfarm buy/collect/upgrade/setcrop`', value: 'Manage crop farms', inline: false },
      { name: '`/warehouse`', value: 'View all produced goods', inline: false },
      { name: '💡 How It Works', value: 'Buy a field/mine/farm → It produces every hour → Collect to your warehouse → Sell at current market price with `/commodities sell <symbol> source:warehouse`', inline: false },
    ],
  },
  work: {
    label: '💼 Work',
    emoji: '💼',
    description: 'Jobs and leveling',
    color: 0xf39c12,
    fields: [
      { name: '`/work jobs`', value: 'See available jobs for your level', inline: false },
      { name: '`/work join <id>`', value: 'Join a job', inline: false },
      { name: '`/work do`', value: 'Work and earn money + XP', inline: false },
      { name: 'Job Tiers', value: '🧤 Beggar (Lv1) → 🛵 Delivery (Lv3) → 💻 Programmer (Lv8) → 👨‍⚕️ Doctor (Lv12) → 📈 Analyst (Lv15) → 👨‍💼 Lawyer (Lv20) → 🏢 CEO (Lv30)', inline: false },
    ],
  },
  clan: {
    label: '⚔️ Clans',
    emoji: '⚔️',
    description: 'Create and manage clans',
    color: 0x8e44ad,
    fields: [
      { name: '`/clan create <name> <tag>`', value: 'Create a clan ($10,000)', inline: false },
      { name: '`/clan invite @user`', value: 'Invite someone', inline: false },
      { name: '`/clan deposit/withdraw`', value: 'Manage clan bank', inline: false },
      { name: '`/clan info`', value: 'View clan dashboard', inline: false },
      { name: '`/clan leaderboard`', value: 'Top clans', inline: false },
    ],
  },
  profile: {
    label: '🏆 Profile',
    emoji: '🏆',
    description: 'Profile, portfolio and leaderboard',
    color: 0xffd700,
    fields: [
      { name: '`/profile [user]`', value: 'Full profile with net worth graph', inline: false },
      { name: '`/portfolio [type]`', value: 'Full trading portfolio breakdown', inline: false },
      { name: '`/leaderboard`', value: 'Server leaderboard', inline: false },
      { name: '`/history`', value: 'Your transaction history', inline: false },
    ],
  },
  lottery: {
    label: '🎟️ Lottery',
    emoji: '🎟️',
    description: 'Server lottery',
    color: 0xffd700,
    fields: [
      { name: '`/lottery buy <amount>`', value: 'Buy tickets at $500 each', inline: false },
      { name: '`/lottery info`', value: 'View jackpot and odds', inline: false },
      { name: '`/lottery draw`', value: 'Draw winner (Admin only)', inline: false },
    ],
  },
};

function buildEmbed(key) {
  const cat = CATEGORIES[key];
  return new EmbedBuilder()
    .setColor(cat.color)
    .setTitle(`${cat.emoji} ${cat.label}`)
    .setDescription(cat.description)
    .addFields(cat.fields)
    .setFooter({ text: 'MelonMarket • Use the menu to navigate' });
}

function buildMenu(current) {
  return [new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('help_menu')
      .setPlaceholder('📖 Select a category...')
      .addOptions(
        Object.entries(CATEGORIES).map(([key, cat]) => ({
          label: cat.label,
          description: cat.description,
          value: key,
          default: key === current,
          emoji: cat.emoji,
        }))
      )
  )];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Browse all MelonMarket commands'),

  async execute(interaction) {
    const start = 'overview';
    const reply = await interaction.reply({
      embeds: [buildEmbed(start)],
      components: buildMenu(start),
      fetchReply: true,
    });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 5 * 60 * 1000,
      filter: (i) => i.user.id === interaction.user.id,
    });

    collector.on('collect', async (i) => {
      const selected = i.values[0];
      await i.update({ embeds: [buildEmbed(selected)], components: buildMenu(selected) });
    });

    collector.on('end', async () => {
      try { await reply.edit({ components: [] }); } catch {}
    });
  },
};