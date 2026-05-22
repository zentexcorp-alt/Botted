const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ADMIN_IDS } = require('../../config');
const User = require('../../models/User');
const BanList = require('../../models/BanList');
const Transaction = require('../../models/Transaction');
const Asset = require('../../models/Asset');
const { formatMoney, calcNetWorth } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('usermanage')
    .setDescription('Admin user management')
    .addSubcommand((sub) =>
      sub.setName('info')
        .setDescription('View full info on a user')
        .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('ban')
        .setDescription('Ban a user from using the bot')
        .addUserOption((o) => o.setName('user').setDescription('User to ban').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Reason for ban').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName('unban')
        .setDescription('Unban a user')
        .addUserOption((o) => o.setName('user').setDescription('User to unban').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('history')
        .setDescription('View last 10 transactions of a user')
        .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
    ),

  async execute(interaction) {
    if (!ADMIN_IDS.includes(interaction.user.id)) {
      return interaction.reply({ content: '❌ No permission.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser('user');

    // ── INFO ───────────────────────────────────────────────────────────────
    if (sub === 'info') {
      const user = await User.findOne({ userId: target.id });
      if (!user) return interaction.editReply(`❌ **${target.username}** has no account.`);

      const banned = await BanList.findOne({ userId: target.id });
      const assets = await Asset.find({ active: true });
      const assetMap = {};
      assets.forEach((a) => (assetMap[a.symbol] = a));
      const netWorth = await calcNetWorth(user, assetMap);

      const cryptoHoldings = user.cryptoHoldings.filter((h) => h.quantity > 0)
        .map((h) => `${h.symbol}: ${h.quantity.toFixed(4)}`).join(', ') || 'None';
      const stockHoldings = user.stockHoldings.filter((h) => h.quantity > 0)
        .map((h) => `${h.symbol}: ${h.quantity.toFixed(4)}`).join(', ') || 'None';

      const embed = new EmbedBuilder()
        .setColor(banned ? 0xff0000 : 0x5865f2)
        .setTitle(`👤 User Info — ${target.username}`)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: '🆔 User ID', value: target.id, inline: true },
          { name: '📅 Account Created', value: user.createdAt.toDateString(), inline: true },
          { name: '🔨 Banned', value: banned ? `✅ Yes — ${banned.reason}` : '❌ No', inline: true },
          { name: '⭐ Level', value: `${user.level}`, inline: true },
          { name: '💼 Job', value: user.job || 'None', inline: true },
          { name: '🔥 Work Streak', value: `${user.workStreak}`, inline: true },
          { name: '💰 Wallet', value: formatMoney(user.wallet), inline: true },
          { name: '🏦 Bank', value: formatMoney(user.bank), inline: true },
          { name: '₿ Crypto Bal', value: formatMoney(user.cryptoBalance), inline: true },
          { name: '📈 Stock Bal', value: formatMoney(user.stockBalance), inline: true },
          { name: '🎰 Casino Bal', value: formatMoney(user.casinoBalance), inline: true },
          { name: '💎 Net Worth', value: formatMoney(netWorth), inline: true },
          { name: '📊 Total Trades', value: `${user.totalTrades}`, inline: true },
          { name: '💸 Total Earned', value: formatMoney(user.totalEarned), inline: true },
          { name: '🛒 Total Spent', value: formatMoney(user.totalSpent), inline: true },
          { name: '🎰 Casino W/L', value: `${user.casinoWins}W / ${user.casinoLosses}L`, inline: true },
          { name: '₿ Crypto Holdings', value: cryptoHoldings, inline: false },
          { name: '📈 Stock Holdings', value: stockHoldings, inline: false },
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ── BAN ────────────────────────────────────────────────────────────────
    if (sub === 'ban') {
      if (ADMIN_IDS.includes(target.id)) {
        return interaction.editReply('❌ You cannot ban another admin.');
      }

      const reason = interaction.options.getString('reason') || 'No reason provided';
      const existing = await BanList.findOne({ userId: target.id });
      if (existing) return interaction.editReply(`❌ **${target.username}** is already banned.`);

      await BanList.create({
        userId: target.id,
        username: target.username,
        reason,
        bannedBy: interaction.user.id,
      });

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('🔨 User Banned')
        .addFields(
          { name: 'User', value: `${target.username} (${target.id})`, inline: true },
          { name: 'Reason', value: reason, inline: true },
          { name: 'Banned By', value: interaction.user.username, inline: true }
        );

      return interaction.editReply({ embeds: [embed] });
    }

    // ── UNBAN ──────────────────────────────────────────────────────────────
    if (sub === 'unban') {
      const banned = await BanList.findOne({ userId: target.id });
      if (!banned) return interaction.editReply(`❌ **${target.username}** is not banned.`);

      await BanList.deleteOne({ userId: target.id });

      return interaction.editReply(`✅ **${target.username}** has been unbanned and can use the bot again.`);
    }

    // ── HISTORY ────────────────────────────────────────────────────────────
    if (sub === 'history') {
      const transactions = await Transaction.find({ userId: target.id })
        .sort({ timestamp: -1 })
        .limit(10);

      if (transactions.length === 0) return interaction.editReply(`❌ No transactions found for **${target.username}**.`);

      const TYPE_EMOJI = {
        buy_crypto: '₿ Buy',
        sell_crypto: '₿ Sell',
        buy_stock: '📈 Buy',
        sell_stock: '📈 Sell',
        deposit: '🏦 Deposit',
        withdraw: '🏦 Withdraw',
        work: '💼 Work',
        daily: '🎁 Daily',
        casino_win: '🎰 Win',
        casino_loss: '🎰 Loss',
        interest: '💹 Interest',
        admin: '🛡️ Admin',
        transfer: '💸 Transfer',
      };

      const lines = transactions.map((t) => {
        const emoji = TYPE_EMOJI[t.type] || t.type;
        const symbol = t.symbol ? ` ${t.symbol}` : '';
        const date = new Date(t.timestamp).toLocaleDateString();
        return `\`${date}\` **${emoji}${symbol}** — ${formatMoney(t.total)}`;
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📋 Transaction History — ${target.username}`)
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'Last 10 transactions' });

      return interaction.editReply({ embeds: [embed] });
    }
  },
};