const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ADMIN_IDS } = require('../../config');
const BlackMarket = require('../../models/BlackMarket');
const { formatMoney } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('adminblackmarket')
    .setDescription('Admin Black Market controls')
    .addSubcommand((sub) =>
      sub.setName('open')
        .setDescription('Open the Black Market')
        .addIntegerOption((o) => o.setName('duration').setDescription('Duration in minutes').setRequired(true).setMinValue(5).setMaxValue(180))
        .addChannelOption((o) => o.setName('channel').setDescription('Channel to announce in').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('close').setDescription('Force close the Black Market'))
    .addSubcommand((sub) =>
      sub.setName('additem')
        .setDescription('Add item to the next Black Market (before opening)')
        .addStringOption((o) => o.setName('name').setDescription('Item name').setRequired(true))
        .addStringOption((o) => o.setName('description').setDescription('Item description').setRequired(true))
        .addNumberOption((o) => o.setName('price').setDescription('Price per unit').setRequired(true).setMinValue(1))
        .addIntegerOption((o) => o.setName('stock').setDescription('Stock quantity').setRequired(true).setMinValue(1))
        .addStringOption((o) =>
          o.setName('type').setDescription('Item type').setRequired(true)
            .addChoices(
              { name: 'Commodity (adds to warehouse)', value: 'commodity' },
              { name: 'Cash (adds to wallet)', value: 'cash' },
              { name: 'Special', value: 'special' },
            )
        )
        .addStringOption((o) => o.setName('symbol').setDescription('Commodity symbol (if type is commodity)'))
        .addNumberOption((o) => o.setName('quantity').setDescription('Quantity per purchase (if commodity)').setMinValue(0.01))
        .addNumberOption((o) => o.setName('cashvalue').setDescription('Cash amount (if type is cash)').setMinValue(1))
    )
    .addSubcommand((sub) => sub.setName('status').setDescription('View Black Market status'))
    .addSubcommand((sub) => sub.setName('clearitems').setDescription('Clear pending items list')),

  async execute(interaction) {
    if (!ADMIN_IDS.includes(interaction.user.id)) {
      return interaction.reply({ content: '❌ No permission.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();

    // Store pending items in a temp collection
    const BotSettings = require('../../models/BotSettings');

    if (sub === 'additem') {
      const name = interaction.options.getString('name');
      const description = interaction.options.getString('description');
      const price = interaction.options.getNumber('price');
      const stock = interaction.options.getInteger('stock');
      const type = interaction.options.getString('type');
      const symbol = interaction.options.getString('symbol')?.toUpperCase() || null;
      const quantity = interaction.options.getNumber('quantity') || 1;
      const cashValue = interaction.options.getNumber('cashvalue') || 0;

      // Store in BotSettings as pending items
      let settings = await BotSettings.findOne({ key: 'bm_pending_items' });
      const items = settings ? JSON.parse(settings.value) : [];

      items.push({
        name, description, price,
        stock, originalStock: stock,
        type, symbol, quantity,
        effectValue: cashValue,
      });

      await BotSettings.findOneAndUpdate(
        { key: 'bm_pending_items' },
        { key: 'bm_pending_items', value: JSON.stringify(items), updatedAt: new Date() },
        { upsert: true }
      );

      return interaction.editReply(`✅ Added **${name}** to pending Black Market items. (${items.length} items total)\nUse \`/adminblackmarket open\` to launch!`);
    }

    if (sub === 'clearitems') {
      await BotSettings.findOneAndUpdate(
        { key: 'bm_pending_items' },
        { key: 'bm_pending_items', value: '[]', updatedAt: new Date() },
        { upsert: true }
      );
      return interaction.editReply('✅ Cleared all pending Black Market items.');
    }

    if (sub === 'open') {
      const duration = interaction.options.getInteger('duration');
      const channel = interaction.options.getChannel('channel');

      // Check no market already open
      const existing = await BlackMarket.findOne({ guildId: interaction.guildId, active: true });
      if (existing) return interaction.editReply('❌ A Black Market is already open! Close it first.');

      // Get pending items
      const settings = await BotSettings.findOne({ key: 'bm_pending_items' });
      const items = settings ? JSON.parse(settings.value) : [];

      if (items.length === 0) {
        return interaction.editReply('❌ No items added yet! Use \`/adminblackmarket additem\` to add items first.');
      }

      const closesAt = new Date(Date.now() + duration * 60 * 1000);

      const market = await BlackMarket.create({
        guildId: interaction.guildId,
        channelId: channel.id,
        items,
        closesAt,
        active: true,
        openedBy: interaction.user.id,
      });

      // Clear pending items
      await BotSettings.findOneAndUpdate(
        { key: 'bm_pending_items' },
        { key: 'bm_pending_items', value: '[]', updatedAt: new Date() },
        { upsert: true }
      );

      // Announce in channel
      const itemLines = items.map((i) => `• **${i.name}** — ${formatMoney(i.price)} | Stock: ${i.stock}\n  ${i.description}`);

      const announceEmbed = new EmbedBuilder()
        .setColor(0x2c2f33)
        .setTitle('🌑 BLACK MARKET IS OPEN!')
        .setDescription('The Black Market has appeared! Buy exclusive items before they run out or it closes!')
        .addFields(
          { name: '🛒 Items Available', value: itemLines.join('\n\n'), inline: false },
          { name: '⏰ Closes', value: `<t:${Math.floor(closesAt.getTime() / 1000)}:R>`, inline: true },
          { name: '📢 How to Buy', value: 'Use `/blackmarket view` to browse and `/blackmarket buy <item>` to purchase!', inline: false },
        )
        .setFooter({ text: 'Limited stock — first come first served!' });

      await channel.send({ content: '@everyone', embeds: [announceEmbed] });

      // Auto close
      setTimeout(async () => {
        const m = await BlackMarket.findById(market._id);
        if (m && m.active) {
          m.active = false;
          await m.save();
          try {
            await channel.send('🌑 **Black Market** has closed! See you next time.');
          } catch {}
        }
      }, duration * 60 * 1000);

      return interaction.editReply(`✅ Black Market opened in ${channel} for **${duration} minutes** with **${items.length} items**!`);
    }

    if (sub === 'close') {
      const market = await BlackMarket.findOne({ guildId: interaction.guildId, active: true });
      if (!market) return interaction.editReply('❌ No Black Market is currently open.');

      market.active = false;
      await market.save();

      try {
        const channel = await interaction.client.channels.fetch(market.channelId);
        await channel.send('🌑 **Black Market** has been closed by admin.');
      } catch {}

      return interaction.editReply('✅ Black Market closed.');
    }

    if (sub === 'status') {
      const market = await BlackMarket.findOne({ guildId: interaction.guildId, active: true });
      const settings = await BotSettings.findOne({ key: 'bm_pending_items' });
      const pendingItems = settings ? JSON.parse(settings.value) : [];

      if (!market) {
        const embed = new EmbedBuilder()
          .setColor(0x2c2f33)
          .setTitle('🌑 Black Market Status')
          .setDescription('**Status: CLOSED**')
          .addFields({
            name: `📋 Pending Items (${pendingItems.length})`,
            value: pendingItems.length > 0
              ? pendingItems.map((i) => `• **${i.name}** — ${formatMoney(i.price)} | Stock: ${i.stock}`).join('\n')
              : 'None — add with `/adminblackmarket additem`',
            inline: false,
          });

        return interaction.editReply({ embeds: [embed] });
      }

      const itemLines = market.items.map((i) =>
        `• **${i.name}** — ${formatMoney(i.price)} | ${i.stock}/${i.originalStock} left`
      );

      const embed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle('🌑 Black Market Status')
        .setDescription('**Status: OPEN**')
        .addFields(
          { name: '⏰ Closes', value: `<t:${Math.floor(market.closesAt.getTime() / 1000)}:R>`, inline: true },
          { name: '👥 Buyers', value: `${market.buyers.length}`, inline: true },
          { name: '🛒 Items', value: itemLines.join('\n'), inline: false },
        );

      return interaction.editReply({ embeds: [embed] });
    }
  },
};