const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getOrCreateUser, formatMoney, formatPercent, priceChange } = require('../../utils/helpers');
const { recordTradePressure } = require('../../utils/marketEngine');
const Asset = require('../../models/Asset');
const Transaction = require('../../models/Transaction');
const { checkLevelUp } = require('../../utils/jobs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('crypto')
    .setDescription('Crypto trading')
    .addSubcommand((sub) => sub.setName('list').setDescription('List all cryptocurrencies'))
    .addSubcommand((sub) =>
      sub.setName('price')
        .setDescription('Check crypto price')
        .addStringOption((o) => o.setName('symbol').setDescription('Symbol').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('buy')
        .setDescription('Buy crypto')
        .addStringOption((o) => o.setName('symbol').setDescription('Symbol').setRequired(true))
        .addNumberOption((o) => o.setName('quantity').setDescription('Quantity to buy').setRequired(true).setMinValue(0.01))
    )
    .addSubcommand((sub) =>
      sub.setName('sell')
        .setDescription('Sell crypto')
        .addStringOption((o) => o.setName('symbol').setDescription('Symbol').setRequired(true))
        .addNumberOption((o) => o.setName('quantity').setDescription('Quantity to sell').setRequired(true).setMinValue(0.01))
    )
    .addSubcommand((sub) => sub.setName('portfolio').setDescription('Your crypto portfolio')),

  async execute(interaction) {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      const assets = await Asset.find({ type: 'crypto', active: true }).sort({ marketCap: -1 });
      if (assets.length === 0) return interaction.editReply('❌ No cryptocurrencies listed yet.');

      const lines = assets.map((a) => {
        const chg = priceChange(a.currentPrice, a.previousPrice);
        return `${chg >= 0 ? '🟢' : '🔴'} **${a.symbol}** — ${formatMoney(a.currentPrice)} (${formatPercent(chg)}) | MCap: ${formatMoney(a.marketCap)}`;
      });

      const embed = new EmbedBuilder()
        .setColor(0xf7931a)
        .setTitle('₿ Cryptocurrency Market')
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'Prices update every minute' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'price') {
      const symbol = interaction.options.getString('symbol').toUpperCase();
      const asset = await Asset.findOne({ symbol, type: 'crypto', active: true });
      if (!asset) return interaction.editReply(`❌ Crypto **${symbol}** not found.`);

      const chg = priceChange(asset.currentPrice, asset.previousPrice);
      const chg24 = asset.openPrice ? priceChange(asset.currentPrice, asset.openPrice) : 0;

      const embed = new EmbedBuilder()
        .setColor(chg >= 0 ? 0x00ff88 : 0xff4545)
        .setTitle(`₿ ${asset.name} (${asset.symbol})`)
        .addFields(
          { name: 'Price', value: formatMoney(asset.currentPrice), inline: true },
          { name: '1m Change', value: formatPercent(chg), inline: true },
          { name: '24h Change', value: formatPercent(chg24), inline: true },
          { name: 'Market Cap', value: formatMoney(asset.marketCap), inline: true },
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
      const asset = await Asset.findOne({ symbol, type: 'crypto', active: true });

      if (!asset) return interaction.editReply(`❌ Crypto **${symbol}** not found.`);

      const totalCost = parseFloat((quantity * asset.currentPrice).toFixed(2));
      const maxCanBuy = parseFloat((user.tradingAccount / asset.currentPrice).toFixed(6));

      if (totalCost < 0.01) return interaction.editReply(`❌ Minimum purchase is **$0.01**.`);

      if (user.tradingAccount < totalCost) {
        return interaction.editReply(
          `❌ Insufficient funds!\n\n` +
          `🛒 You want: **${quantity} ${symbol}** = **${formatMoney(totalCost)}**\n` +
          `📈 Trading Account: **${formatMoney(user.tradingAccount)}**\n` +
          `📊 Max you can buy: **${maxCanBuy} ${symbol}**\n\n` +
          `💡 Use \`/transfer\` to fund your Trading Account.`
        );
      }

      let holding = user.cryptoHoldings.find((h) => h.symbol === symbol);
      if (!holding) {
        user.cryptoHoldings.push({ symbol, quantity: 0, avgBuyPrice: 0 });
        holding = user.cryptoHoldings[user.cryptoHoldings.length - 1];
      }

      const totalCostNew = holding.quantity * holding.avgBuyPrice + totalCost;
      const totalQty = parseFloat((holding.quantity + quantity).toFixed(6));
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
        userId: user.userId, type: 'buy_crypto', symbol,
        quantity, price: asset.currentPrice,
        total: totalCost, balanceAfter: user.tradingAccount,
      });

      const embed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle('✅ Crypto Purchase Successful')
        .addFields(
          { name: 'Asset', value: `${asset.name} (${symbol})`, inline: true },
          { name: 'Quantity', value: `${quantity} ${symbol}`, inline: true },
          { name: 'Price/Coin', value: formatMoney(asset.currentPrice), inline: true },
          { name: 'Total Cost', value: formatMoney(totalCost), inline: true },
          { name: 'Trading Account', value: formatMoney(user.tradingAccount), inline: true },
          { name: 'Total Holdings', value: `${holding.quantity} ${symbol}`, inline: true }
        );

      if (asset.imageUrl) embed.setThumbnail(asset.imageUrl);
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'sell') {
      const symbol = interaction.options.getString('symbol').toUpperCase();
      const quantity = interaction.options.getNumber('quantity');
      const user = await getOrCreateUser(interaction.user.id, interaction.user.username);
      const asset = await Asset.findOne({ symbol, type: 'crypto', active: true });

      if (!asset) return interaction.editReply(`❌ Crypto **${symbol}** not found.`);

      const holding = user.cryptoHoldings.find((h) => h.symbol === symbol);
      if (!holding || holding.quantity < quantity) {
        const maxSell = holding ? holding.quantity.toFixed(6) : 0;
        return interaction.editReply(
          `❌ Insufficient holdings!\n` +
          `You own: **${maxSell} ${symbol}** worth **${formatMoney(maxSell * asset.currentPrice)}**`
        );
      }

      const usdValue = parseFloat((quantity * asset.currentPrice).toFixed(2));
      const pnl = parseFloat(((asset.currentPrice - holding.avgBuyPrice) * quantity).toFixed(2));
      const pnlPct = priceChange(asset.currentPrice, holding.avgBuyPrice);

      holding.quantity = parseFloat((holding.quantity - quantity).toFixed(6));
      user.tradingAccount = parseFloat((user.tradingAccount + usdValue).toFixed(2));
      user.totalEarned += usdValue;
      user.totalTrades += 1;
      user.xp += 10;

      await checkLevelUp(user);
      await user.save();
      await recordTradePressure(symbol, 'sell', usdValue);

      await Transaction.create({
        userId: user.userId, type: 'sell_crypto', symbol,
        quantity, price: asset.currentPrice,
        total: usdValue, balanceAfter: user.tradingAccount,
      });

      const embed = new EmbedBuilder()
        .setColor(pnl >= 0 ? 0x00ff88 : 0xff4545)
        .setTitle(`${pnl >= 0 ? '📈' : '📉'} Crypto Sold`)
        .addFields(
          { name: 'Asset', value: `${asset.name} (${symbol})`, inline: true },
          { name: 'Sold', value: `${quantity} ${symbol}`, inline: true },
          { name: 'Price/Coin', value: formatMoney(asset.currentPrice), inline: true },
          { name: 'Total Received', value: formatMoney(usdValue), inline: true },
          { name: 'P&L', value: `${formatMoney(pnl)} (${formatPercent(pnlPct)})`, inline: true },
          { name: 'Remaining', value: `${holding.quantity} ${symbol}`, inline: true },
          { name: 'Trading Account', value: formatMoney(user.tradingAccount), inline: true }
        );

      if (asset.imageUrl) embed.setThumbnail(asset.imageUrl);
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'portfolio') {
      const user = await getOrCreateUser(interaction.user.id, interaction.user.username);
      const holdings = user.cryptoHoldings.filter((h) => h.quantity > 0);
      if (holdings.length === 0) return interaction.editReply('📭 No crypto holdings. Use `/crypto buy` to invest!');

      const assets = await Asset.find({ symbol: { $in: holdings.map((h) => h.symbol) }, type: 'crypto' });
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
        lines.push(`**${h.symbol}** — ${h.quantity} coins | Value: ${formatMoney(value)} | P&L: ${formatMoney(pnl)} (${formatPercent(priceChange(a.currentPrice, h.avgBuyPrice))})`);
      }

      const totalPnl = parseFloat((totalValue - totalCost).toFixed(2));

      const embed = new EmbedBuilder()
        .setColor(totalPnl >= 0 ? 0x00ff88 : 0xff4545)
        .setTitle('₿ Crypto Portfolio')
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