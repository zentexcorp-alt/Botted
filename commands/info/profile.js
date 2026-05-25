const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getOrCreateUser, formatMoney, formatPercent, priceChange, calcNetWorth } = require('../../utils/helpers');
const { xpForLevel } = require('../../utils/jobs');
const { getTaxBracket } = require('../../utils/tax');
const { getActiveEvents } = require('../../utils/worldEvents');
const Asset = require('../../models/Asset');
const Clan = require('../../models/Clan');
const DailyStreak = require('../../models/DailyStreak');
const Transaction = require('../../models/Transaction');
const QuickChart = require('quickchart-js');

async function generateNetWorthGraph(userId) {
  try {
    const transactions = await Transaction.find({ userId })
      .sort({ timestamp: 1 })
      .limit(30);

    if (transactions.length < 2) return null;

    // Build net worth over time from transactions
    let running = 1000; // start balance
    const points = [{ t: transactions[0].timestamp, v: running }];

    for (const tx of transactions) {
      const isIncome = ['sell_crypto', 'sell_stock', 'casino_win', 'work', 'daily', 'interest'].includes(tx.type);
      running += isIncome ? tx.total : -tx.total;
      running = Math.max(0, running);
      points.push({ t: tx.timestamp, v: running });
    }

    const labels = points.map((_, i) => `${i + 1}`);
    const data = points.map((p) => Math.round(p.v));
    const isUp = data[data.length - 1] >= data[0];

    const chart = new QuickChart();
    chart.setWidth(600).setHeight(200).setBackgroundColor('#1a1a2e');
    chart.setConfig({
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: isUp ? 'rgb(0, 210, 110)' : 'rgb(255, 65, 65)',
          backgroundColor: isUp ? 'rgba(0, 210, 110, 0.1)' : 'rgba(255, 65, 65, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2,
        }],
      },
      options: {
        legend: { display: false },
        title: { display: true, text: 'Net Worth History', fontColor: '#e0e0e0', fontSize: 12 },
        scales: {
          xAxes: [{ ticks: { display: false }, gridLines: { display: false } }],
          yAxes: [{ ticks: { fontColor: '#aaa', callback: (v) => `$${Number(v).toLocaleString()}` }, gridLines: { color: 'rgba(255,255,255,0.05)' } }],
        },
      },
    });

    const url = chart.getUrl();
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your full financial profile')
    .addUserOption((o) => o.setName('user').setDescription('User to view')),

  async execute(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser('user') || interaction.user;
    const user = await getOrCreateUser(target.id, target.username);

    const assets = await Asset.find({ active: true });
    const assetMap = {};
    assets.forEach((a) => (assetMap[a.symbol] = a));

    const netWorth = await calcNetWorth(user, assetMap);

    // Get clan
    const clan = await Clan.findOne({ 'members.userId': target.id });
    const clanTag = clan ? `[${clan.tag}] ${clan.name}` : null;

    // Get streak
    const streak = await DailyStreak.findOne({ userId: target.id });

    // Tax bracket
    const taxBracket = getTaxBracket(netWorth);

    // XP bar
    const xpPct = Math.floor((user.xp / user.xpToNextLevel) * 15);
    const xpBar = '█'.repeat(xpPct) + '░'.repeat(15 - xpPct);

    // Holdings summary
    const cryptoHoldings = user.cryptoHoldings.filter((h) => h.quantity > 0);
    const stockHoldings = user.stockHoldings.filter((h) => h.quantity > 0);

    let totalHoldingsValue = 0;
    const cryptoLines = cryptoHoldings.map((h) => {
      const price = assetMap[h.symbol]?.currentPrice || 0;
      const value = h.quantity * price;
      const pnlPct = priceChange(price, h.avgBuyPrice);
      totalHoldingsValue += value;
      return `• **${h.symbol}**: ${h.quantity.toFixed(4)} | ${formatMoney(value)} (${formatPercent(pnlPct)})`;
    });

    const stockLines = stockHoldings.map((h) => {
      const price = assetMap[h.symbol]?.currentPrice || 0;
      const value = h.quantity * price;
      const pnlPct = priceChange(price, h.avgBuyPrice);
      totalHoldingsValue += value;
      return `• **${h.symbol}**: ${h.quantity.toFixed(2)} sh | ${formatMoney(value)} (${formatPercent(pnlPct)})`;
    });

    // Active world events
    const activeEvents = interaction.guildId ? await getActiveEvents(interaction.guildId) : [];
    const eventLines = activeEvents.map((e) => {
      const mins = Math.floor((new Date(e.endsAt) - Date.now()) / 60000);
      return `${e.name} — ${mins}m left`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📊 ${target.username}'s Profile`)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        // Clan tag and level
        {
          name: '⚔️ Clan',
          value: clanTag ? `**${clanTag}**` : '*No Clan*',
          inline: true,
        },
        {
          name: '⭐ Level',
          value: `**${user.level}**`,
          inline: true,
        },
        {
          name: '🔥 Daily Streak',
          value: streak ? `**${streak.currentStreak} days**` : '0 days',
          inline: true,
        },

        // XP Bar
        {
          name: `XP Progress`,
          value: `\`${xpBar}\` ${user.xp}/${user.xpToNextLevel}`,
          inline: false,
        },

        // Net worth (big and prominent)
        {
          name: '💎 Net Worth',
          value: `# ${formatMoney(netWorth)}`,
          inline: false,
        },

        // Balances
        {
          name: '💰 Balances',
          value: [
            `🪙 Wallet: **${formatMoney(user.wallet)}**`,
            `🏦 Bank: **${formatMoney(user.bank)}**`,
            `₿ Crypto: **${formatMoney(user.cryptoBalance)}**`,
            `📈 Stocks: **${formatMoney(user.stockBalance)}**`,
            `🎰 Casino: **${formatMoney(user.casinoBalance)}**`,
          ].join('\n'),
          inline: true,
        },

        // Stats
        {
          name: '📊 Stats',
          value: [
            `💼 Job: **${user.job || 'None'}**`,
            `🔄 Trades: **${user.totalTrades}**`,
            `💸 Earned: **${formatMoney(user.totalEarned)}**`,
            `🎰 Casino: **${user.casinoWins}W/${user.casinoLosses}L**`,
            `💳 Tax Bracket: **${taxBracket.label}**`,
          ].join('\n'),
          inline: true,
        },
      );

    // Holdings
    if (cryptoLines.length > 0) {
      embed.addFields({ name: '₿ Crypto Holdings', value: cryptoLines.join('\n'), inline: false });
    }
    if (stockLines.length > 0) {
      embed.addFields({ name: '📈 Stock Holdings', value: stockLines.join('\n'), inline: false });
    }

    // Active events
    if (eventLines.length > 0) {
      embed.addFields({ name: '🌍 Active World Events', value: eventLines.join('\n'), inline: false });
    }

    embed.setFooter({ text: `Member since ${user.createdAt.toDateString()} • Total Holdings Value: ${formatMoney(totalHoldingsValue)}` });

    // Generate net worth graph
    const graphBuffer = await generateNetWorthGraph(target.id);
    const files = [];

    if (graphBuffer) {
      const attachment = new AttachmentBuilder(graphBuffer, { name: 'networth_graph.png' });
      embed.setImage('attachment://networth_graph.png');
      files.push(attachment);
    }

    await interaction.editReply({ embeds: [embed], files });
  },
};