const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getOrCreateUser, formatMoney, formatPercent, priceChange } = require('../../utils/helpers');
const Asset = require('../../models/Asset');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('portfolio')
    .setDescription('View your full trading portfolio')
    .addStringOption((o) =>
      o.setName('type').setDescription('Filter by type').setRequired(false)
        .addChoices(
          { name: 'All', value: 'all' },
          { name: '₿ Crypto', value: 'crypto' },
          { name: '📈 Stocks', value: 'stocks' },
          { name: '🛢️ Commodities', value: 'commodities' },
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const filter = interaction.options.getString('type') || 'all';
    const user = await getOrCreateUser(interaction.user.id, interaction.user.username);

    const allSymbols = [
      ...user.cryptoHoldings.map((h) => h.symbol),
      ...user.stockHoldings.map((h) => h.symbol),
      ...user.commodityHoldings.map((h) => h.symbol),
    ];

    const assets = await Asset.find({ symbol: { $in: allSymbols }, active: true });
    const assetMap = {};
    assets.forEach((a) => (assetMap[a.symbol] = a));

    let totalValue = 0;
    let totalCost = 0;

    function buildSection(holdings, label, emoji) {
      const active = holdings.filter((h) => h.quantity > 0);
      if (active.length === 0) return null;

      const lines = [];
      let sectionValue = 0;
      let sectionCost = 0;

      for (const h of active) {
        const a = assetMap[h.symbol];
        if (!a) continue;
        const value = parseFloat((h.quantity * a.currentPrice).toFixed(2));
        const cost = parseFloat((h.quantity * h.avgBuyPrice).toFixed(2));
        const pnl = parseFloat((value - cost).toFixed(2));
        const pnlPct = priceChange(a.currentPrice, h.avgBuyPrice);
        const pnlEmoji = pnl >= 0 ? '🟢' : '🔴';
        sectionValue += value;
        sectionCost += cost;
        totalValue += value;
        totalCost += cost;

        lines.push(
          `${pnlEmoji} **${h.symbol}** — ${h.quantity.toFixed(4)} ${a.unit || 'units'}\n` +
          `   💰 ${formatMoney(value)} | Avg: ${formatMoney(h.avgBuyPrice)} | P&L: ${formatMoney(pnl)} (${formatPercent(pnlPct)})`
        );
      }

      const sectionPnl = sectionValue - sectionCost;
      lines.push(`\n*Section Total: ${formatMoney(sectionValue)} | P&L: ${formatMoney(sectionPnl)}*`);

      return { label: `${emoji} ${label}`, value: lines.join('\n') };
    }

    const sections = [];
    if (filter === 'all' || filter === 'crypto') {
      const s = buildSection(user.cryptoHoldings, 'Crypto', '₿');
      if (s) sections.push(s);
    }
    if (filter === 'all' || filter === 'stocks') {
      const s = buildSection(user.stockHoldings, 'Stocks', '📈');
      if (s) sections.push(s);
    }
    if (filter === 'all' || filter === 'commodities') {
      const s = buildSection(user.commodityHoldings, 'Commodities', '🛢️');
      if (s) sections.push(s);
    }

    if (sections.length === 0) {
      return interaction.editReply('📭 No holdings found. Start trading with `/crypto buy`, `/stocks buy` or `/commodities buy`!');
    }

    const totalPnl = parseFloat((totalValue - totalCost).toFixed(2));
    const totalPnlPct = totalCost > 0 ? ((totalPnl / totalCost) * 100) : 0;

    const embed = new EmbedBuilder()
      .setColor(totalPnl >= 0 ? 0x00ff88 : 0xff4545)
      .setAuthor({ name: `${interaction.user.username}'s Portfolio`, iconURL: interaction.user.displayAvatarURL() })
      .setDescription([
        '```',
        `Total Value    ${formatMoney(totalValue).padStart(20)}`,
        `Total Cost     ${formatMoney(totalCost).padStart(20)}`,
        `Total P&L      ${formatMoney(totalPnl).padStart(20)}`,
        `Return         ${formatPercent(totalPnlPct).padStart(20)}`,
        '```',
      ].join('\n'));

    for (const section of sections) {
      embed.addFields({ name: `━━━ ${section.label} ━━━`, value: section.value, inline: false });
    }

    embed.addFields({
      name: '━━━ 💳 Trading Account ━━━',
      value: formatMoney(user.tradingAccount),
      inline: false,
    });

    embed.setFooter({ text: 'MelonMarket • Use /transfer to fund your trading account' });

    return interaction.editReply({ embeds: [embed] });
  },
};