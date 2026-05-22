const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { generateCandlestickChart, generateMountainChart } = require('../../utils/chartGenerator');
const Asset = require('../../models/Asset');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('chart')
    .setDescription('View price chart for a crypto or stock')
    .addStringOption((o) => o.setName('symbol').setDescription('Asset symbol').setRequired(true))
    .addStringOption((o) =>
      o
        .setName('type')
        .setDescription('Chart type (default: candlestick)')
        .setRequired(false)
        .addChoices(
          { name: 'Candlestick', value: 'candle' },
          { name: 'Mountain', value: 'mountain' }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const symbol = interaction.options.getString('symbol').toUpperCase();
    const chartType = interaction.options.getString('type') || 'candle';

    const asset = await Asset.findOne({ symbol, active: true });
    if (!asset) return interaction.editReply(`❌ Asset **${symbol}** not found.`);

    if (asset.priceHistory.length < 2) {
      return interaction.editReply('⏳ Not enough price history yet. Try again after a few minutes.');
    }

    let buffer;
    if (chartType === 'candle') {
      buffer = await generateCandlestickChart(asset);
    } else {
      buffer = await generateMountainChart(asset);
    }

    if (!buffer) return interaction.editReply('❌ Failed to generate chart.');

    const attachment = new AttachmentBuilder(buffer, { name: `${symbol}_chart.png` });

    await interaction.editReply({
      content: `📊 **${asset.name} (${asset.symbol})** — ${chartType === 'candle' ? 'Candlestick' : 'Mountain'} Chart`,
      files: [attachment],
    });
  },
};
