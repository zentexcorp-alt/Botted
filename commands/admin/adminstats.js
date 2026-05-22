const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const User = require('../../models/User');
const Asset = require('../../models/Asset');
const Business = require('../../models/Business');
const Clan = require('../../models/Clan');
const Transaction = require('../../models/Transaction');
const { formatMoney } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('adminstats')
    .setDescription('View server economy statistics (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Admins only.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const users = await User.find({});
    const assets = await Asset.find({ active: true });
    const businesses = await Business.find({});
    const clans = await Clan.find({});
    const recentTx = await Transaction.countDocuments({ timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } });

    const totalWallet = users.reduce((a, u) => a + u.wallet, 0);
    const totalBank = users.reduce((a, u) => a + u.bank, 0);
    const totalCrypto = users.reduce((a, u) => a + u.cryptoBalance, 0);
    const totalStock = users.reduce((a, u) => a + u.stockBalance, 0);
    const totalCasino = users.reduce((a, u) => a + u.casinoBalance, 0);
    const totalMoney = totalWallet + totalBank + totalCrypto + totalStock + totalCasino;

    const richest = users.sort((a, b) => (b.wallet + b.bank) - (a.wallet + a.bank))[0];
    const highestLevel = users.sort((a, b) => b.level - a.level)[0];
    const mostTraded = assets.sort((a, b) => b.totalVolume24h - a.totalVolume24h)[0];

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('📊 Server Economy Stats')
      .addFields(
        { name: '👥 Total Players', value: `${users.length}`, inline: true },
        { name: '🏢 Businesses', value: `${businesses.length}`, inline: true },
        { name: '⚔️ Clans', value: `${clans.length}`, inline: true },
        { name: '💰 Total Money in Circulation', value: formatMoney(totalMoney), inline: false },
        { name: '🪙 In Wallets', value: formatMoney(totalWallet), inline: true },
        { name: '🏦 In Banks', value: formatMoney(totalBank), inline: true },
        { name: '₿ In Crypto', value: formatMoney(totalCrypto), inline: true },
        { name: '📈 In Stocks', value: formatMoney(totalStock), inline: true },
        { name: '🎰 In Casino', value: formatMoney(totalCasino), inline: true },
        { name: '📊 Assets Listed', value: `${assets.length}`, inline: true },
        { name: '🔄 Transactions (24h)', value: `${recentTx}`, inline: true },
        { name: '🏆 Richest Player', value: richest ? richest.username : 'N/A', inline: true },
        { name: '⭐ Highest Level', value: highestLevel ? `${highestLevel.username} (Lv${highestLevel.level})` : 'N/A', inline: true },
        { name: '📈 Most Traded Asset (24h)', value: mostTraded ? `${mostTraded.symbol} — ${formatMoney(mostTraded.totalVolume24h)}` : 'N/A', inline: true }
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};