const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getOrCreateUser, formatMoney, formatPercent, priceChange } = require('../../utils/helpers');
const { recordTradePressure } = require('../../utils/marketEngine');
const Asset = require('../../models/Asset');
const Transaction = require('../../models/Transaction');
const { checkLevelUp } = require('../../utils/jobs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stocks')
    .setDescription('Stock trading')
    .addSubcommand((sub) => sub.setName('list').setDescription('List all stocks'))
    .addSubcommand((sub) =>
      sub.setName('price')
        .setDescription('Check stock price')
        .addStringOption((o) => o.setName('symbol').setDescription('Ticker').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('buy')
        .setDescription('Buy shares')
        .addStringOption((o) => o.setName('symbol').setDescription('Ticker').setRequired(true))
        .addNumberOption((o) => o.setName('shares').setDescription('Number of shares').setRequired(true).setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub.setName('sell')
        .setDescription('Sell shares')
        .addStringOption((o) => o.setName('symbol').setDescription('Ticker').setRequired(true))
        .addNumberOption((o) => o.setName('shares').setDescription('Shares to sell').setRequired(true).setMinValue(1))
    )
    .addSubcommand((sub) => sub.setName('portfolio').setDescription('Your stock portfolio')),

  async execute(interaction) {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();

    // ── LIST ───────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const assets = await Asset.find({ type: 'stock', active: true }).sort({ marketCap: -1 });
      if (assets.length === 0) return interaction.editReply('❌ No stocks listed yet.');

      const lines = assets.map((a) => {
        const chg = priceChange(a.currentPrice, a.previousPrice);
        const chg24 = a.openPrice ? priceChange(a.currentPrice, a.openPrice) : 0;
        const arrow = chg >= 0 ? '▲' : '▼';
        const bar = chg24 >= 5 ? '█████' : chg24 >= 2 ? '████░' : chg24 >= 0 ? '███░░' : chg24 >= -2 ? '██░░░' : chg24 >= -5 ? '█░░░░' : '░░░░░';
        return [
          `**${a.symbol}** — ${a.name}`,
          `\`${formatMoney(a.currentPrice).padEnd(12)} ${arrow} ${formatPercent(chg).padStart(8)}\` \`${bar}\``,
          `Sector: ${a.sector} | MCap: ${formatMoney(a.marketCap)}`,
        ].join('\n');
      });

      const gainers = assets.filter((a) => a.currentPrice >= a.previousPrice).length;

      const embed = new EmbedBuilder()
        .setColor(0x1e90ff)
        .setTitle('📈 Stock Market')
        .setDescription(lines.join('\n\n'))
        .addFields({
          name: 'Market Summary',
          value: `🟢 ${gainers} Gainers   🔴 ${assets.length - gainers} Losers`,
          inline: false,
        })
        .setFooter({ text: 'Prices update every 60 seconds • Use /stocks price <symbol> for details' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ── PRICE ──────────────────────────────────────────────────────────────
    if (sub === 'price') {
      const symbol = interaction.options.getString('symbol').toUpperCase();
      const asset = await Asset.findOne({ symbol, type: 'stock', active: true });
      if (!asset) return interaction.editReply(`❌ Stock **${symbol}** not found.`);

      const chg = priceChange(asset.currentPrice, asset.previousPrice);
      const chg24 = asset.openPrice ? priceChange(asset.currentPrice, asset.openPrice) : 0;

      const embed = new EmbedBuilder()
        .setColor(chg >= 0 ? 0x00ff88 : 0xff4545)
        .setTitle(`📈 ${asset.name} (${asset.symbol})`)
        .addFields(
          { name: 'Price', value: formatMoney(asset.currentPrice), inline: true },
          { name: '1m Change', value: formatPercent(chg), inline: true },
          { name: '24h Change', value: formatPercent(chg24), inline: true },
          { name: 'Market Cap', value: formatMoney(asset.marketCap), inline: true },
          { name: 'Sector', value: asset.sector, inline: true },
          { name: '24h Volume', value: formatMoney(asset.totalVolume24h), inline: true },
          { name: 'Description', value: asset.description || 'N/A', inline: false }
        );

      if (asset.imageUrl) embed.setThumbnail(asset.imageUrl);
      return interaction.editReply({ embeds: [embed] });
    }

    // ── BUY ────────────────────────────────────────────────────────────────
    if (sub === 'buy') {
      const symbol = interaction.options.getString('symbol').toUpperCase();
      const shares = interaction.options.getNumber('shares');
      const user = await getOrCreateUser(interaction.user.id, interaction.user.username);
      const asset = await Asset.findOne({ symbol, type: 'stock', active: true });

      if (!asset) return interaction.editReply(`❌ Stock **${symbol}** not found.`);

      const totalCost = parseFloat((shares * asset.currentPrice).toFixed(2));
      const maxCanBuy = Math.floor(user.tradingAccount / asset.currentPrice);

      if (user.tradingAccount < totalCost) {
        return interaction.editReply(
          `❌ Insufficient funds!\n\n` +
          `🛒 You want: **${shares} ${symbol}** = **${formatMoney(totalCost)}**\n` +
          `📈 Trading Account: **${formatMoney(user.tradingAccount)}**\n` +
          `📊 Max you can buy: **${maxCanBuy} shares**\n\n` +
          `💡 Use \`/transfer\` to fund your Trading Account.`
        );
      }

      let holding = user.stockHoldings.find((h) => h.symbol === symbol);
      if (!holding) {
        user.stockHoldings.push({ symbol, quantity: 0, avgBuyPrice: 0 });
        holding = user.stockHoldings[user.stockHoldings.length - 1];
      }

      const totalCostNew = holding.quantity * holding.avgBuyPrice + totalCost;
      const totalQty = parseFloat((holding.quantity + shares).toFixed(2));
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
        userId: user.userId, type: 'buy_stock', symbol,
        quantity: shares, price: asset.currentPrice,
        total: totalCost, balanceAfter: user.tradingAccount,
      });

      const embed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle('✅ Stock Purchase Successful')
        .addFields(
          { name: 'Stock', value: `${asset.name} (${symbol})`, inline: true },
          { name: 'Shares', value: `${shares}`, inline: true },
          { name: 'Price/Share', value: formatMoney(asset.currentPrice), inline: true },
          { name: 'Total Cost', value: formatMoney(totalCost), inline: true },
          { name: 'Trading Account', value: formatMoney(user.tradingAccount), inline: true },
          { name: 'Total Holdings', value: `${holding.quantity} shares`, inline: true }
        );

      if (asset.imageUrl) embed.setThumbnail(asset.imageUrl);
      return interaction.editReply({ embeds: [embed] });
    }

    // ── SELL ───────────────────────────────────────────────────────────────
    if (sub === 'sell') {
      const symbol = interaction.options.getString('symbol').toUpperCase();
      const shares = interaction.options.getNumber('shares');
      const user = await getOrCreateUser(interaction.user.id, interaction.user.username);
      const asset = await Asset.findOne({ symbol, type: 'stock', active: true });

      if (!asset) return interaction.editReply(`❌ Stock **${symbol}** not found.`);

      const holding = user.stockHoldings.find((h) => h.symbol === symbol);
      if (!holding || holding.quantity < shares) {
        const maxSell = holding ? holding.quantity.toFixed(2) : 0;
        return interaction.editReply(
          `❌ Insufficient shares!\n` +
          `You own: **${maxSell} shares** worth **${formatMoney(maxSell * asset.currentPrice)}**`
        );
      }

      const usdValue = parseFloat((shares * asset.currentPrice).toFixed(2));
      const pnl = parseFloat(((asset.currentPrice - holding.avgBuyPrice) * shares).toFixed(2));
      const pnlPct = priceChange(asset.currentPrice, holding.avgBuyPrice);

      holding.quantity = parseFloat((holding.quantity - shares).toFixed(2));
      user.tradingAccount = parseFloat((user.tradingAccount + usdValue).toFixed(2));
      user.totalEarned += usdValue;
      user.totalTrades += 1;
      user.xp += 10;

      await checkLevelUp(user);
      await user.save();
      await recordTradePressure(symbol, 'sell', usdValue);

      await Transaction.create({
        userId: user.userId, type: 'sell_stock', symbol,
        quantity: shares, price: asset.currentPrice,
        total: usdValue, balanceAfter: user.tradingAccount,
      });

      const embed = new EmbedBuilder()
        .setColor(pnl >= 0 ? 0x00ff88 : 0xff4545)
        .setTitle(`${pnl >= 0 ? '📈' : '📉'} Stock Sold`)
        .addFields(
          { name: 'Stock', value: `${asset.name} (${symbol})`, inline: true },
          { name: 'Shares Sold', value: `${shares}`, inline: true },
          { name: 'Price/Share', value: formatMoney(asset.currentPrice), inline: true },
          { name: 'Total Received', value: formatMoney(usdValue), inline: true },
          { name: 'P&L', value: `${formatMoney(pnl)} (${formatPercent(pnlPct)})`, inline: true },
          { name: 'Remaining', value: `${holding.quantity} shares`, inline: true },
          { name: 'Trading Account', value: formatMoney(user.tradingAccount), inline: true }
        );

      if (asset.imageUrl) embed.setThumbnail(asset.imageUrl);
      return interaction.editReply({ embeds: [embed] });
    }

    // ── PORTFOLIO ──────────────────────────────────────────────────────────
    if (sub === 'portfolio') {
      const user = await getOrCreateUser(interaction.user.id, interaction.user.username);
      const holdings = user.stockHoldings.filter((h) => h.quantity > 0);
      if (holdings.length === 0) return interaction.editReply('📭 No stock holdings. Use `/stocks buy` to invest!');

      const assets = await Asset.find({ symbol: { $in: holdings.map((h) => h.symbol) }, type: 'stock' });
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
        const pnlPct = priceChange(a.currentPrice, h.avgBuyPrice);
        const pnlEmoji = pnl >= 0 ? '🟢' : '🔴';
        totalValue += value;
        totalCost += cost;
        lines.push(
          `${pnlEmoji} **${h.symbol}** — ${h.quantity} shares\n` +
          `💰 ${formatMoney(value)} | Avg: ${formatMoney(h.avgBuyPrice)} | P&L: ${formatMoney(pnl)} (${formatPercent(pnlPct)})`
        );
      }

      const totalPnl = parseFloat((totalValue - totalCost).toFixed(2));
      const totalPnlPct = totalCost > 0 ? ((totalPnl / totalCost) * 100) : 0;

      const embed = new EmbedBuilder()
        .setColor(totalPnl >= 0 ? 0x00ff88 : 0xff4545)
        .setTitle('📈 Stock Portfolio')
        .setDescription(lines.join('\n\n'))
        .addFields(
          { name: 'Total Value', value: formatMoney(totalValue), inline: true },
          { name: 'Total P&L', value: `${formatMoney(totalPnl)} (${formatPercent(totalPnlPct)})`, inline: true },
          { name: 'Trading Account', value: formatMoney(user.tradingAccount), inline: true }
        );

      return interaction.editReply({ embeds: [embed] });
    }
  },
};