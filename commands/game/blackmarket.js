const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const BlackMarket = require('../../models/BlackMarket');
const { getOrCreateUser, formatMoney } = require('../../utils/helpers');
const { getOrCreateWarehouse, addToWarehouse } = require('../../utils/productionEngine');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackmarket')
    .setDescription('Browse the Black Market when open')
    .addSubcommand((sub) => sub.setName('view').setDescription('View current Black Market items'))
    .addSubcommand((sub) =>
      sub.setName('buy')
        .setDescription('Buy an item from the Black Market')
        .addStringOption((o) => o.setName('item').setDescription('Item name').setRequired(true))
        .addNumberOption((o) => o.setName('quantity').setDescription('Quantity to buy').setMinValue(1))
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();

    const market = await BlackMarket.findOne({
      guildId: interaction.guildId,
      active: true,
      closesAt: { $gt: new Date() },
    });

    if (!market) {
      return interaction.editReply('🌑 The Black Market is **closed** right now.\nWatch for announcements from the admins!');
    }

    if (sub === 'view') {
      const timeLeft = new Date(market.closesAt) - Date.now();

      const lines = market.items.map((item) => {
        const soldOut = item.stock <= 0;
        return [
          `${soldOut ? '❌' : '✅'} **${item.name}**`,
          `📝 ${item.description}`,
          `💰 Price: **${formatMoney(item.price)}**`,
          `📦 Stock: **${item.stock}/${item.originalStock}**`,
        ].join('\n');
      });

      const embed = new EmbedBuilder()
        .setColor(0x2c2f33)
        .setTitle('🌑 Black Market')
        .setDescription(lines.join('\n\n'))
        .addFields({ name: '⏰ Closes', value: `<t:${Math.floor(market.closesAt.getTime() / 1000)}:R>`, inline: true })
        .setFooter({ text: 'Use /blackmarket buy <item> to purchase • Limited stock!' });

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'buy') {
      const itemName = interaction.options.getString('item');
      const quantity = interaction.options.getNumber('quantity') || 1;
      const user = await getOrCreateUser(interaction.user.id, interaction.user.username);

      const item = market.items.find((i) => i.name.toLowerCase() === itemName.toLowerCase());
      if (!item) return interaction.editReply(`❌ Item **"${itemName}"** not found. Use \`/blackmarket view\` to see available items.`);
      if (item.stock <= 0) return interaction.editReply(`❌ **${item.name}** is sold out!`);
      if (item.stock < quantity) return interaction.editReply(`❌ Only **${item.stock}** left in stock!`);

      const totalCost = item.price * quantity;
      if (user.wallet < totalCost) {
        return interaction.editReply(
          `❌ Need **${formatMoney(totalCost)}**.\n` +
          `💰 Your Wallet: **${formatMoney(user.wallet)}**`
        );
      }

      user.wallet -= totalCost;
      await user.save();

      item.stock -= quantity;
      market.buyers.push({
        userId: interaction.user.id,
        username: interaction.user.username,
        itemName: item.name,
        quantity,
        paid: totalCost,
      });

      // Apply item effect
      let resultMsg = '';

      if (item.type === 'commodity' && item.symbol) {
        const warehouse = await getOrCreateWarehouse(interaction.user.id);
        addToWarehouse(warehouse, item.symbol, item.quantity * quantity);
        await warehouse.save();
        resultMsg = `Added **${item.quantity * quantity} ${item.symbol}** to your warehouse!`;
      } else if (item.type === 'cash') {
        user.wallet += item.effectValue * quantity;
        await user.save();
        resultMsg = `**${formatMoney(item.effectValue * quantity)}** added to your wallet!`;
      } else {
        resultMsg = item.description;
      }

      // Close market if all items sold out
      const allSoldOut = market.items.every((i) => i.stock <= 0);
      if (allSoldOut) {
        market.active = false;
        await interaction.channel?.send('🌑 **Black Market** — All items sold out! The market is now closed.');
      }

      await market.save();

      const embed = new EmbedBuilder()
        .setColor(0x2c2f33)
        .setTitle('🌑 Black Market Purchase')
        .addFields(
          { name: '🛒 Item', value: item.name, inline: true },
          { name: '📦 Quantity', value: `${quantity}`, inline: true },
          { name: '💰 Paid', value: formatMoney(totalCost), inline: true },
          { name: '📦 Stock Remaining', value: `${item.stock}`, inline: true },
          { name: '✅ Result', value: resultMsg, inline: false },
        );

      return interaction.editReply({ embeds: [embed] });
    }
  },
};