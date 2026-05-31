const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Asset = require('../../models/Asset');
const User = require('../../models/User');
const { formatMoney } = require('../../utils/helpers');
const { ADMIN_IDS } = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Admin management commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommandGroup((group) =>
      group.setName('asset').setDescription('Manage assets')
        .addSubcommand((sub) =>
          sub.setName('add').setDescription('Add new asset')
            .addStringOption((o) => o.setName('symbol').setDescription('Symbol').setRequired(true))
            .addStringOption((o) => o.setName('name').setDescription('Full name').setRequired(true))
            .addStringOption((o) =>
              o.setName('type').setDescription('Type').setRequired(true)
                .addChoices(
                  { name: 'Crypto', value: 'crypto' },
                  { name: 'Stock', value: 'stock' },
                  { name: 'Commodity', value: 'commodity' }
                )
            )
            .addNumberOption((o) => o.setName('price').setDescription('Starting price').setRequired(true).setMinValue(0.000001))
            .addNumberOption((o) => o.setName('volatility').setDescription('Volatility (0.01–0.5)').setMinValue(0.001).setMaxValue(1))
            .addStringOption((o) => o.setName('sector').setDescription('Sector'))
            .addStringOption((o) => o.setName('description').setDescription('Description'))
            .addStringOption((o) => o.setName('unit').setDescription('Unit (for commodities e.g. barrel, oz)'))
            .addStringOption((o) =>
              o.setName('category').setDescription('Commodity category')
                .addChoices(
                  { name: 'Energy', value: 'energy' },
                  { name: 'Metals', value: 'metals' },
                  { name: 'Agriculture', value: 'agriculture' },
                  { name: 'Industrial', value: 'industrial' }
                )
            )
            .addNumberOption((o) => o.setName('supply').setDescription('Total supply'))
            .addStringOption((o) => o.setName('image').setDescription('Image URL'))
        )
        .addSubcommand((sub) =>
          sub.setName('edit').setDescription('Edit an asset')
            .addStringOption((o) => o.setName('symbol').setDescription('Symbol').setRequired(true))
            .addNumberOption((o) => o.setName('price').setDescription('New price'))
            .addNumberOption((o) => o.setName('volatility').setDescription('New volatility'))
            .addNumberOption((o) => o.setName('target').setDescription('Admin price target'))
            .addNumberOption((o) => o.setName('influence').setDescription('Target pull strength 0-1').setMinValue(0).setMaxValue(1))
            .addNumberOption((o) => o.setName('trend').setDescription('Trend -1 to 1').setMinValue(-1).setMaxValue(1))
            .addBooleanOption((o) => o.setName('active').setDescription('Enable/disable'))
            .addStringOption((o) => o.setName('image').setDescription('Image URL'))
        )
        .addSubcommand((sub) =>
          sub.setName('addcandle').setDescription('Inject custom candlestick')
            .addStringOption((o) => o.setName('symbol').setDescription('Symbol').setRequired(true))
            .addNumberOption((o) => o.setName('open').setDescription('Open').setRequired(true))
            .addNumberOption((o) => o.setName('high').setDescription('High').setRequired(true))
            .addNumberOption((o) => o.setName('low').setDescription('Low').setRequired(true))
            .addNumberOption((o) => o.setName('close').setDescription('Close').setRequired(true))
        )
        .addSubcommand((sub) => sub.setName('list').setDescription('List all assets'))
        .addSubcommand((sub) =>
          sub.setName('delete').setDescription('Delete an asset')
            .addStringOption((o) => o.setName('symbol').setDescription('Symbol').setRequired(true))
        )
    )
    .addSubcommandGroup((group) =>
      group.setName('user').setDescription('Manage users')
        .addSubcommand((sub) =>
          sub.setName('addmoney').setDescription('Add money to user')
            .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
            .addStringOption((o) =>
              o.setName('account').setDescription('Account').setRequired(true)
                .addChoices(
                  { name: 'Wallet', value: 'wallet' },
                  { name: 'Bank', value: 'bank' },
                  { name: 'Trading Account', value: 'tradingAccount' }
                )
            )
            .addNumberOption((o) => o.setName('amount').setDescription('Amount').setRequired(true))
        )
        .addSubcommand((sub) =>
          sub.setName('setlevel').setDescription('Set user level')
            .addUserOption((o) => o.setName('user').setDescription('Target').setRequired(true))
            .addIntegerOption((o) => o.setName('level').setDescription('Level').setRequired(true).setMinValue(1))
        )
        .addSubcommand((sub) =>
          sub.setName('reset').setDescription('Reset user account')
            .addUserOption((o) => o.setName('user').setDescription('Target').setRequired(true))
        )
        .addSubcommand((sub) =>
          sub.setName('info').setDescription('View user info')
            .addUserOption((o) => o.setName('user').setDescription('Target').setRequired(true))
        )
    ),

  async execute(interaction) {
    if (!ADMIN_IDS.includes(interaction.user.id)) {
      return interaction.reply({ content: '❌ No permission.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const group = interaction.options.getSubcommandGroup();
    const sub = interaction.options.getSubcommand();

    if (group === 'asset') {
      if (sub === 'add') {
        const symbol = interaction.options.getString('symbol').toUpperCase();
        const name = interaction.options.getString('name');
        const type = interaction.options.getString('type');
        const price = interaction.options.getNumber('price');
        const volatility = interaction.options.getNumber('volatility') || 0.05;
        const sector = interaction.options.getString('sector') || 'General';
        const description = interaction.options.getString('description') || '';
        const unit = interaction.options.getString('unit') || 'unit';
        const commodityCategory = interaction.options.getString('category') || null;
        const supply = interaction.options.getNumber('supply') || 1_000_000;
        const imageUrl = interaction.options.getString('image') || null;

        const existing = await Asset.findOne({ symbol });
        if (existing) return interaction.editReply(`❌ **${symbol}** already exists.`);

        await Asset.create({
          symbol, name, type, currentPrice: price,
          previousPrice: price, openPrice: price,
          volatility, sector, description, unit,
          commodityCategory, imageUrl,
          active: true,
          totalSupply: supply, circulatingSupply: supply / 2,
          marketCap: price * (supply / 2),
          priceHistory: [{ open: price, high: price, low: price, close: price }],
        });

        return interaction.editReply(`✅ Added **${name} (${symbol})** at ${formatMoney(price)} as ${type}.`);
      }

      if (sub === 'edit') {
        const symbol = interaction.options.getString('symbol').toUpperCase();
        const asset = await Asset.findOne({ symbol });
        if (!asset) return interaction.editReply(`❌ **${symbol}** not found.`);

        const updates = {};
        const price = interaction.options.getNumber('price');
        const volatility = interaction.options.getNumber('volatility');
        const target = interaction.options.getNumber('target');
        const influence = interaction.options.getNumber('influence');
        const trend = interaction.options.getNumber('trend');
        const active = interaction.options.getBoolean('active');
        const image = interaction.options.getString('image');

        if (price !== null) { updates.currentPrice = price; updates.previousPrice = asset.currentPrice; }
        if (volatility !== null) updates.volatility = volatility;
        if (target !== null) updates.adminPriceTarget = target;
        if (influence !== null) updates.adminInfluence = influence;
        if (trend !== null) updates.trend = trend;
        if (active !== null) updates.active = active;
        if (image !== null) updates.imageUrl = image;

        await Asset.updateOne({ symbol }, { $set: updates });
        return interaction.editReply(`✅ Updated **${symbol}**: ${Object.keys(updates).join(', ')}`);
      }

      if (sub === 'addcandle') {
        const symbol = interaction.options.getString('symbol').toUpperCase();
        const asset = await Asset.findOne({ symbol });
        if (!asset) return interaction.editReply(`❌ **${symbol}** not found.`);

        const open = interaction.options.getNumber('open');
        const high = interaction.options.getNumber('high');
        const low = interaction.options.getNumber('low');
        const close = interaction.options.getNumber('close');

        asset.priceHistory.push({ open, high, low, close, timestamp: new Date() });
        if (asset.priceHistory.length > 100) asset.priceHistory.shift();
        asset.previousPrice = asset.currentPrice;
        asset.currentPrice = close;
        await asset.save();

        return interaction.editReply(`✅ Injected candle into **${symbol}** — Close: ${formatMoney(close)}`);
      }

      if (sub === 'list') {
        const assets = await Asset.find({}).sort({ type: 1 });
        if (assets.length === 0) return interaction.editReply('No assets found.');

        const grouped = { crypto: [], stock: [], commodity: [] };
        assets.forEach((a) => grouped[a.type]?.push(a));

        let desc = '';
        for (const [type, list] of Object.entries(grouped)) {
          if (list.length === 0) continue;
          desc += `\n**${type.toUpperCase()}**\n`;
          desc += list.map((a) => `• ${a.symbol} — ${formatMoney(a.currentPrice)} | Vol: ${(a.volatility * 100).toFixed(1)}% | ${a.active ? '✅' : '🔒'}`).join('\n');
        }

        const embed = new EmbedBuilder().setColor(0x5865f2).setTitle('📊 All Assets').setDescription(desc);
        return interaction.editReply({ embeds: [embed] });
      }

      if (sub === 'delete') {
        const symbol = interaction.options.getString('symbol').toUpperCase();
        const result = await Asset.deleteOne({ symbol });
        if (result.deletedCount === 0) return interaction.editReply(`❌ **${symbol}** not found.`);
        return interaction.editReply(`🗑️ Deleted **${symbol}**.`);
      }
    }

    if (group === 'user') {
      const target = interaction.options.getUser('user');

      if (sub === 'addmoney') {
        const account = interaction.options.getString('account');
        const amount = interaction.options.getNumber('amount');
        const user = await User.findOne({ userId: target.id });
        if (!user) return interaction.editReply(`❌ User not found.`);
        user[account] += amount;
        await user.save();
        const labels = { wallet: 'Wallet', bank: 'Bank', tradingAccount: 'Trading Account' };
        return interaction.editReply(`✅ ${amount >= 0 ? 'Added' : 'Removed'} **${formatMoney(Math.abs(amount))}** to **${target.username}**'s ${labels[account]}. New: **${formatMoney(user[account])}**`);
      }

      if (sub === 'setlevel') {
        const level = interaction.options.getInteger('level');
        const { xpForLevel } = require('../../utils/jobs');
        const user = await User.findOne({ userId: target.id });
        if (!user) return interaction.editReply(`❌ User not found.`);
        user.level = level;
        user.xp = 0;
        user.xpToNextLevel = xpForLevel(level);
        await user.save();
        return interaction.editReply(`✅ Set **${target.username}** to Level **${level}**.`);
      }

      if (sub === 'reset') {
        await User.findOneAndUpdate(
          { userId: target.id },
          {
            wallet: 1000, bank: 0, tradingAccount: 0,
            cryptoHoldings: [], stockHoldings: [], commodityHoldings: [],
            level: 1, xp: 0, xpToNextLevel: 100, job: null,
            totalEarned: 0, totalSpent: 0, totalTrades: 0,
          }
        );
        return interaction.editReply(`✅ Reset **${target.username}**'s account.`);
      }

      if (sub === 'info') {
        const user = await User.findOne({ userId: target.id });
        if (!user) return interaction.editReply(`❌ User not found.`);

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`👤 ${target.username}`)
          .setThumbnail(target.displayAvatarURL())
          .addFields(
            { name: '🆔 ID', value: target.id, inline: true },
            { name: '⭐ Level', value: `${user.level}`, inline: true },
            { name: '💼 Job', value: user.job || 'None', inline: true },
            { name: '🪙 Wallet', value: formatMoney(user.wallet), inline: true },
            { name: '🏦 Bank', value: formatMoney(user.bank), inline: true },
            { name: '📈 Trading', value: formatMoney(user.tradingAccount), inline: true },
            { name: '🔄 Trades', value: `${user.totalTrades}`, inline: true },
            { name: '💸 Earned', value: formatMoney(user.totalEarned), inline: true },
            { name: '📅 Joined', value: user.createdAt.toDateString(), inline: true },
          );

        return interaction.editReply({ embeds: [embed] });
      }
    }
  },
};