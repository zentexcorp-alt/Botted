const {
  SlashCommandBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');
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

    async function generateAndSend(inter, edit = false) {
      const asset = await Asset.findOne({ symbol, active: true });
      if (!asset) return inter.editReply(`❌ Asset **${symbol}** not found.`);

      if (asset.priceHistory.length < 2) {
        return inter.editReply('⏳ Not enough price history yet. Try again in a few minutes.');
      }

      let buffer;
      if (chartType === 'candle') {
        buffer = await generateCandlestickChart(asset);
      } else {
        buffer = await generateMountainChart(asset);
      }

      if (!buffer) return inter.editReply('❌ Failed to generate chart.');

      const attachment = new AttachmentBuilder(buffer, { name: `${symbol}_chart.png` });

      const chg = asset.previousPrice > 0
        ? ((asset.currentPrice - asset.previousPrice) / asset.previousPrice * 100).toFixed(2)
        : '0.00';
      const arrow = parseFloat(chg) >= 0 ? '📈' : '📉';

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`refresh_chart_${symbol}_${chartType}`)
          .setLabel('🔄 Refresh')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`switch_chart_${symbol}_${chartType}`)
          .setLabel(chartType === 'candle' ? '⛰️ Switch to Mountain' : '🕯️ Switch to Candlestick')
          .setStyle(ButtonStyle.Secondary),
      );

      const content = `${arrow} **${asset.name} (${symbol})** — $${asset.currentPrice.toLocaleString()} (${chg}%) — ${chartType === 'candle' ? 'Candlestick' : 'Mountain'} Chart`;

      if (edit) {
        return inter.editReply({ content, files: [attachment], components: [row] });
      } else {
        return inter.editReply({ content, files: [attachment], components: [row] });
      }
    }

    const reply = await generateAndSend(interaction);

    // Collector for button clicks
    const collector = interaction.channel.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 10 * 60 * 1000, // 10 minutes
      filter: (i) =>
        (i.customId === `refresh_chart_${symbol}_${chartType}` ||
          i.customId === `switch_chart_${symbol}_${chartType}`) &&
        i.user.id === interaction.user.id,
    });

    let currentType = chartType;

    collector.on('collect', async (i) => {
      await i.deferUpdate();

      if (i.customId.startsWith('switch_chart_')) {
        currentType = currentType === 'candle' ? 'mountain' : 'candle';
      }

      const asset = await Asset.findOne({ symbol, active: true });
      if (!asset) return;

      let buffer;
      if (currentType === 'candle') {
        buffer = await generateCandlestickChart(asset);
      } else {
        buffer = await generateMountainChart(asset);
      }

      if (!buffer) return;

      const attachment = new AttachmentBuilder(buffer, { name: `${symbol}_chart.png` });

      const chg = asset.previousPrice > 0
        ? ((asset.currentPrice - asset.previousPrice) / asset.previousPrice * 100).toFixed(2)
        : '0.00';
      const arrow = parseFloat(chg) >= 0 ? '📈' : '📉';

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`refresh_chart_${symbol}_${currentType}`)
          .setLabel('🔄 Refresh')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`switch_chart_${symbol}_${currentType}`)
          .setLabel(currentType === 'candle' ? '⛰️ Switch to Mountain' : '🕯️ Switch to Candlestick')
          .setStyle(ButtonStyle.Secondary),
      );

      await i.editReply({
        content: `${arrow} **${asset.name} (${symbol})** — $${asset.currentPrice.toLocaleString()} (${chg}%) — ${currentType === 'candle' ? 'Candlestick' : 'Mountain'} Chart`,
        files: [attachment],
        components: [row],
      });
    });

    collector.on('end', async () => {
      try {
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('refresh_disabled')
            .setLabel('🔄 Refresh')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('switch_disabled')
            .setLabel('Switch Chart')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        );
        await interaction.editReply({ components: [disabledRow] });
      } catch {}
    });
  },
};