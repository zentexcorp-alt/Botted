const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getOrCreateUser, formatMoney } = require('../../utils/helpers');
const { getItem, getBuyableItems, rollLootBox, RARITY_COLORS } = require('../../utils/items');
const Inventory = require('../../models/Inventory');

async function getOrCreateInventory(userId) {
  let inv = await Inventory.findOne({ userId });
  if (!inv) inv = await Inventory.create({ userId, items: [], activeEffects: [] });
  return inv;
}

function addToInventory(inv, itemId, quantity = 1) {
  const existing = inv.items.find((i) => i.itemId === itemId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    inv.items.push({ itemId, quantity });
  }
}

function removeFromInventory(inv, itemId, quantity = 1) {
  const existing = inv.items.find((i) => i.itemId === itemId);
  if (!existing || existing.quantity < quantity) return false;
  existing.quantity -= quantity;
  if (existing.quantity <= 0) {
    inv.items = inv.items.filter((i) => i.itemId !== itemId);
  }
  return true;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Browse and buy items')
    .addSubcommand((sub) =>
      sub.setName('browse')
        .setDescription('Browse all available items')
        .addStringOption((o) =>
          o.setName('category').setDescription('Filter by category').setRequired(false)
            .addChoices(
              { name: '🛠️ Tools', value: 'tool' },
              { name: '⚡ Boosts', value: 'boost' },
              { name: '💎 Collectibles', value: 'collectible' },
              { name: '📦 Loot Boxes', value: 'lootbox' },
              { name: '🏡 Property', value: 'property' },
            )
        )
    )
    .addSubcommand((sub) =>
      sub.setName('buy')
        .setDescription('Buy an item from the shop')
        .addStringOption((o) => o.setName('item').setDescription('Item ID to buy').setRequired(true))
        .addIntegerOption((o) => o.setName('quantity').setDescription('How many to buy').setMinValue(1).setMaxValue(100))
    )
    .addSubcommand((sub) =>
      sub.setName('sell')
        .setDescription('Sell an item from your inventory')
        .addStringOption((o) => o.setName('item').setDescription('Item ID to sell').setRequired(true))
        .addIntegerOption((o) => o.setName('quantity').setDescription('How many to sell').setMinValue(1).setMaxValue(100))
    )
    .addSubcommand((sub) =>
      sub.setName('info')
        .setDescription('Get info about a specific item')
        .addStringOption((o) => o.setName('item').setDescription('Item ID').setRequired(true))
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();
    const user = await getOrCreateUser(interaction.user.id, interaction.user.username);

    // ── BROWSE ─────────────────────────────────────────────────────────────
    if (sub === 'browse') {
      const category = interaction.options.getString('category');
      let items = getBuyableItems();
      if (category) items = items.filter((i) => i.category === category);

      const categories = {};
      for (const item of items) {
        if (!categories[item.category]) categories[item.category] = [];
        categories[item.category].push(item);
      }

      const CATEGORY_LABELS = {
        tool: '🛠️ Tools',
        boost: '⚡ Boosts',
        collectible: '💎 Collectibles',
        lootbox: '📦 Loot Boxes',
        property: '🏡 Property Items',
        special: '🌑 Special',
      };

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('🛒 Item Shop')
        .setFooter({ text: 'Use /shop buy <item_id> to purchase • /shop info <item_id> for details' });

      for (const [cat, catItems] of Object.entries(categories)) {
        const lines = catItems.map((i) =>
          `${i.emoji} **${i.name}** (\`${i.itemId}\`) — ${formatMoney(i.buyPrice)} ${RARITY_COLORS[i.rarity]}`
        );
        embed.addFields({ name: CATEGORY_LABELS[cat] || cat, value: lines.join('\n'), inline: false });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    // ── BUY ────────────────────────────────────────────────────────────────
    if (sub === 'buy') {
      const itemId = interaction.options.getString('item').toLowerCase();
      const quantity = interaction.options.getInteger('quantity') || 1;
      const item = getItem(itemId);

      if (!item) return interaction.editReply(`❌ Item **${itemId}** not found. Use \`/shop browse\` to see all items.`);
      if (!item.buyable) return interaction.editReply(`❌ **${item.name}** is not available in the shop.`);

      const totalCost = item.buyPrice * quantity;
      if (user.wallet < totalCost) {
        return interaction.editReply(
          `❌ Insufficient funds!\n\n` +
          `🛒 **${quantity}x ${item.emoji} ${item.name}** = **${formatMoney(totalCost)}**\n` +
          `💰 Your Wallet: **${formatMoney(user.wallet)}**\n` +
          `📊 Max you can buy: **${Math.floor(user.wallet / item.buyPrice)}**`
        );
      }

      user.wallet -= totalCost;
      await user.save();

      const inv = await getOrCreateInventory(interaction.user.id);
      addToInventory(inv, itemId, quantity);
      await inv.save();

      const embed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle('✅ Purchase Successful!')
        .addFields(
          { name: 'Item', value: `${item.emoji} ${item.name}`, inline: true },
          { name: 'Quantity', value: `${quantity}`, inline: true },
          { name: 'Total Cost', value: formatMoney(totalCost), inline: true },
          { name: '💰 Wallet', value: formatMoney(user.wallet), inline: true },
          { name: 'Rarity', value: `${RARITY_COLORS[item.rarity]} ${item.rarity}`, inline: true }
        );

      return interaction.editReply({ embeds: [embed] });
    }

    // ── SELL ───────────────────────────────────────────────────────────────
    if (sub === 'sell') {
      const itemId = interaction.options.getString('item').toLowerCase();
      const quantity = interaction.options.getInteger('quantity') || 1;
      const item = getItem(itemId);

      if (!item) return interaction.editReply(`❌ Item **${itemId}** not found.`);
      if (!item.sellable) return interaction.editReply(`❌ **${item.name}** cannot be sold.`);

      const inv = await getOrCreateInventory(interaction.user.id);
      const owned = inv.items.find((i) => i.itemId === itemId);

      if (!owned || owned.quantity < quantity) {
        return interaction.editReply(
          `❌ You don't have enough **${item.name}**!\n` +
          `You own: **${owned?.quantity || 0}**`
        );
      }

      const totalEarned = item.sellPrice * quantity;
      removeFromInventory(inv, itemId, quantity);
      await inv.save();

      user.wallet += totalEarned;
      await user.save();

      return interaction.editReply(
        `✅ Sold **${quantity}x ${item.emoji} ${item.name}** for **${formatMoney(totalEarned)}**!\n` +
        `💰 Wallet: **${formatMoney(user.wallet)}**`
      );
    }

    // ── INFO ───────────────────────────────────────────────────────────────
    if (sub === 'info') {
      const itemId = interaction.options.getString('item').toLowerCase();
      const item = getItem(itemId);
      if (!item) return interaction.editReply(`❌ Item **${itemId}** not found.`);

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`${item.emoji} ${item.name}`)
        .setDescription(item.description)
        .addFields(
          { name: 'Rarity', value: `${RARITY_COLORS[item.rarity]} ${item.rarity}`, inline: true },
          { name: 'Category', value: item.category, inline: true },
          { name: 'Buy Price', value: item.buyable ? formatMoney(item.buyPrice) : 'Not for sale', inline: true },
          { name: 'Sell Price', value: item.sellable ? formatMoney(item.sellPrice) : 'Cannot sell', inline: true },
          { name: 'Usable', value: item.usable ? '✅ Yes' : '❌ No', inline: true },
          { name: 'Item ID', value: `\`${item.itemId}\``, inline: true }
        );

      return interaction.editReply({ embeds: [embed] });
    }
  },
};