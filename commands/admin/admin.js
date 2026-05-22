const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Asset = require('../../models/Asset');
const User = require('../../models/User');
const { formatMoney } = require('../../utils/helpers');

// ─── ADD YOUR DISCORD USER IDs HERE ──────────────────────────────────────────
const ADMIN_IDS = [
  '780449435199995925', 
  '863808531651100683', // Owner (replace with your Discord ID)
  // '987654321098765432', // Add more admins here
];
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Admin-only management commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommandGroup((group) =>
      group
        .setName('asset')
        .setDescription('Manage assets (stocks/crypto)')
        .addSubcommand((sub) =>
          sub
            .setName('add')
            .setDescription('Add a new stock or crypto')
            .addStringOption((o) => o.setName('symbol').setDescription('Ticker symbol (e.g. BTC)').setRequired(true))
            .addStringOption((o) => o.setName('name').setDescription('Full name').setRequired(true))
            .addStringOption((o) =>
              o
                .setName('type')
                .setDescription('Asset type')
                .setRequired(true)
                .addChoices({ name: 'Crypto', value: 'crypto' }, { name: 'Stock', value: 'stock' })
            )
            .addNumberOption((o) => o.setName('price').setDescription('Starting price (USD)').setRequired(true).setMinValue(0.000001))
            .addNumberOption((o) => o.setName('volatility').setDescription('Volatility (0.01=low, 0.2=high)').setMinValue(0.001).setMaxValue(1))
            .addStringOption((o) => o.setName('sector').setDescription('Sector/category'))
            .addStringOption((o) => o.setName('description').setDescription('Short description'))
            .addNumberOption((o) => o.setName('supply').setDescription('Total supply'))
        )
        .addSubcommand((sub) =>
          sub
            .setName('edit')
            .setDescription('Edit an existing asset')
            .addStringOption((o) => o.setName('symbol').setDescription('Symbol to edit').setRequired(true))
            .addNumberOption((o) => o.setName('price').setDescription('Set new current price'))
            .addNumberOption((o) => o.setName('volatility').setDescription('Set new volatility'))
            .addNumberOption((o) => o.setName('target').setDescription('Admin price target (gradually pulls price here)'))
            .addNumberOption((o) => o.setName('influence').setDescription('Strength of price target pull (0-1)').setMinValue(0).setMaxValue(1))
            .addNumberOption((o) => o.setName('trend').setDescription('Market trend (-1 bearish to 1 bullish)').setMinValue(-1).setMaxValue(1))
            .addBooleanOption((o) => o.setName('active').setDescription('Enable/disable trading'))
        )
        .addSubcommand((sub) =>
          sub
            .setName('addcandle')
            .setDescription('Manually inject a custom candlestick into price history')
            .addStringOption((o) => o.setName('symbol').setDescription('Symbol').setRequired(true))
            .addNumberOption((o) => o.setName('open').setDescription('Open price').setRequired(true))
            .addNumberOption((o) => o.setName('high').setDescription('High price').setRequired(true))
            .addNumberOption((o) => o.setName('low').setDescription('Low price').setRequired(true))
            .addNumberOption((o) => o.setName('close').setDescription('Close price').setRequired(true))
        )
        .addSubcommand((sub) =>
          sub
            .setName('list')
            .setDescription('List all assets')
        )
        .addSubcommand((sub) =>
          sub
            .setName('delete')
            .setDescription('Delete an asset')
            .addStringOption((o) => o.setName('symbol').setDescription('Symbol to delete').setRequired(true))
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName('user')
        .setDescription('Manage user accounts')
        .addSubcommand((sub) =>
          sub
            .setName('addmoney')
            .setDescription('Add money to a user account')
            .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
            .addStringOption((o) =>
              o
                .setName('account')
                .setDescription('Account')
                .setRequired(true)
                .addChoices(
                  { name: 'Wallet', value: 'wallet' },
                  { name: 'Bank', value: 'bank' },
                  { name: 'Crypto', value: 'cryptoBalance' },
                  { name: 'Stock', value: 'stockBalance' },
                  { name: 'Casino', value: 'casinoBalance' }
                )
            )
            .addNumberOption((o) => o.setName('amount').setDescription('Amount to add (use negative to remove)').setRequired(true))
        )
        .addSubcommand((sub) =>
          sub
            .setName('setlevel')
            .setDescription('Set a user\'s level')
            .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
            .addIntegerOption((o) => o.setName('level').setDescription('New level').setRequired(true).setMinValue(1))
        )
        .addSubcommand((sub) =>
          sub
            .setName('reset')
            .setDescription('Reset a user account')
            .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
        )
    ),

  async execute(interaction) {
    // ─── ADMIN CHECK ───────────────────────────────────────────────────────
    if (!ADMIN_IDS.includes(interaction.user.id)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });
    const group = interaction.options.getSubcommandGroup();
    const sub = interaction.options.getSubcommand();

    // ─── ASSET MANAGEMENT ────────────────────────────────────────────────────
    if (group === 'asset') {
      if (sub === 'add') {
        const symbol = interaction.options.getString('symbol').toUpperCase();
        const name = interaction.options.getString('name');
        const type = interaction.options.getString('type');
        const price = interaction.options.getNumber('price');
        const volatility = interaction.options.getNumber('volatility') || 0.05;
        const sector = interaction.options.getString('sector') || 'General';
        const description = interaction.options.getString('description') || '';
        const supply = interaction.options.getNumber('supply') || 1_000_000;

        const existing = await Asset.findOne({ symbol });
        if (existing) return interaction.editReply(`❌ Asset **${symbol}** already exists.`);

        const asset = await Asset.create({
          symbol, name, type, currentPrice: price, previousPrice: price,
          openPrice: price, volatility, sector, description,
          totalSupply: supply, circulatingSupply: supply / 2,
          marketCap: price * (supply / 2),
          priceHistory: [{ open: price, high: price, low: price, close: price, timestamp: new Date() }],
        });

        return interaction.editReply(`✅ Added **${asset.name} (${asset.symbol})** at ${formatMoney(price)} as a ${type}.`);
      }

      if (sub === 'edit') {
        const symbol = interaction.options.getString('symbol').toUpperCase();
        const asset = await Asset.findOne({ symbol });
        if (!asset) return interaction.editReply(`❌ Asset **${symbol}** not found.`);

        const updates = {};
        const price = interaction.options.getNumber('price');
        const volatility = interaction.options.getNumber('volatility');
        const target = interaction.options.getNumber('target');
        const influence = interaction.options.getNumber('influence');
        const trend = interaction.options.getNumber('trend');
        const active = interaction.options.getBoolean('active');

        if (price !== null) { updates.currentPrice = price; updates.previousPrice = asset.currentPrice; }
        if (volatility !== null) updates.volatility = volatility;
        if (target !== null) updates.adminPriceTarget = target;
        if (influence !== null) updates.adminInfluence = influence;
        if (trend !== null) updates.trend = trend;
        if (active !== null) updates.active = active;

        await Asset.updateOne({ symbol }, { $set: updates });
        const changed = Object.keys(updates).map((k) => `${k}: ${updates[k]}`).join(', ');
        return interaction.editReply(`✅ Updated **${symbol}**: ${changed}`);
      }

      if (sub === 'addcandle') {
        const symbol = interaction.options.getString('symbol').toUpperCase();
        const open = interaction.options.getNumber('open');
        const high = interaction.options.getNumber('high');
        const low = interaction.options.getNumber('low');
        const close = interaction.options.getNumber('close');

        const asset = await Asset.findOne({ symbol });
        if (!asset) return interaction.editReply(`❌ Asset **${symbol}** not found.`);

        asset.priceHistory.push({ open, high, low, close, timestamp: new Date() });
        if (asset.priceHistory.length > 100) asset.priceHistory.shift();
        asset.previousPrice = asset.currentPrice;
        asset.currentPrice = close;
        await asset.save();

        return interaction.editReply(`✅ Injected candle into **${symbol}**: O${formatMoney(open)} H${formatMoney(high)} L${formatMoney(low)} C${formatMoney(close)}`);
      }

      if (sub === 'list') {
        const assets = await Asset.find({}).sort({ type: 1, marketCap: -1 });
        if (assets.length === 0) return interaction.editReply('No assets found.');

        const cryptos = assets.filter((a) => a.type === 'crypto');
        const stocks = assets.filter((a) => a.type === 'stock');

        let desc = '**Cryptocurrencies:**\n';
        desc += cryptos.map((a) => `• ${a.symbol} — ${formatMoney(a.currentPrice)} | Vol: ${(a.volatility * 100).toFixed(1)}% | ${a.active ? '✅' : '❌'}`).join('\n') || 'None';
        desc += '\n\n**Stocks:**\n';
        desc += stocks.map((a) => `• ${a.symbol} (${a.name}) — ${formatMoney(a.currentPrice)} | Sector: ${a.sector} | ${a.active ? '✅' : '❌'}`).join('\n') || 'None';

        const embed = new EmbedBuilder().setColor(0x5865f2).setTitle('📊 All Assets').setDescription(desc);
        return interaction.editReply({ embeds: [embed] });
      }

      if (sub === 'delete') {
        const symbol = interaction.options.getString('symbol').toUpperCase();
        const result = await Asset.deleteOne({ symbol });
        if (result.deletedCount === 0) return interaction.editReply(`❌ Asset **${symbol}** not found.`);
        return interaction.editReply(`🗑️ Deleted asset **${symbol}**.`);
      }
    }

    // ─── USER MANAGEMENT ─────────────────────────────────────────────────────
    if (group === 'user') {
      const target = interaction.options.getUser('user');

      if (sub === 'addmoney') {
        const account = interaction.options.getString('account');
        const amount = interaction.options.getNumber('amount');
        const user = await User.findOne({ userId: target.id });
        if (!user) return interaction.editReply(`❌ User **${target.username}** has no account.`);

        user[account] += amount;
        await user.save();

        const LABEL = { wallet: 'Wallet', bank: 'Bank', cryptoBalance: 'Crypto', stockBalance: 'Stock', casinoBalance: 'Casino' };
        return interaction.editReply(`✅ ${amount >= 0 ? 'Added' : 'Removed'} **${formatMoney(Math.abs(amount))}** ${amount >= 0 ? 'to' : 'from'} **${target.username}**'s ${LABEL[account]}. New balance: **${formatMoney(user[account])}**`);
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
            wallet: 1000, bank: 0, cryptoBalance: 0, stockBalance: 0, casinoBalance: 0,
            cryptoHoldings: [], stockHoldings: [],
            level: 1, xp: 0, xpToNextLevel: 100, job: null,
            casinoWins: 0, casinoLosses: 0, casinoTotalWon: 0, casinoTotalLost: 0,
            totalEarned: 0, totalSpent: 0, totalTrades: 0,
          }
        );
        return interaction.editReply(`✅ Reset **${target.username}**'s account to defaults.`);
      }
    }
  },
};