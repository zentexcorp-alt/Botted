const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Asset = require('../../models/Asset');
const { formatMoney, formatPercent, priceChange } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('news')
    .setDescription('Latest market news and price movements'),

  async execute(interaction) {
    await interaction.deferReply();
    const assets = await Asset.find({ active: true });

    if (assets.length === 0) return interaction.editReply('❌ No assets listed yet.');

    const withChange = assets.map((a) => ({
      ...a.toObject(),
      change: priceChange(a.currentPrice, a.previousPrice),
      change24h: a.openPrice ? priceChange(a.currentPrice, a.openPrice) : 0,
    }));

    // Sort by biggest absolute 24h change
    const sorted = [...withChange].sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h));

    const headlines = [];

    for (const a of sorted.slice(0, 8)) {
      const chg = a.change24h;
      const absChg = Math.abs(chg);

      if (absChg >= 20) {
        headlines.push(chg > 0
          ? `🚀 **${a.symbol}** exploded **+${absChg.toFixed(1)}%** — massive bull run underway!`
          : `💥 **${a.symbol}** crashed **-${absChg.toFixed(1)}%** — panic selling detected!`
        );
      } else if (absChg >= 10) {
        headlines.push(chg > 0
          ? `📈 **${a.symbol}** surged **+${absChg.toFixed(1)}%** — strong buying pressure!`
          : `📉 **${a.symbol}** dropped **-${absChg.toFixed(1)}%** — bears in control!`
        );
      } else if (absChg >= 5) {
        headlines.push(chg > 0
          ? `🟢 **${a.symbol}** up **+${absChg.toFixed(1)}%** — bullish momentum building.`
          : `🔴 **${a.symbol}** down **-${absChg.toFixed(1)}%** — selling pressure increasing.`
        );
      } else {
        headlines.push(chg > 0
          ? `⬆️ **${a.symbol}** slightly up **+${absChg.toFixed(1)}%** — quiet trading.`
          : `⬇️ **${a.symbol}** slightly down **-${absChg.toFixed(1)}%** — quiet trading.`
        );
      }
    }

    // Market summary
    const gainers = withChange.filter((a) => a.change24h > 0).length;
    const losers = withChange.filter((a) => a.change24h < 0).length;
    const totalMarketCap = withChange.reduce((a, x) => a + x.marketCap, 0);
    const biggestGainer = sorted.find((a) => a.change24h > 0);
    const biggestLoser = [...sorted].reverse().find((a) => a.change24h < 0);
    const mostTraded = [...withChange].sort((a, b) => b.totalVolume24h - a.totalVolume24h)[0];

    const sentiment = gainers > losers ? '🟢 Bullish' : gainers < losers ? '🔴 Bearish' : '⚪ Neutral';

    const embed = new EmbedBuilder()
      .setColor(0x1a1a2e)
      .setTitle('📰 Market News')
      .setDescription(headlines.join('\n\n'))
      .addFields(
        { name: '📊 Market Sentiment', value: sentiment, inline: true },
        { name: '🟢 Gainers', value: `${gainers}`, inline: true },
        { name: '🔴 Losers', value: `${losers}`, inline: true },
        { name: '💎 Total Market Cap', value: formatMoney(totalMarketCap), inline: true },
        { name: '🏆 Biggest Gainer', value: biggestGainer ? `${biggestGainer.symbol} +${biggestGainer.change24h.toFixed(1)}%` : 'N/A', inline: true },
        { name: '📉 Biggest Loser', value: biggestLoser ? `${biggestLoser.symbol} ${biggestLoser.change24h.toFixed(1)}%` : 'N/A', inline: true },
        { name: '🔥 Most Traded', value: mostTraded ? `${mostTraded.symbol} — ${formatMoney(mostTraded.totalVolume24h)}` : 'N/A', inline: true }
      )
      .setFooter({ text: 'Updated just now • Prices change every minute' })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};