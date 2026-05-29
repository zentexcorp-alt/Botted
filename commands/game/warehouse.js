const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Warehouse = require('../../models/Warehouse');
const Asset = require('../../models/Asset');
const { getOrCreateUser, formatMoney } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warehouse')
    .setDescription('View your commodity warehouse')
    .addUserOption((o) => o.setName('user').setDescription('View another user\'s warehouse')),

  async execute(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser('user') || interaction.user;
    const user = await getOrCreateUser(target.id, target.username);

    const warehouse = await Warehouse.findOne({ userId: target.id });

    if (!warehouse || warehouse.items.length === 0) {
      return interaction.editReply('📭 Warehouse is empty! Collect from your oil fields, mines or farms to fill it up.');
    }

    const activeItems = warehouse.items.filter((i) => i.quantity > 0);
    if (activeItems.length === 0) return interaction.editReply('📭 Warehouse is empty!');

    const symbols = activeItems.map((i) => i.symbol);
    const assets = await Asset.find({ symbol: { $in: symbols } });
    const assetMap = {};
    assets.forEach((a) => (assetMap[a.symbol] = a));

    let totalValue = 0;
    const lines = activeItems.map((item) => {
      const asset = assetMap[item.symbol];
      const price = asset?.currentPrice || 0;
      const value = parseFloat((item.quantity * price).toFixed(2));
      totalValue += value;
      const emoji = {
        OIL: '🛢️', GAS: '⛽', XAU: '🥇', XAG: '🥈',
        CORN: '🌽', WEAT: '🌾', COFF: '☕',
      }[item.symbol] || '📦';
      return `${emoji} **${item.symbol}** — ${item.quantity.toFixed(4)} ${asset?.unit || 'units'} | Value: **${formatMoney(value)}** @ ${formatMoney(price)}/${asset?.unit || 'unit'}`;
    });

    const capacityPct = Math.floor((warehouse.usedCapacity / warehouse.capacity) * 100);
    const capBar = '█'.repeat(Math.floor(capacityPct / 10)) + '░'.repeat(10 - Math.floor(capacityPct / 10));

    const embed = new EmbedBuilder()
      .setColor(0xe67e22)
      .setTitle(`🏭 ${target.username}'s Warehouse`)
      .setDescription(lines.join('\n'))
      .addFields(
        { name: '💰 Total Value', value: formatMoney(totalValue), inline: true },
        { name: '📦 Capacity', value: `\`${capBar}\` ${capacityPct}%`, inline: true }
      )
      .setFooter({ text: 'Sell warehouse items with /commodities sell <symbol> source:warehouse' });

    return interaction.editReply({ embeds: [embed] });
  },
};