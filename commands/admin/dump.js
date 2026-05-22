const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Asset = require('../../models/Asset');
const { formatMoney, formatPercent } = require('../../utils/helpers');

const ADMIN_IDS = [
  '780449435199995925', // Replace with your Discord ID
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dump')
    .setDescription('Admin: Manipulate market prices')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub.setName('crash')
        .setDescription('Crash a specific asset price')
        .addStringOption((o) => o.setName('symbol').setDescription('Asset symbol').setRequired(true))
        .addNumberOption((o) => o.setName('percent').setDescription('Drop % (e.g. 50 = drop 50%)').setRequired(true).setMinValue(1).setMaxValue(99))
    )
    .addSubcommand((sub) =>
      sub.setName('pump')
        .setDescription('Pump a specific asset price')
        .addStringOption((o) => o.setName('symbol').setDescription('Asset symbol').setRequired(true))
        .addNumberOption((o) => o.setName('percent').setDescription('Pump % (e.g. 50 = increase 50%)').setRequired(true).setMinValue(1).setMaxValue(1000))
    )
    .addSubcommand((sub) =>
      sub.setName('crashall')
        .setDescription('Crash ALL assets at once')
        .addNumberOption((o) => o.setName('percent').setDescription('Drop % for all assets').setRequired(true).setMinValue(1).setMaxValue(99))
    )
    .addSubcommand((sub) =>
      sub.setName('pumpall')
        .setDescription('Pump ALL assets at once')
        .addNumberOption((o) => o.setName('percent').setDescription('Pump % for all assets').setRequired(true).setMinValue(1).setMaxValue(1000))
    )
    .addSubcommand((sub) =>
      sub.setName('settarget')
        .setDescription('Set a price target the algorithm pulls toward')
        .addStringOption((o) => o.setName('symbol').setDescription('Asset symbol').setRequired(true))
        .addNumberOption((o) => o.setName('price').setDescription('Target price').setRequired(true).setMinValue(0.000001))
        .addNumberOption((o) => o.setName('influence').setDescription('Pull strength 0.1 (gentle) to 1.0 (strong)').setRequired(true).setMinValue(0.1).setMaxValue(1))
    )
    .addSubcommand((sub) =>
      sub.setName('settrend')
        .setDescription('Set market trend for an asset')
        .addStringOption((o) => o.setName('symbol').setDescription('Asset symbol').setRequired(true))
        .addNumberOption((o) => o.setName('trend').setDescription('-1 = full bear, 0 = neutral, 1 = full bull').setRequired(true).setMinValue(-1).setMaxValue(1))
    )
    .addSubcommand((sub) =>
      sub.setName('freeze')
        .setDescription('Freeze or unfreeze an asset (disable trading)')
        .addStringOption((o) => o.setName('symbol').setDescription('Asset symbol').setRequired(true))
        .addBooleanOption((o) => o.setName('frozen').setDescription('True = freeze, False = unfreeze').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('status')
        .setDescription('View current market manipulation status of all assets')
    ),

  async execute(interaction) {
    if (!ADMIN_IDS.includes(interaction.user.id)) {
      return interaction.reply({ content: '❌ No permission.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();

    // ── CRASH ONE ────────────────────────────────────────────────────────────
    if (sub === 'crash') {
      const symbol = interaction.options.getString('symbol').toUpperCase();
      const percent = interaction.options.getNumber('percent');
      const asset = await Asset.findOne({ symbol });
      if (!asset) return interaction.editReply(`❌ Asset **${symbol}** not found.`);

      const oldPrice = asset.currentPrice;
      const newPrice = oldPrice * (1 - percent / 100);

      asset.previousPrice = oldPrice;
      asset.currentPrice = Math.max(newPrice, 0.00001);
      asset.trend = -1; // force bearish trend
      asset.priceHistory.push({
        open: oldPrice, high: oldPrice,
        low: asset.currentPrice, close: asset.currentPrice,
        timestamp: new Date(),
      });
      if (asset.priceHistory.length > 100) asset.priceHistory.shift();
      await asset.save();

      const embed = new EmbedBuilder()
        .setColor(0xff4545)
        .setTitle(`📉 ${symbol} Crashed!`)
        .addFields(
          { name: 'Before', value: formatMoney(oldPrice), inline: true },
          { name: 'After', value: formatMoney(asset.currentPrice), inline: true },
          { name: 'Drop', value: `-${percent}%`, inline: true }
        );

      return interaction.editReply({ embeds: [embed] });
    }

    // ── PUMP ONE ─────────────────────────────────────────────────────────────
    if (sub === 'pump') {
      const symbol = interaction.options.getString('symbol').toUpperCase();
      const percent = interaction.options.getNumber('percent');
      const asset = await Asset.findOne({ symbol });
      if (!asset) return interaction.editReply(`❌ Asset **${symbol}** not found.`);

      const oldPrice = asset.currentPrice;
      const newPrice = oldPrice * (1 + percent / 100);

      asset.previousPrice = oldPrice;
      asset.currentPrice = newPrice;
      asset.trend = 1; // force bullish trend
      asset.priceHistory.push({
        open: oldPrice, high: asset.currentPrice,
        low: oldPrice, close: asset.currentPrice,
        timestamp: new Date(),
      });
      if (asset.priceHistory.length > 100) asset.priceHistory.shift();
      await asset.save();

      const embed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle(`📈 ${symbol} Pumped!`)
        .addFields(
          { name: 'Before', value: formatMoney(oldPrice), inline: true },
          { name: 'After', value: formatMoney(asset.currentPrice), inline: true },
          { name: 'Gain', value: `+${percent}%`, inline: true }
        );

      return interaction.editReply({ embeds: [embed] });
    }

    // ── CRASH ALL ────────────────────────────────────────────────────────────
    if (sub === 'crashall') {
      const percent = interaction.options.getNumber('percent');
      const assets = await Asset.find({ active: true });

      for (const asset of assets) {
        const oldPrice = asset.currentPrice;
        asset.previousPrice = oldPrice;
        asset.currentPrice = Math.max(oldPrice * (1 - percent / 100), 0.00001);
        asset.trend = -1;
        asset.priceHistory.push({ open: oldPrice, high: oldPrice, low: asset.currentPrice, close: asset.currentPrice, timestamp: new Date() });
        if (asset.priceHistory.length > 100) asset.priceHistory.shift();
        await asset.save();
      }

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('💥 Market Crash!')
        .setDescription(`All **${assets.length}** assets crashed by **-${percent}%**!`)
        .setFooter({ text: 'Trend set to bearish for all assets' });

      return interaction.editReply({ embeds: [embed] });
    }

    // ── PUMP ALL ─────────────────────────────────────────────────────────────
    if (sub === 'pumpall') {
      const percent = interaction.options.getNumber('percent');
      const assets = await Asset.find({ active: true });

      for (const asset of assets) {
        const oldPrice = asset.currentPrice;
        asset.previousPrice = oldPrice;
        asset.currentPrice = oldPrice * (1 + percent / 100);
        asset.trend = 1;
        asset.priceHistory.push({ open: oldPrice, high: asset.currentPrice, low: oldPrice, close: asset.currentPrice, timestamp: new Date() });
        if (asset.priceHistory.length > 100) asset.priceHistory.shift();
        await asset.save();
      }

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🚀 Market Pump!')
        .setDescription(`All **${assets.length}** assets pumped by **+${percent}%**!`)
        .setFooter({ text: 'Trend set to bullish for all assets' });

      return interaction.editReply({ embeds: [embed] });
    }

    // ── SET TARGET ───────────────────────────────────────────────────────────
    if (sub === 'settarget') {
      const symbol = interaction.options.getString('symbol').toUpperCase();
      const price = interaction.options.getNumber('price');
      const influence = interaction.options.getNumber('influence');
      const asset = await Asset.findOne({ symbol });
      if (!asset) return interaction.editReply(`❌ Asset **${symbol}** not found.`);

      asset.adminPriceTarget = price;
      asset.adminInfluence = influence;
      await asset.save();

      const direction = price > asset.currentPrice ? '📈 UP' : '📉 DOWN';
      return interaction.editReply(`✅ **${symbol}** target set to **${formatMoney(price)}** (${direction}) with **${(influence * 100).toFixed(0)}%** pull strength. Algorithm will gradually move price there.`);
    }

    // ── SET TREND ────────────────────────────────────────────────────────────
    if (sub === 'settrend') {
      const symbol = interaction.options.getString('symbol').toUpperCase();
      const trend = interaction.options.getNumber('trend');
      const asset = await Asset.findOne({ symbol });
      if (!asset) return interaction.editReply(`❌ Asset **${symbol}** not found.`);

      asset.trend = trend;
      await asset.save();

      const label = trend > 0.3 ? '🟢 Bullish' : trend < -0.3 ? '🔴 Bearish' : '⚪ Neutral';
      return interaction.editReply(`✅ **${symbol}** trend set to **${trend}** (${label})`);
    }

    // ── FREEZE ───────────────────────────────────────────────────────────────
    if (sub === 'freeze') {
      const symbol = interaction.options.getString('symbol').toUpperCase();
      const frozen = interaction.options.getBoolean('frozen');
      const asset = await Asset.findOne({ symbol });
      if (!asset) return interaction.editReply(`❌ Asset **${symbol}** not found.`);

      asset.active = !frozen;
      await asset.save();

      return interaction.editReply(`${frozen ? '🔒 Frozen' : '🔓 Unfrozen'} **${symbol}**. Trading is now **${frozen ? 'disabled' : 'enabled'}**.`);
    }

    // ── STATUS ───────────────────────────────────────────────────────────────
    if (sub === 'status') {
      const assets = await Asset.find({}).sort({ type: 1 });

      const lines = assets.map((a) => {
        const trend = a.trend > 0.3 ? '🟢' : a.trend < -0.3 ? '🔴' : '⚪';
        const target = a.adminPriceTarget ? `→ ${formatMoney(a.adminPriceTarget)} (${(a.adminInfluence * 100).toFixed(0)}%)` : 'No target';
        const status = a.active ? '✅' : '🔒';
        return `${status} **${a.symbol}** ${trend} | Price: ${formatMoney(a.currentPrice)} | Target: ${target} | Volatility: ${(a.volatility * 100).toFixed(1)}%`;
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('📊 Market Control Panel')
        .setDescription(lines.join('\n') || 'No assets found');

      return interaction.editReply({ embeds: [embed] });
    }
  },
};