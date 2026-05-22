const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Asset = require('../../models/Asset');
const { formatMoney, formatPercent, priceChange } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('market')
    .setDescription('Full market overview — prices, gainers, losers and more')
    .addStringOption((o) =>
      o.setName('view').setDescription('What to view').setRequired(false)
        .addChoices(
          { name: '📊 Overview (default)', value: 'overview' },
          { name: '🟢 Top Gainers', value: 'gainers' },
          { name: '🔴 Top Losers', value: 'losers' },
          { name: '🔥 Most Traded', value: 'volume' },
          { name: '₿ Crypto Only', value: 'crypto' },
          { name: '📈 Stocks Only', value: 'stocks' }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const view = interaction.options.getString('view') || 'overview';
    const assets = await Asset.find({ active: true });

    if (assets.length === 0) return interaction.editReply('❌ No assets listed yet. Ask an admin to add some!');

    // Calculate changes
    const withChange = assets.map((a) => ({
      ...a.toObject(),
      change: priceChange(a.currentPrice, a.previousPrice),
      change24h: a.openPrice ? priceChange(a.currentPrice, a.openPrice) : 0,
    }));

    if (view === 'overview') {
      const cryptos = withChange.filter((a) => a.type === 'crypto').sort((a, b) => b.marketCap - a.marketCap).slice(0, 8);
      const stocks = withChange.filter((a) => a.type === 'stock').sort((a, b) => b.marketCap - a.marketCap).slice(0, 8);

      const totalMarketCap = withChange.reduce((a, x) => a + x.marketCap, 0);
      const totalVolume = withChange.reduce((a, x) => a + x.totalVolume24h, 0);
      const gainers = withChange.filter((a) => a.change24h > 0).length;
      const losers = withChange.filter((a) => a.change24h < 0).length;

      const cryptoLines = cryptos.map((a) => {
        const arrow = a.change24h >= 0 ? '🟢' : '🔴';
        return `${arrow} **${a.symbol}** ${formatMoney(a.currentPrice)} (${formatPercent(a.change24h)})`;
      }).join('\n');

      const stockLines = stocks.map((a) => {
        const arrow = a.change24h >= 0 ? '🟢' : '🔴';
        return `${arrow} **${a.symbol}** ${formatMoney(a.currentPrice)} (${formatPercent(a.change24h)})`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('📊 Market Overview')
        .addFields(
          { name: '💎 Total Market Cap', value: formatMoney(totalMarketCap), inline: true },
          { name: '📊 24h Volume', value: formatMoney(totalVolume), inline: true },
          { name: '🟢 Gainers / 🔴 Losers', value: `${gainers} / ${losers}`, inline: true },
          { name: '₿ Crypto', value: cryptoLines || 'None', inline: true },
          { name: '📈 Stocks', value: stockLines || 'None', inline: true },
        )
        .setFooter({ text: 'Prices update every minute • Use /market view for more options' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (view === 'gainers') {
      const top = withChange.sort((a, b) => b.change24h - a.change24h).slice(0, 10);
      const lines = top.map((a, i) => {
        const type = a.type === 'crypto' ? '₿' : '📈';
        return `**${i + 1}.** ${type} **${a.symbol}** — ${formatMoney(a.currentPrice)} | 🟢 **${formatPercent(a.change24h)}** | Vol: ${formatMoney(a.totalVolume24h)}`;
      });

      const embed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle('🟢 Top Gainers (24h)')
        .setDescription(lines.join('\n'))
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (view === 'losers') {
      const top = withChange.sort((a, b) => a.change24h - b.change24h).slice(0, 10);
      const lines = top.map((a, i) => {
        const type = a.type === 'crypto' ? '₿' : '📈';
        return `**${i + 1}.** ${type} **${a.symbol}** — ${formatMoney(a.currentPrice)} | 🔴 **${formatPercent(a.change24h)}** | Vol: ${formatMoney(a.totalVolume24h)}`;
      });

      const embed = new EmbedBuilder()
        .setColor(0xff4545)
        .setTitle('🔴 Top Losers (24h)')
        .setDescription(lines.join('\n'))
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (view === 'volume') {
      const top = withChange.sort((a, b) => b.totalVolume24h - a.totalVolume24h).slice(0, 10);
      const lines = top.map((a, i) => {
        const type = a.type === 'crypto' ? '₿' : '📈';
        const arrow = a.change24h >= 0 ? '🟢' : '🔴';
        return `**${i + 1}.** ${type} **${a.symbol}** — Vol: **${formatMoney(a.totalVolume24h)}** | ${arrow} ${formatPercent(a.change24h)}`;
      });

      const embed = new EmbedBuilder()
        .setColor(0xf7931a)
        .setTitle('🔥 Most Traded (24h Volume)')
        .setDescription(lines.join('\n'))
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (view === 'crypto') {
      const cryptos = withChange.filter((a) => a.type === 'crypto').sort((a, b) => b.marketCap - a.marketCap);
      const totalCap = cryptos.reduce((a, x) => a + x.marketCap, 0);

      const lines = cryptos.map((a, i) => {
        const arrow = a.change24h >= 0 ? '🟢' : '🔴';
        return `**${i + 1}.** **${a.symbol}** — ${formatMoney(a.currentPrice)} | ${arrow} ${formatPercent(a.change24h)} | MCap: ${formatMoney(a.marketCap)}`;
      });

      const embed = new EmbedBuilder()
        .setColor(0xf7931a)
        .setTitle('₿ Crypto Market')
        .setDescription(lines.join('\n'))
        .addFields({ name: '💎 Total Crypto Market Cap', value: formatMoney(totalCap), inline: false })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (view === 'stocks') {
      const stocks = withChange.filter((a) => a.type === 'stock').sort((a, b) => b.marketCap - a.marketCap);
      const totalCap = stocks.reduce((a, x) => a + x.marketCap, 0);

      // Group by sector
      const sectors = {};
      for (const s of stocks) {
        if (!sectors[s.sector]) sectors[s.sector] = [];
        sectors[s.sector].push(s);
      }

      const lines = stocks.map((a, i) => {
        const arrow = a.change24h >= 0 ? '🟢' : '🔴';
        return `**${i + 1}.** **${a.symbol}** (${a.sector}) — ${formatMoney(a.currentPrice)} | ${arrow} ${formatPercent(a.change24h)} | MCap: ${formatMoney(a.marketCap)}`;
      });

      const embed = new EmbedBuilder()
        .setColor(0x1e90ff)
        .setTitle('📈 Stock Market')
        .setDescription(lines.join('\n'))
        .addFields({ name: '💎 Total Stock Market Cap', value: formatMoney(totalCap), inline: false })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  },
};