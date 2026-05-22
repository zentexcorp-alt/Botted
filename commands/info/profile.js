const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getOrCreateUser, formatMoney, formatPercent, priceChange, calcNetWorth } = require('../../utils/helpers');
const { xpForLevel } = require('../../utils/jobs');
const Asset = require('../../models/Asset');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your full financial profile')
    .addUserOption((o) => o.setName('user').setDescription('User to view (default: yourself)')),

  async execute(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser('user') || interaction.user;
    const user = await getOrCreateUser(target.id, target.username);

    // Build asset map for net worth calculation
    const assets = await Asset.find({ active: true });
    const assetMap = {};
    assets.forEach((a) => (assetMap[a.symbol] = a));

    const netWorth = await calcNetWorth(user, assetMap);

    // Holdings summary
    const cryptoLines = user.cryptoHoldings
      .filter((h) => h.quantity > 0)
      .map((h) => {
        const price = assetMap[h.symbol]?.currentPrice || 0;
        const value = h.quantity * price;
        const pnlPct = priceChange(price, h.avgBuyPrice);
        return `• **${h.symbol}**: ${h.quantity.toFixed(4)} @ ${formatMoney(h.avgBuyPrice)} → ${formatMoney(value)} (${formatPercent(pnlPct)})`;
      });

    const stockLines = user.stockHoldings
      .filter((h) => h.quantity > 0)
      .map((h) => {
        const price = assetMap[h.symbol]?.currentPrice || 0;
        const value = h.quantity * price;
        const pnlPct = priceChange(price, h.avgBuyPrice);
        return `• **${h.symbol}**: ${h.quantity.toFixed(4)} sh @ ${formatMoney(h.avgBuyPrice)} → ${formatMoney(value)} (${formatPercent(pnlPct)})`;
      });

    // XP bar
    const xpPct = Math.floor((user.xp / user.xpToNextLevel) * 20);
    const xpBar = '█'.repeat(xpPct) + '░'.repeat(20 - xpPct);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📊 ${target.username}'s Profile`)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        {
          name: '💰 Balances',
          value: [
            `🪙 **Wallet:** ${formatMoney(user.wallet)}`,
            `🏦 **Bank:** ${formatMoney(user.bank)}`,
            `₿ **Crypto Account:** ${formatMoney(user.cryptoBalance)}`,
            `📈 **Stock Account:** ${formatMoney(user.stockBalance)}`,
            `🎰 **Casino Account:** ${formatMoney(user.casinoBalance)}`,
          ].join('\n'),
          inline: false,
        },
        {
          name: '🏆 Net Worth',
          value: `**${formatMoney(netWorth)}**`,
          inline: true,
        },
        {
          name: '⭐ Level',
          value: `**Level ${user.level}**\n\`${xpBar}\`\n${user.xp} / ${user.xpToNextLevel} XP`,
          inline: true,
        },
        {
          name: '💼 Job',
          value: user.job ? `**${user.job}**` : '*Unemployed*',
          inline: true,
        }
      );

    if (cryptoLines.length > 0) {
      embed.addFields({ name: '₿ Crypto Holdings', value: cryptoLines.join('\n'), inline: false });
    }
    if (stockLines.length > 0) {
      embed.addFields({ name: '📈 Stock Holdings', value: stockLines.join('\n'), inline: false });
    }

    embed.addFields({
      name: '🎰 Casino Stats',
      value: `Wins: **${user.casinoWins}** | Losses: **${user.casinoLosses}** | Total Won: **${formatMoney(user.casinoTotalWon)}**`,
      inline: false,
    });

    embed.setFooter({ text: `Total Trades: ${user.totalTrades} • Member since ${user.createdAt.toDateString()}` });

    await interaction.editReply({ embeds: [embed] });
  },
};
