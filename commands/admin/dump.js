const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Asset = require('../../models/Asset');
const { formatMoney, formatPercent } = require('../../utils/helpers');
const { ADMIN_IDS } = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dump')
    .setDescription('Admin market manipulation')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub.setName('crash').setDescription('Crash an asset')
        .addStringOption((o) => o.setName('symbol').setDescription('Symbol').setRequired(true))
        .addNumberOption((o) => o.setName('percent').setDescription('Drop %').setRequired(true).setMinValue(1).setMaxValue(99))
    )
    .addSubcommand((sub) =>
      sub.setName('pump').setDescription('Pump an asset')
        .addStringOption((o) => o.setName('symbol').setDescription('Symbol').setRequired(true))
        .addNumberOption((o) => o.setName('percent').setDescription('Pump %').setRequired(true).setMinValue(1).setMaxValue(1000))
    )
    .addSubcommand((sub) =>
      sub.setName('crashall').setDescription('Crash ALL assets')
        .addNumberOption((o) => o.setName('percent').setDescription('Drop %').setRequired(true).setMinValue(1).setMaxValue(99))
    )
    .addSubcommand((sub) =>
      sub.setName('pumpall').setDescription('Pump ALL assets')
        .addNumberOption((o) => o.setName('percent').setDescription('Pump %').setRequired(true).setMinValue(1).setMaxValue(1000))
    )
    .addSubcommand((sub) =>
      sub.setName('settarget').setDescription('Set admin price target')
        .addStringOption((o) => o.setName('symbol').setDescription('Symbol').setRequired(true))
        .addNumberOption((o) => o.setName('price').setDescription('Target price').setRequired(true).setMinValue(0.000001))
        .addNumberOption((o) => o.setName('influence').setDescription('Pull strength 0.1-1').setRequired(true).setMinValue(0.1).setMaxValue(1))
    )
    .addSubcommand((sub) =>
      sub.setName('settrend').setDescription('Set market trend')
        .addStringOption((o) => o.setName('symbol').setDescription('Symbol').setRequired(true))
        .addNumberOption((o) => o.setName('trend').setDescription('-1 bear to 1 bull').setRequired(true).setMinValue(-1).setMaxValue(1))
    )
    .addSubcommand((sub) =>
      sub.setName('freeze').setDescription('Freeze or unfreeze an asset')
        .addStringOption((o) => o.setName('symbol').setDescription('Symbol').setRequired(true))
        .addBooleanOption((o) => o.setName('frozen').setDescription('True=freeze').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('status').setDescription('Market control panel')),

  async execute(interaction) {
    if (!ADMIN_IDS.includes(interaction.user.id)) {
      return interaction.reply({ content: '❌ No permission.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();

    if (sub === 'crash') {
      const symbol = interaction.options.getString('symbol').toUpperCase();
      const percent = interaction.options.getNumber('percent');
      const asset = await Asset.findOne({ symbol });
      if (!asset) return interaction.editReply(`❌ **${symbol}** not found.`);

      const oldPrice = asset.currentPrice;
      asset.previousPrice = oldPrice;
      asset.currentPrice = Math.max(oldPrice * (1 - percent / 100), 0.00001);
      asset.trend = -1;
      asset.priceHistory.push({ open: oldPrice, high: oldPrice, low: asset.currentPrice, close: asset.currentPrice, timestamp: new Date() });
      if (asset.priceHistory.length > 100) asset.priceHistory.shift();
      await asset.save();

      return interaction.editReply(`📉 **${symbol}** crashed **-${percent}%**: ${formatMoney(oldPrice)} → ${formatMoney(asset.currentPrice)}`);
    }

    if (sub === 'pump') {
      const symbol = interaction.options.getString('symbol').toUpperCase();
      const percent = interaction.options.getNumber('percent');
      const asset = await Asset.findOne({ symbol });
      if (!asset) return interaction.editReply(`❌ **${symbol}** not found.`);

      const oldPrice = asset.currentPrice;
      asset.previousPrice = oldPrice;
      asset.currentPrice = oldPrice * (1 + percent / 100);
      asset.trend = 1;
      asset.priceHistory.push({ open: oldPrice, high: asset.currentPrice, low: oldPrice, close: asset.currentPrice, timestamp: new Date() });
      if (asset.priceHistory.length > 100) asset.priceHistory.shift();
      await asset.save();

      return interaction.editReply(`📈 **${symbol}** pumped **+${percent}%**: ${formatMoney(oldPrice)} → ${formatMoney(asset.currentPrice)}`);
    }

    if (sub === 'crashall') {
      const percent = interaction.options.getNumber('percent');
      const assets = await Asset.find({ active: true });
      for (const asset of assets) {
        asset.previousPrice = asset.currentPrice;
        asset.currentPrice = Math.max(asset.currentPrice * (1 - percent / 100), 0.00001);
        asset.trend = -1;
        asset.priceHistory.push({ open: asset.previousPrice, high: asset.previousPrice, low: asset.currentPrice, close: asset.currentPrice, timestamp: new Date() });
        if (asset.priceHistory.length > 100) asset.priceHistory.shift();
        await asset.save();
      }
      return interaction.editReply(`💥 All **${assets.length}** assets crashed **-${percent}%**!`);
    }

    if (sub === 'pumpall') {
      const percent = interaction.options.getNumber('percent');
      const assets = await Asset.find({ active: true });
      for (const asset of assets) {
        asset.previousPrice = asset.currentPrice;
        asset.currentPrice = asset.currentPrice * (1 + percent / 100);
        asset.trend = 1;
        asset.priceHistory.push({ open: asset.previousPrice, high: asset.currentPrice, low: asset.previousPrice, close: asset.currentPrice, timestamp: new Date() });
        if (asset.priceHistory.length > 100) asset.priceHistory.shift();
        await asset.save();
      }
      return interaction.editReply(`🚀 All **${assets.length}** assets pumped **+${percent}%**!`);
    }

    if (sub === 'settarget') {
      const symbol = interaction.options.getString('symbol').toUpperCase();
      const price = interaction.options.getNumber('price');
      const influence = interaction.options.getNumber('influence');
      const asset = await Asset.findOne({ symbol });
      if (!asset) return interaction.editReply(`❌ **${symbol}** not found.`);
      asset.adminPriceTarget = price;
      asset.adminInfluence = influence;
      await asset.save();
      const dir = price > asset.currentPrice ? '📈 UP' : '📉 DOWN';
      return interaction.editReply(`✅ **${symbol}** target: ${formatMoney(price)} (${dir}) | Pull: ${(influence * 100).toFixed(0)}%`);
    }

    if (sub === 'settrend') {
      const symbol = interaction.options.getString('symbol').toUpperCase();
      const trend = interaction.options.getNumber('trend');
      const asset = await Asset.findOne({ symbol });
      if (!asset) return interaction.editReply(`❌ **${symbol}** not found.`);
      asset.trend = trend;
      await asset.save();
      const label = trend > 0.3 ? '🟢 Bullish' : trend < -0.3 ? '🔴 Bearish' : '⚪ Neutral';
      return interaction.editReply(`✅ **${symbol}** trend: **${trend}** (${label})`);
    }

    if (sub === 'freeze') {
      const symbol = interaction.options.getString('symbol').toUpperCase();
      const frozen = interaction.options.getBoolean('frozen');
      const asset = await Asset.findOne({ symbol });
      if (!asset) return interaction.editReply(`❌ **${symbol}** not found.`);
      asset.active = !frozen;
      await asset.save();
      return interaction.editReply(`${frozen ? '🔒 Frozen' : '🔓 Unfrozen'} **${symbol}**.`);
    }

    if (sub === 'status') {
      const assets = await Asset.find({}).sort({ type: 1 });
      const lines = assets.map((a) => {
        const trend = a.trend > 0.3 ? '🟢' : a.trend < -0.3 ? '🔴' : '⚪';
        const target = a.adminPriceTarget ? `→ ${formatMoney(a.adminPriceTarget)}` : 'No target';
        return `${a.active ? '✅' : '🔒'} **${a.symbol}** ${trend} | ${formatMoney(a.currentPrice)} | ${target} | Vol: ${(a.volatility * 100).toFixed(1)}%`;
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('📊 Market Control Panel')
        .setDescription(lines.join('\n') || 'No assets');

      return interaction.editReply({ embeds: [embed] });
    }
  },
};