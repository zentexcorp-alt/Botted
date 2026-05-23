const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getOrCreateUser, formatMoney } = require('../../utils/helpers');
const { getItem, rollLootBox, RARITY_COLORS } = require('../../utils/items');
const Inventory = require('../../models/Inventory');
const Asset = require('../../models/Asset');

async function getOrCreateInventory(userId) {
  let inv = await Inventory.findOne({ userId });
  if (!inv) inv = await Inventory.create({ userId, items: [], activeEffects: [] });
  return inv;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('View and use your items')
    .addSubcommand((sub) => sub.setName('view').setDescription('View all your items'))
    .addSubcommand((sub) =>
      sub.setName('use')
        .setDescription('Use an item from your inventory')
        .addStringOption((o) => o.setName('item').setDescription('Item ID to use').setRequired(true))
        .addStringOption((o) => o.setName('target').setDescription('Target (asset symbol if needed)').setRequired(false))
    )
    .addSubcommand((sub) => sub.setName('effects').setDescription('View your active effects')),

  async execute(interaction) {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();
    const user = await getOrCreateUser(interaction.user.id, interaction.user.username);
    const inv = await getOrCreateInventory(interaction.user.id);

    // ── VIEW ───────────────────────────────────────────────────────────────
    if (sub === 'view') {
      if (inv.items.length === 0) {
        return interaction.editReply('📭 Your inventory is empty! Visit `/shop browse` to buy items.');
      }

      const categories = {};
      for (const invItem of inv.items) {
        const item = getItem(invItem.itemId);
        if (!item) continue;
        if (!categories[item.category]) categories[item.category] = [];
        categories[item.category].push({ item, quantity: invItem.quantity });
      }

      const CATEGORY_LABELS = {
        tool: '🛠️ Tools',
        boost: '⚡ Boosts',
        collectible: '💎 Collectibles',
        lootbox: '📦 Loot Boxes',
        material: '🧱 Materials',
        property: '🏡 Property Items',
        special: '🌑 Special',
      };

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`🎒 ${interaction.user.username}'s Inventory`)
        .setFooter({ text: 'Use /inventory use <item_id> to use an item' });

      let totalValue = 0;
      for (const [cat, catItems] of Object.entries(categories)) {
        const lines = catItems.map(({ item, quantity }) => {
          totalValue += item.sellPrice * quantity;
          return `${item.emoji} **${item.name}** x${quantity} ${RARITY_COLORS[item.rarity]} — Sell: ${formatMoney(item.sellPrice)} each`;
        });
        embed.addFields({ name: CATEGORY_LABELS[cat] || cat, value: lines.join('\n'), inline: false });
      }

      embed.addFields({ name: '💰 Total Inventory Value', value: formatMoney(totalValue), inline: false });
      return interaction.editReply({ embeds: [embed] });
    }

    // ── USE ────────────────────────────────────────────────────────────────
    if (sub === 'use') {
      const itemId = interaction.options.getString('item').toLowerCase();
      const target = interaction.options.getString('target')?.toUpperCase();
      const item = getItem(itemId);

      if (!item) return interaction.editReply(`❌ Item **${itemId}** not found.`);
      if (!item.usable) return interaction.editReply(`❌ **${item.name}** cannot be used.`);

      const owned = inv.items.find((i) => i.itemId === itemId);
      if (!owned || owned.quantity < 1) {
        return interaction.editReply(`❌ You don't have **${item.name}** in your inventory.`);
      }

      // Remove item from inventory
      owned.quantity -= 1;
      if (owned.quantity <= 0) inv.items = inv.items.filter((i) => i.itemId !== itemId);

      let resultMsg = '';

      // Handle effects
      switch (item.effect) {
        case 'xp_boost':
          inv.activeEffects.push({ itemId, effect: 'xp_boost', effectValue: item.effectValue, expiresAt: new Date(Date.now() + item.effectDuration) });
          resultMsg = `⭐ **XP Booster** active! You get **2x XP** for **1 hour**!`;
          break;

        case 'work_boost':
          inv.activeEffects.push({ itemId, effect: 'work_boost', effectValue: item.effectValue, expiresAt: new Date(Date.now() + item.effectDuration) });
          resultMsg = `🧲 **Gold Magnet** active! Work pays **+25%** for **2 hours**!`;
          break;

        case 'farm_boost':
          inv.activeEffects.push({ itemId, effect: 'farm_boost', effectValue: item.effectValue, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
          resultMsg = `🌿 **Mega Fertilizer** applied! Next harvest gives **3x yield**!`;
          break;

        case 'business_boost':
          inv.activeEffects.push({ itemId, effect: 'business_boost', effectValue: item.effectValue, expiresAt: new Date(Date.now() + item.effectDuration) });
          resultMsg = `📢 **Billboard** active! Business income **+20%** for **24 hours**!`;
          break;

        case 'invisible':
          inv.activeEffects.push({ itemId, effect: 'invisible', effectValue: 1, expiresAt: new Date(Date.now() + item.effectDuration) });
          resultMsg = `👻 **Ghost Mode** active! You're hidden from leaderboards for **24 hours**!`;
          break;

        case 'skip_cooldowns':
          user.lastWork = null;
          user.lastDaily = null;
          resultMsg = `🪪 **VIP Card** used! All your cooldowns have been reset!`;
          break;

        case 'reset_all_cooldowns':
          user.lastWork = null;
          user.lastDaily = null;
          resultMsg = `⏰ **Time Warp** used! Every cooldown has been reset!`;
          break;

        case 'print_money':
          user.wallet += item.effectValue;
          resultMsg = `💰 **Money Printer** used! **${formatMoney(item.effectValue)}** added to your wallet!`;
          break;

        case 'collect_all_properties': {
          const RealEstate = require('../../models/RealEstate');
          const PROPERTIES = require('../game/realestate').PROPERTIES || {};
          const properties = await RealEstate.find({ userId: interaction.user.id });
          let total = 0;
          for (const p of properties) {
            const prop = PROPERTIES[p.propertyType];
            if (!prop) continue;
            const rent = Math.floor(Math.random() * (prop.maxRent - prop.minRent) + prop.minRent) * p.level;
            p.lastCollect = new Date();
            p.totalEarned += rent;
            await p.save();
            total += rent;
          }
          user.wallet += total;
          resultMsg = `🔑 **Master Key** used! Collected **${formatMoney(total)}** from all **${properties.length}** properties!`;
          break;
        }

        case 'crash_asset': {
          if (!target) return interaction.editReply('❌ Please specify an asset symbol to crash! `/inventory use market_bomb target:BTC`');
          const asset = await Asset.findOne({ symbol: target, active: true });
          if (!asset) return interaction.editReply(`❌ Asset **${target}** not found.`);
          const oldPrice = asset.currentPrice;
          asset.currentPrice = parseFloat((oldPrice * (1 - item.effectValue)).toFixed(2));
          asset.previousPrice = oldPrice;
          asset.trend = -1;
          await asset.save();
          resultMsg = `💣 **Market Bomb** used on **${target}**! Price dropped from **${formatMoney(oldPrice)}** to **${formatMoney(asset.currentPrice)}**!`;
          break;
        }

        case 'pump_asset': {
          if (!target) return interaction.editReply('❌ Please specify an asset symbol! `/inventory use pump_kit target:BTC`');
          const asset = await Asset.findOne({ symbol: target, active: true });
          if (!asset) return interaction.editReply(`❌ Asset **${target}** not found.`);
          const oldPrice = asset.currentPrice;
          asset.currentPrice = parseFloat((oldPrice * (1 + item.effectValue)).toFixed(2));
          asset.previousPrice = oldPrice;
          asset.trend = 1;
          await asset.save();
          resultMsg = `🚀 **Pump Kit** used on **${target}**! Price pumped from **${formatMoney(oldPrice)}** to **${formatMoney(asset.currentPrice)}**!`;
          break;
        }

        case 'lootbox_common':
        case 'lootbox_rare':
        case 'lootbox_epic':
        case 'lootbox_legendary':
        case 'lootbox_cursed': {
          const tier = item.effect.replace('lootbox_', '');
          const roll = rollLootBox(tier);
          if (!roll) { resultMsg = '❌ Failed to open box.'; break; }

          const rolledItem = getItem(roll.itemId);
          user.wallet += roll.cashAmount;

          // Add rolled item to inventory
          const existingRolled = inv.items.find((i) => i.itemId === roll.itemId);
          if (existingRolled) {
            existingRolled.quantity += 1;
          } else {
            inv.items.push({ itemId: roll.itemId, quantity: 1 });
          }

          const cashText = roll.cashAmount >= 0 ? `+${formatMoney(roll.cashAmount)}` : formatMoney(roll.cashAmount);
          resultMsg = `📦 **${item.name}** opened!\n\n🎁 You got: **${rolledItem?.emoji || '❓'} ${rolledItem?.name || roll.itemId}** ${RARITY_COLORS[rolledItem?.rarity || 'common']}\n💰 Cash: **${cashText}**`;
          break;
        }

        case 'market_peek': {
          if (!target) return interaction.editReply('❌ Specify an asset symbol! `/inventory use telescope target:BTC`');
          const asset = await Asset.findOne({ symbol: target, active: true });
          if (!asset) return interaction.editReply(`❌ Asset **${target}** not found.`);
          const trendLabel = asset.trend > 0.3 ? '📈 Bullish' : asset.trend < -0.3 ? '📉 Bearish' : '➡️ Neutral';
          resultMsg = `🔭 **Telescope** used on **${target}**!\n\nCurrent trend: **${trendLabel}**\nVolatility: **${(asset.volatility * 100).toFixed(1)}%**\nBuy pressure: **${asset.buyPressure.toFixed(2)}** | Sell pressure: **${asset.sellPressure.toFixed(2)}**`;
          break;
        }

        default:
          resultMsg = `✅ Used **${item.name}**!`;
      }

      await inv.save();
      await user.save();

      const embed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle(`${item.emoji} Item Used!`)
        .setDescription(resultMsg)
        .addFields({ name: '💰 Wallet', value: formatMoney(user.wallet), inline: true });

      return interaction.editReply({ embeds: [embed] });
    }

    // ── EFFECTS ────────────────────────────────────────────────────────────
    if (sub === 'effects') {
      // Clean expired effects
      inv.activeEffects = inv.activeEffects.filter((e) => new Date() < new Date(e.expiresAt));
      await inv.save();

      if (inv.activeEffects.length === 0) {
        return interaction.editReply('📭 No active effects right now. Use items from your `/inventory view`!');
      }

      const lines = inv.activeEffects.map((e) => {
        const item = getItem(e.itemId);
        const timeLeft = new Date(e.expiresAt) - Date.now();
        const mins = Math.floor(timeLeft / 60000);
        const hrs = Math.floor(mins / 60);
        const timeStr = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
        return `${item?.emoji || '✨'} **${item?.name || e.effect}** — Expires in **${timeStr}**`;
      });

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('✨ Active Effects')
        .setDescription(lines.join('\n'));

      return interaction.editReply({ embeds: [embed] });
    }
  },
};