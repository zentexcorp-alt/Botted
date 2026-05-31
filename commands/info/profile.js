const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getOrCreateUser, formatMoney, formatPercent, priceChange, calcNetWorth } = require('../../utils/helpers');
const { xpForLevel } = require('../../utils/jobs');
const Asset = require('../../models/Asset');
const Clan = require('../../models/Clan');
const Production = require('../../models/Production');
const Warehouse = require('../../models/Warehouse');
const QuickChart = require('quickchart-js');
const Transaction = require('../../models/Transaction');

async function generateNetWorthGraph(userId) {
  try {
    const transactions = await Transaction.find({ userId }).sort({ timestamp: 1 }).limit(50);
    if (transactions.length < 2) return null;

    let running = 1000;
    const points = [running];
    for (const tx of transactions) {
      const isIncome = ['sell_crypto', 'sell_stock', 'sell_commodity', 'work', 'daily'].includes(tx.type);
      running += isIncome ? tx.total : -tx.total;
      running = Math.max(0, running);
      points.push(Math.round(running));
    }

    const isUp = points[points.length - 1] >= points[0];
    const chart = new QuickChart();
    chart.setWidth(600).setHeight(150).setBackgroundColor('#0d1117');
    chart.setConfig({
      type: 'line',
      data: {
        labels: points.map((_, i) => i),
        datasets: [{
          data: points,
          borderColor: isUp ? '#00ff88' : '#ff4545',
          backgroundColor: isUp ? 'rgba(0,255,136,0.08)' : 'rgba(255,69,69,0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2,
        }],
      },
      options: {
        legend: { display: false },
        scales: {
          xAxes: [{ display: false }],
          yAxes: [{ display: false }],
        },
      },
    });

    const res = await fetch(chart.getUrl());
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch { return null; }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your financial profile')
    .addUserOption((o) => o.setName('user').setDescription('User to view')),

  async execute(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser('user') || interaction.user;
    const user = await getOrCreateUser(target.id, target.username);

    const assets = await Asset.find({ active: true });
    const assetMap = {};
    assets.forEach((a) => (assetMap[a.symbol] = a));

    const netWorth = await calcNetWorth(user, assetMap);
    const clan = await Clan.findOne({ 'members.userId': target.id });
    const productions = await Production.find({ userId: target.id, active: true });
    const warehouse = await Warehouse.findOne({ userId: target.id });

    const xpPct = Math.floor((user.xp / user.xpToNextLevel) * 20);
    const xpBar = '▰'.repeat(xpPct) + '▱'.repeat(20 - xpPct);

    // Holdings value
    let holdingsValue = 0;
    user.cryptoHoldings.forEach((h) => { holdingsValue += h.quantity * (assetMap[h.symbol]?.currentPrice || 0); });
    user.stockHoldings.forEach((h) => { holdingsValue += h.quantity * (assetMap[h.symbol]?.currentPrice || 0); });
    user.commodityHoldings.forEach((h) => { holdingsValue += h.quantity * (assetMap[h.symbol]?.currentPrice || 0); });

    // Warehouse value
    let warehouseValue = 0;
    if (warehouse) {
      warehouse.items.forEach((i) => { warehouseValue += i.quantity * (assetMap[i.symbol]?.currentPrice || 0); });
    }

    const embed = new EmbedBuilder()
      .setColor(0x0d1117)
      .setAuthor({ name: `${target.username}'s Profile`, iconURL: target.displayAvatarURL() })
      .setThumbnail(target.displayAvatarURL())
      .setDescription([
        clan ? `⚔️ **[${clan.tag}] ${clan.name}**` : '⚔️ *No Clan*',
        `⭐ **Level ${user.level}** — \`${xpBar}\` ${user.xp}/${user.xpToNextLevel} XP`,
        `💼 **Job:** ${user.job || '*Unemployed*'}`,
        '',
        '```',
        `💎 NET WORTH    ${formatMoney(netWorth).padStart(20)}`,
        '```',
      ].join('\n'))
      .addFields(
        {
          name: '━━━ 💳 Accounts ━━━',
          value: [
            `🪙 **Wallet**         ${formatMoney(user.wallet)}`,
            `🏦 **Bank**           ${formatMoney(user.bank)}`,
            `📈 **Trading**        ${formatMoney(user.tradingAccount)}`,
          ].join('\n'),
          inline: false,
        },
        {
          name: '━━━ 📊 Assets ━━━',
          value: [
            `📦 **Holdings**       ${formatMoney(holdingsValue)}`,
            `🏭 **Warehouse**      ${formatMoney(warehouseValue)}`,
          ].join('\n'),
          inline: false,
        },
        {
          name: '━━━ 🏭 Production ━━━',
          value: productions.length > 0
            ? productions.map((p) => {
                const emoji = { oil_field: '🛢️', gas_field: '⛽', gold_mine: '🥇', silver_mine: '🥈', crop_farm: '🌾' }[p.type] || '🏭';
                return `${emoji} **${p.name}** — ${p.outputPerHour}/hr`;
              }).join('\n')
            : '*No production assets*',
          inline: false,
        },
        {
          name: '━━━ 📈 Stats ━━━',
          value: [
            `🔄 Trades: **${user.totalTrades}**`,
            `💸 Earned: **${formatMoney(user.totalEarned)}**`,
            `🛒 Spent: **${formatMoney(user.totalSpent)}**`,
          ].join('\n'),
          inline: false,
        }
      )
      .setFooter({ text: `MelonMarket • Member since ${user.createdAt.toDateString()}` });

    const graphBuffer = await generateNetWorthGraph(target.id);
    const files = [];

    if (graphBuffer) {
      const attachment = new AttachmentBuilder(graphBuffer, { name: 'graph.png' });
      embed.setImage('attachment://graph.png');
      files.push(attachment);
    }

    await interaction.editReply({ embeds: [embed], files });
  },
};