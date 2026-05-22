const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ADMIN_IDS } = require('../../config');
const User = require('../../models/User');
const Asset = require('../../models/Asset');
const Transaction = require('../../models/Transaction');
const Business = require('../../models/Business');
const Clan = require('../../models/Clan');
const { formatMoney, calcNetWorth } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reports')
    .setDescription('Admin economy reports')
    .addSubcommand((sub) => sub.setName('daily').setDescription('Full economy report for today'))
    .addSubcommand((sub) =>
      sub.setName('user')
        .setDescription('Full report on one user')
        .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('assets').setDescription('All asset performance report'))
    .addSubcommand((sub) => sub.setName('top').setDescription('Top 10 earners, spenders and traders')),

  async execute(interaction) {
    if (!ADMIN_IDS.includes(interaction.user.id)) {
      return interaction.reply({ content: '❌ No permission.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();

    // ── DAILY REPORT ───────────────────────────────────────────────────────
    if (sub === 'daily') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const users = await User.find({});
      const assets = await Asset.find({ active: true });
      const businesses = await Business.find({});
      const clans = await Clan.find({});

      const todayTx = await Transaction.find({ timestamp: { $gte: today } });
      const todayEarned = todayTx.filter((t) => ['work', 'daily', 'casino_win', 'sell_crypto', 'sell_stock'].includes(t.type)).reduce((a, t) => a + t.total, 0);
      const todaySpent = todayTx.filter((t) => ['buy_crypto', 'buy_stock', 'casino_loss'].includes(t.type)).reduce((a, t) => a + t.total, 0);
      const todayTrades = todayTx.filter((t) => ['buy_crypto', 'sell_crypto', 'buy_stock', 'sell_stock'].includes(t.type)).length;

      const totalWallet = users.reduce((a, u) => a + u.wallet, 0);
      const totalBank = users.reduce((a, u) => a + u.bank, 0);
      const totalCrypto = users.reduce((a, u) => a + u.cryptoBalance, 0);
      const totalStock = users.reduce((a, u) => a + u.stockBalance, 0);
      const totalCasino = users.reduce((a, u) => a + u.casinoBalance, 0);
      const totalCirculation = totalWallet + totalBank + totalCrypto + totalStock + totalCasino;

      const newUsers = await User.countDocuments({ createdAt: { $gte: today } });

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📊 Daily Economy Report — ${new Date().toDateString()}`)
        .addFields(
          { name: '👥 Total Players', value: `${users.length} (+${newUsers} today)`, inline: true },
          { name: '🏢 Businesses', value: `${businesses.length}`, inline: true },
          { name: '⚔️ Clans', value: `${clans.length}`, inline: true },
          { name: '💰 Total in Circulation', value: formatMoney(totalCirculation), inline: false },
          { name: '🪙 Wallets', value: formatMoney(totalWallet), inline: true },
          { name: '🏦 Banks', value: formatMoney(totalBank), inline: true },
          { name: '₿ Crypto', value: formatMoney(totalCrypto), inline: true },
          { name: '📈 Stocks', value: formatMoney(totalStock), inline: true },
          { name: '🎰 Casino', value: formatMoney(totalCasino), inline: true },
          { name: '📊 Assets Listed', value: `${assets.length}`, inline: true },
          { name: "🔄 Today's Transactions", value: `${todayTx.length}`, inline: true },
          { name: "📈 Today's Trades", value: `${todayTrades}`, inline: true },
          { name: "💸 Today's Volume Earned", value: formatMoney(todayEarned), inline: true },
          { name: "🛒 Today's Volume Spent", value: formatMoney(todaySpent), inline: true },
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ── USER REPORT ────────────────────────────────────────────────────────
    if (sub === 'user') {
      const target = interaction.options.getUser('user');
      const user = await User.findOne({ userId: target.id });
      if (!user) return interaction.editReply(`❌ **${target.username}** has no account.`);

      const assets = await Asset.find({ active: true });
      const assetMap = {};
      assets.forEach((a) => (assetMap[a.symbol] = a));
      const netWorth = await calcNetWorth(user, assetMap);

      const allTx = await Transaction.find({ userId: target.id }).sort({ timestamp: -1 });
      const last7days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentTx = allTx.filter((t) => new Date(t.timestamp) >= last7days);

      const recentEarned = recentTx.filter((t) => ['work', 'daily', 'casino_win', 'sell_crypto', 'sell_stock'].includes(t.type)).reduce((a, t) => a + t.total, 0);
      const recentSpent = recentTx.filter((t) => ['buy_crypto', 'buy_stock', 'casino_loss'].includes(t.type)).reduce((a, t) => a + t.total, 0);

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📋 User Report — ${target.username}`)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: '⭐ Level', value: `${user.level}`, inline: true },
          { name: '💎 Net Worth', value: formatMoney(netWorth), inline: true },
          { name: '💼 Job', value: user.job || 'None', inline: true },
          { name: '🪙 Wallet', value: formatMoney(user.wallet), inline: true },
          { name: '🏦 Bank', value: formatMoney(user.bank), inline: true },
          { name: '₿ Crypto', value: formatMoney(user.cryptoBalance), inline: true },
          { name: '📈 Stocks', value: formatMoney(user.stockBalance), inline: true },
          { name: '🎰 Casino', value: formatMoney(user.casinoBalance), inline: true },
          { name: '📊 Total Trades', value: `${user.totalTrades}`, inline: true },
          { name: '💸 All Time Earned', value: formatMoney(user.totalEarned), inline: true },
          { name: '🛒 All Time Spent', value: formatMoney(user.totalSpent), inline: true },
          { name: '🎰 Casino W/L', value: `${user.casinoWins}W / ${user.casinoLosses}L`, inline: true },
          { name: '📅 Last 7 Days Earned', value: formatMoney(recentEarned), inline: true },
          { name: '📅 Last 7 Days Spent', value: formatMoney(recentSpent), inline: true },
          { name: '🔄 Last 7 Days Tx', value: `${recentTx.length}`, inline: true },
          { name: '📅 Member Since', value: user.createdAt.toDateString(), inline: false },
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ── ASSETS REPORT ──────────────────────────────────────────────────────
    if (sub === 'assets') {
      const assets = await Asset.find({}).sort({ totalVolume24h: -1 });
      if (assets.length === 0) return interaction.editReply('No assets found.');

      const cryptos = assets.filter((a) => a.type === 'crypto');
      const stocks = assets.filter((a) => a.type === 'stock');

      function assetLine(a) {
        const chg = a.previousPrice > 0 ? ((a.currentPrice - a.previousPrice) / a.previousPrice * 100).toFixed(2) : '0.00';
        const arrow = parseFloat(chg) >= 0 ? '🟢' : '🔴';
        return `${arrow} **${a.symbol}** — ${formatMoney(a.currentPrice)} (${chg}%) | Vol: ${formatMoney(a.totalVolume24h)} | ${a.active ? '✅' : '🔒'}`;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('📊 Asset Performance Report')
        .addFields(
          { name: '₿ Cryptocurrencies', value: cryptos.map(assetLine).join('\n') || 'None', inline: false },
          { name: '📈 Stocks', value: stocks.map(assetLine).join('\n') || 'None', inline: false },
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ── TOP REPORT ─────────────────────────────────────────────────────────
    if (sub === 'top') {
      const users = await User.find({});
      const assets = await Asset.find({ active: true });
      const assetMap = {};
      assets.forEach((a) => (assetMap[a.symbol] = a));

      // Top earners
      const topEarners = [...users].sort((a, b) => b.totalEarned - a.totalEarned).slice(0, 5)
        .map((u, i) => `${i + 1}. **${u.username}** — ${formatMoney(u.totalEarned)}`);

      // Top spenders
      const topSpenders = [...users].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5)
        .map((u, i) => `${i + 1}. **${u.username}** — ${formatMoney(u.totalSpent)}`);

      // Top traders
      const topTraders = [...users].sort((a, b) => b.totalTrades - a.totalTrades).slice(0, 5)
        .map((u, i) => `${i + 1}. **${u.username}** — ${u.totalTrades} trades`);

      // Top casino winners
      const topCasino = [...users].sort((a, b) => b.casinoTotalWon - a.casinoTotalWon).slice(0, 5)
        .map((u, i) => `${i + 1}. **${u.username}** — ${formatMoney(u.casinoTotalWon)}`);

      // Top levels
      const topLevels = [...users].sort((a, b) => b.level - a.level).slice(0, 5)
        .map((u, i) => `${i + 1}. **${u.username}** — Level ${u.level}`);

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('🏆 Top Players Report')
        .addFields(
          { name: '💸 Top Earners', value: topEarners.join('\n') || 'None', inline: true },
          { name: '🛒 Top Spenders', value: topSpenders.join('\n') || 'None', inline: true },
          { name: '📊 Top Traders', value: topTraders.join('\n') || 'None', inline: true },
          { name: '🎰 Top Casino Winners', value: topCasino.join('\n') || 'None', inline: true },
          { name: '⭐ Top Levels', value: topLevels.join('\n') || 'None', inline: true },
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  },
};