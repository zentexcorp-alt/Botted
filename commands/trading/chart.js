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
const { formatMoney, formatPercent, priceChange } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('chart')
    .setDescription('View price chart for any asset')
    .addStringOption((o) => o.setName('symbol').setDescription('Asset symbol').setRequired(true))
    .addStringOption((o) =>
      o.setName('type').setDescription('Chart type').setRequired(false)
        .addChoices(
          { name: '🕯️ Candlestick', value: 'candle' },
          { name: '⛰️ Mountain', value: 'mountain' }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const symbol = interaction.options.getString('symbol').toUpperCase();
    let currentType = interaction.options.getString('type') || 'candle';

    async function renderChart(inter, edit = false) {
      const asset = await Asset.findOne({ symbol, active: true });
      if (!asset) return inter.editReply(`❌ Asset **${symbol}** not found.`);
      if (asset.priceHistory.length < 2) return inter.editReply('⏳ Not enough price history yet.');

      const buffer = currentType === 'candle'
        ? await generateCandlestickChart(asset)
        : await generateMountainChart(asset);

      if (!buffer) return inter.editReply('❌ Failed to generate chart.');

      const attachment = new AttachmentBuilder(buffer, { name: `${symbol}_chart.png` });
      const chg = priceChange(asset.currentPrice, asset.previousPrice);
      const chg24 = asset.openPrice ? priceChange(asset.currentPrice, asset.openPrice) : 0;
      const arrow = chg >= 0 ? '📈' : '📉';

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`refresh_${symbol}`)
          .setLabel('🔄 Refresh')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`switch_${symbol}`)
          .setLabel(currentType === 'candle' ? '⛰️ Mountain' : '🕯️ Candlestick')
          .setStyle(ButtonStyle.Secondary),
      );

      const content = [
        `${arrow} **${asset.name} (${symbol})**`,
        `Price: **${formatMoney(asset.currentPrice)}** | 1m: **${formatPercent(chg)}** | 24h: **${formatPercent(chg24)}**`,
        `Type: **${currentType === 'candle' ? '🕯️ Candlestick' : '⛰️ Mountain'}**`,
      ].join('\n');

      return inter.editReply({ content, files: [attachment], components: [row] });
    }

    const reply = await renderChart(interaction);

    const collector = interaction.channel.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 10 * 60 * 1000,
      filter: (i) => i.user.id === interaction.user.id &&
        (i.customId === `refresh_${symbol}` || i.customId === `switch_${symbol}`),
    });

    collector.on('collect', async (i) => {
      await i.deferUpdate();
      if (i.customId === `switch_${symbol}`) {
        currentType = currentType === 'candle' ? 'mountain' : 'candle';
      }
      await renderChart(i);
    });

    collector.on('end', async () => {
      try {
        await interaction.editReply({ components: [] });
      } catch {}
    });
  },
};