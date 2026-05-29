const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getOrCreateUser, formatMoney, formatPercent, priceChange } = require('../../utils/helpers');
const { recordTradePressure } = require('../../utils/marketEngine');
const { getOrCreateWarehouse, addToWarehouse } = require('../../utils/productionEngine');
const Asset = require('../../models/Asset');
const Warehouse = require('../../models/Warehouse');
const Transaction = require('../../models/Transaction');
const { checkLevelUp } = require('../../utils/jobs');

const CATEGORY_EMOJI = {
  energy: '⚡',
  metals: '🪨',
  agriculture: '🌾',
  industrial: '🔩',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('commodities')
    .setDescription('Commodity trading — oil, gold, crops and more')
    .addSubcommand((sub) => sub.setName('list').setDescription('List all commodities'))
    .addSubcommand((sub) =>
      sub.setName('price')
        .setDescription('Check commodity price')
        .addStringOption((o) => o.setName('symbol').setDescription('Symbol').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('buy')
        .setDescription('Buy commodities (goes to trading account holdings)')
        .addStringOption((o) => o.setName('symbol').setDescription('Symbol').setRequired(true))
        .addNumberOption((o) => o.setName('quantity').setDescription('Quantity to buy').setRequired(true).setMinValue(0.01))
    )
    .addSubcommand((sub) =>
      sub.setName('sell')
        .setDescription('Sell commodities from your holdings or warehouse')
        .addStringOption((o) => o.setName('symbol').setDescription('Symbol').setRequired(true))
        .addNumberOption((o) => o.setName('quantity').setDescription('Quantity to sell').setRequired(true).setMinValue(0.01))
        .addStringOption((o) =>
          o.setName('source').setDescription('Sell from holdings or warehouse').setRequired(false)
            .addChoices(
              { name: '📊 Holdings (bought on market)', value: 'holdings' },
              { name: '🏭 Warehouse (produced)', value: 'warehouse' }
            )
        )
    )
    .addSubcommand((sub) => sub.setName('portfolio').setDescription('Your commodity holdings')),

  async execute(interaction) {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      const assets = await Asset.find({ type: 'commodity', active: true }).sort({ commodityCategory: 1 });
      if (assets.length === 0) return interaction.editReply('❌ No commodities listed yet.');

      const categories = {};
      for (const a of assets) {
        const cat = a.commodityCategory || 'other';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(a);
      }

      const embed = new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle('🛢️ Commodities Market')
        .setFooter({ text: 'Prices update every minute' })
        .setTimestamp();

      for (const [cat, catAssets] of Object.entries(categories)) {
        const emoji = CATEGORY_EMOJI[cat] || '📦';
        const lines = catAssets.map((a) => {
          const chg = priceChange(a.currentPrice, a.previousPrice);
          return `${chg >= 0 ? '🟢' : '🔴'} **${a.symbol}** (${a.name}) — ${formatMoney(a.currentPrice)}/${a.unit} (${formatPercent(chg)})`;
        });
        embed.addFields({ name: `${emoji} ${cat.charAt(0).toUpperCase() + cat.slice(1)}`, value: lines.join('\n'), inline: false });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'price') {
      const symbol = interaction.options.getString('symbol').toUpperCase();
      const asset = await Asset.findOne({ symbol, type: 'commodity', active: true });
      if (!asset) return interaction.editReply(`❌ Commodity **${symbol}** not found.`);

      const chg = priceChange(asset.currentPrice, asset.previousPrice);
      const chg24 = asset.openPrice ? priceChange(asset.currentPrice, asset.openPrice) : 0;

      const embed = new EmbedBuilder()
        .setColor(chg >= 0 ? 0x00ff88 : 0xff4545)
        .setTitle(`${CATEGORY_EMOJI[asset.commodityCategory] || '📦'} ${asset.name} (${asset.symbol})`)
        .addFields(
          { name: 'Price', value: `${formatMoney(asset.currentPrice)} / ${asset.unit}`, inline: true },
          { name: '1m Change', value: formatPercent(chg), inline: true },
          { name: '24h Change', value: formatPercent(chg24), inline: true },
          { name: 'Category', value: asset.commodityCategory || 'N/A', inline: true },
          { name: '24h Volume', value: formatMoney(asset.totalVolume24h), inline: true },
          { name: 'Volatility', value: `${(asset.volatility * 100).toFixed(1)}%`, inline: true },
          { name: 'Description', value: asset.description || 'N/A', inline: false }
        );

      if (asset.imageUrl) embed.setThumbnail(asset.imageUrl);
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'buy') {
      const symbol = interaction.options.getString('symbol').toUpperCase();
      const quantity = interaction.options.getNumber('quantity');
      const user = await getOrCreateUser(interaction.user.id, interaction.user.username);
      const asset = await Asset.findOne({ symbol, type: 'commodity', active: true });

      if (!asset) return interaction.editReply(`❌ Commodity **${symbol}** not found.`);

      const totalCost = parseFloat((quantity * asset.currentPrice).toFixed(2));
      const maxCanBuy = parseFloat((user.tradingAccount / asset.currentPrice).toFixed(2));

      if (user.tradingAccount < totalCost) {
        return interaction.editReply(
          `❌ Insufficient funds!\n\n` +
          `🛒 You want: **${quantity} ${symbol}** = **${formatMoney(totalCost)}**\n` +
          `📈 Trading Account: **${formatMoney(user.tradingAccount)}**\n` +
          `📊 Max: **${maxCanBuy} ${asset.unit}**\n\n` +
          `💡 Use \`/transfer\` to fund your Trading Account.`
        );
      }

      let holding = user.commodityHoldings.find((h) => h.symbol === symbol);
      if (!holding) {
        user.commodityHoldings.push({ symbol, quantity: 0, avgBuyPrice: 0 });
        holding = user.commodityHoldings[user.commodityHoldings.length - 1];
      }

      const totalCostNew = holding.quantity * holding.avgBuyPrice + totalCost;
      const totalQty = parseFloat((holding.quantity + quantity).toFixed(4));
      holding.avgBuyPrice = parseFloat((totalCostNew / totalQty).toFixed(2));
      holding.quantity = totalQty;

      user.tradingAccount = parseFloat((user.tradingAccount - totalCost).toFixed(2));
      user.totalSpent += totalCost;
      user.totalTrades += 1;
      user.xp += 10;

      await checkLevelUp(user);
      await user.save();
      await recordTradePressure(symbol, 'buy', totalCost);

      await Transaction.create({
        userId: user.userId, type: 'buy_commodity', symbol,
        quantity, price: asset.currentPrice,
        total: totalCost, balanceAfter: user.tradingAccount,
      });

      const embed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle('✅ Commodity Purchase Successful')
        .addFields(
          { name: 'Commodity', value: `${asset.name} (${symbol})`, inline: true },
          { name: 'Quantity', value: `${quantity} ${asset.unit}`, inline: true },
          { name: 'Price/Unit', value: formatMoney(asset.currentPrice), inline: true },
          { name: 'Total Cost', value: formatMoney(totalCost), inline: true },
          { name: 'Trading Account', value: formatMoney(user.tradingAccount), inline: true },
          { name: 'Total Holdings', value: `${holding.quantity} ${asset.unit}`, inline: true }
        );

      if (asset.imageUrl) embed.setThumbnail(asset.imageUrl);
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'sell') {
      const symbol = interaction.options.getString('symbol').toUpperCase();
      const quantity = interaction.options.getNumber('quantity');
      const source = interaction.options.getString('source') || 'holdings';
      const user = await getOrCreateUser(interaction.user.id, interaction.user.username);
      const asset = await Asset.findOne({ symbol, type: 'commodity', active: true });

      if (!asset) return interaction.editReply(`❌ Commodity **${symbol}** not found.`);

      if (source === 'warehouse') {
        // Sell from warehouse (produced goods)
        const warehouse = await Warehouse.findOne({ userId: interaction.user.id });
        const warehouseItem = warehouse?.items.find((i) => i.symbol === symbol);

        if (!warehouseItem || warehouseItem.quantity < quantity) {
          return interaction.editReply(
            `❌ Not enough in warehouse!\n` +
            `Warehouse has: **${warehouseItem?.quantity.toFixed(2) || 0} ${asset.unit}**`
          );
        }

        const usdValue = parseFloat((quantity * asset.currentPrice).toFixed(2));
        warehouseItem.quantity = parseFloat((warehouseItem.quantity - quantity).toFixed(4));
        warehouse.usedCapacity = warehouse.items.reduce((a, i) => a + i.quantity, 0);
        await warehouse.save();

        user.tradingAccount = parseFloat((user.tradingAccount + usdValue).toFixed(2));
        user.totalEarned += usdValue;
        await user.save();

        await recordTradePressure(symbol, 'sell', usdValue);

        return interaction.editReply(
          `✅ Sold **${quantity} ${asset.unit}** of **${symbol}** from warehouse for **${formatMoney(usdValue)}**!\n` +
          `📈 Trading Account: **${formatMoney(user.tradingAccount)}**`
        );

      } else {
        // Sell from market holdings
        const holding = user.commodityHoldings.find((h) => h.symbol === symbol);
        if (!holding || holding.quantity < quantity) {
          return interaction.editReply(
            `❌ Insufficient holdings!\n` +
            `You own: **${holding?.quantity.toFixed(4) || 0} ${asset.unit}**`
          );
        }

        const usdValue = parseFloat((quantity * asset.currentPrice).toFixed(2));
        const pnl = parseFloat(((asset.currentPrice - holding.avgBuyPrice) * quantity).toFixed(2));
        const pnlPct = priceChange(asset.currentPrice, holding.avgBuyPrice);

        holding.quantity = parseFloat((holding.quantity - quantity).toFixed(4));
        user.tradingAccount = parseFloat((user.tradingAccount + usdValue).toFixed(2));
        user.totalEarned += usdValue;
        user.totalTrades += 1;
        user.xp += 10;

        await checkLevelUp(user);
        await user.save();
        await recordTradePressure(symbol, 'sell', usdValue);

        await Transaction.create({
          userId: user.userId, type: 'sell_commodity', symbol,
          quantity, price: asset.currentPrice,
          total: usdValue, balanceAfter: user.tradingAccount,
        });

        const embed = new EmbedBuilder()
          .setColor(pnl >= 0 ? 0x00ff88 : 0xff4545)
          .setTitle(`${pnl >= 0 ? '📈' : '📉'} Commodity Sold`)
          .addFields(
            { name: 'Commodity', value: `${asset.name} (${symbol})`, inline: true },
            { name: 'Sold', value: `${quantity} ${asset.unit}`, inline: true },
            { name: 'Price/Unit', value: formatMoney(asset.currentPrice), inline: true },
            { name: 'Total Received', value: formatMoney(usdValue), inline: true },
            { name: 'P&L', value: `${formatMoney(pnl)} (${formatPercent(pnlPct)})`, inline: true },
            { name: 'Trading Account', value: formatMoney(user.tradingAccount), inline: true }
          );

        return interaction.editReply({ embeds: [embed] });
      }
    }

    if (sub === 'portfolio') {
      const user = await getOrCreateUser(interaction.user.id, interaction.user.username);
      const holdings = user.commodityHoldings.filter((h) => h.quantity > 0);
      if (holdings.length === 0) return interaction.editReply('📭 No commodity holdings. Use `/commodities buy` to invest!');

      const assets = await Asset.find({ symbol: { $in: holdings.map((h) => h.symbol) }, type: 'commodity' });
      const assetMap = {};
      assets.forEach((a) => (assetMap[a.symbol] = a));

      let totalValue = 0, totalCost = 0;
      const lines = [];

      for (const h of holdings) {
        const a = assetMap[h.symbol];
        if (!a) continue;
        const value = parseFloat((h.quantity * a.currentPrice).toFixed(2));
        const cost = parseFloat((h.quantity * h.avgBuyPrice).toFixed(2));
        const pnl = parseFloat((value - cost).toFixed(2));
        totalValue += value;
        totalCost += cost;
        lines.push(`**${h.symbol}** — ${h.quantity} ${a.unit} | Value: ${formatMoney(value)} | P&L: ${formatMoney(pnl)} (${formatPercent(priceChange(a.currentPrice, h.avgBuyPrice))})`);
      }

      const totalPnl = parseFloat((totalValue - totalCost).toFixed(2));

      const embed = new EmbedBuilder()
        .setColor(totalPnl >= 0 ? 0x00ff88 : 0xff4545)
        .setTitle('🛢️ Commodity Portfolio')
        .setDescription(lines.join('\n'))
        .addFields(
          { name: 'Total Value', value: formatMoney(totalValue), inline: true },
          { name: 'Total P&L', value: formatMoney(totalPnl), inline: true },
          { name: 'Trading Account', value: formatMoney(user.tradingAccount), inline: true }
        );

      return interaction.editReply({ embeds: [embed] });
    }
  },
};