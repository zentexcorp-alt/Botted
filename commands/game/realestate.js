const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const RealEstate = require('../../models/RealEstate');
const { getOrCreateUser, formatMoney, formatDuration, checkCooldown, randInt } = require('../../utils/helpers');

const PROPERTIES = {
  apartment:  { name: '🏠 Apartment',   cost: 10000,  cooldown: 60 * 60 * 1000,       minRent: 200,   maxRent: 400,   maxLevel: 5 },
  house:      { name: '🏡 House',        cost: 35000,  cooldown: 2 * 60 * 60 * 1000,   minRent: 600,   maxRent: 1000,  maxLevel: 5 },
  villa:      { name: '🏘️ Villa',        cost: 100000, cooldown: 4 * 60 * 60 * 1000,   minRent: 2000,  maxRent: 3500,  maxLevel: 5 },
  office:     { name: '🏢 Office Block', cost: 250000, cooldown: 6 * 60 * 60 * 1000,   minRent: 5000,  maxRent: 8000,  maxLevel: 5 },
  skyscraper: { name: '🏙️ Skyscraper',  cost: 1000000,cooldown: 12 * 60 * 60 * 1000,  minRent: 20000, maxRent: 40000, maxLevel: 5 },
};

const UPGRADE_COST_MULT = 0.3; // 30% of purchase price per level

module.exports = {
  data: new SlashCommandBuilder()
    .setName('realestate')
    .setDescription('Buy and manage properties')
    .addSubcommand((sub) =>
      sub.setName('buy')
        .setDescription('Buy a property')
        .addStringOption((o) =>
          o.setName('type').setDescription('Property type').setRequired(true)
            .addChoices(
              { name: '🏠 Apartment ($10,000)', value: 'apartment' },
              { name: '🏡 House ($35,000)', value: 'house' },
              { name: '🏘️ Villa ($100,000)', value: 'villa' },
              { name: '🏢 Office Block ($250,000)', value: 'office' },
              { name: '🏙️ Skyscraper ($1,000,000)', value: 'skyscraper' }
            )
        )
        .addStringOption((o) => o.setName('name').setDescription('Property name').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('View all your properties'))
    .addSubcommand((sub) =>
      sub.setName('collect')
        .setDescription('Collect rent from a property')
        .addStringOption((o) => o.setName('name').setDescription('Property name').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('collectall').setDescription('Collect rent from all properties'))
    .addSubcommand((sub) =>
      sub.setName('upgrade')
        .setDescription('Upgrade a property')
        .addStringOption((o) => o.setName('name').setDescription('Property name').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('sell')
        .setDescription('Sell a property')
        .addStringOption((o) => o.setName('name').setDescription('Property name').setRequired(true))
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();
    const user = await getOrCreateUser(interaction.user.id, interaction.user.username);

    if (sub === 'buy') {
      const typeKey = interaction.options.getString('type');
      const name = interaction.options.getString('name');
      const prop = PROPERTIES[typeKey];

      if (user.wallet < prop.cost) return interaction.editReply(`❌ You need **${formatMoney(prop.cost)}**. You have **${formatMoney(user.wallet)}**.`);

      user.wallet -= prop.cost;
      await user.save();

      await RealEstate.create({
        userId: interaction.user.id,
        propertyType: typeKey,
        name,
        purchasePrice: prop.cost,
        currentValue: prop.cost,
      });

      const embed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle('🏠 Property Purchased!')
        .addFields(
          { name: 'Property', value: `${prop.name} — "${name}"`, inline: true },
          { name: 'Cost', value: formatMoney(prop.cost), inline: true },
          { name: 'Rent Income', value: `${formatMoney(prop.minRent)}–${formatMoney(prop.maxRent)} per collect`, inline: true },
          { name: 'Collect Every', value: formatDuration(prop.cooldown), inline: true }
        );

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'list') {
      const properties = await RealEstate.find({ userId: interaction.user.id });
      if (properties.length === 0) return interaction.editReply('📭 You own no properties. Use `/realestate buy` to invest!');

      const lines = properties.map((p) => {
        const prop = PROPERTIES[p.propertyType];
        const { ready, remaining } = checkCooldown(p.lastCollect, prop.cooldown);
        return `${prop.name} — **"${p.name}"** | Lv${p.level} | ${ready ? '✅ Ready' : `⏳ ${formatDuration(remaining)}`} | Earned: ${formatMoney(p.totalEarned)}`;
      });

      const totalValue = properties.reduce((a, p) => a + p.currentValue, 0);

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('🏠 Your Properties')
        .setDescription(lines.join('\n'))
        .addFields({ name: '💎 Total Portfolio Value', value: formatMoney(totalValue), inline: false });

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'collect') {
      const name = interaction.options.getString('name');
      const property = await RealEstate.findOne({ userId: interaction.user.id, name });
      if (!property) return interaction.editReply(`❌ Property **"${name}"** not found.`);

      const prop = PROPERTIES[property.propertyType];
      const { ready, remaining } = checkCooldown(property.lastCollect, prop.cooldown);
      if (!ready) return interaction.editReply(`⏳ Come back in **${formatDuration(remaining)}** to collect rent.`);

      const rent = randInt(prop.minRent, prop.maxRent) * property.level;
      property.lastCollect = new Date();
      property.totalEarned += rent;
      property.currentValue = Math.floor(property.currentValue * (1 + randInt(-2, 5) / 100));
      await property.save();

      user.wallet += rent;
      await user.save();

      return interaction.editReply(`🏠 Collected **${formatMoney(rent)}** rent from **"${name}"**! Wallet: ${formatMoney(user.wallet)}`);
    }

    if (sub === 'collectall') {
      const properties = await RealEstate.find({ userId: interaction.user.id });
      if (properties.length === 0) return interaction.editReply('📭 You own no properties.');

      let total = 0;
      let collected = 0;

      for (const property of properties) {
        const prop = PROPERTIES[property.propertyType];
        const { ready } = checkCooldown(property.lastCollect, prop.cooldown);
        if (!ready) continue;

        const rent = randInt(prop.minRent, prop.maxRent) * property.level;
        property.lastCollect = new Date();
        property.totalEarned += rent;
        await property.save();
        total += rent;
        collected++;
      }

      if (collected === 0) return interaction.editReply('⏳ No properties are ready to collect yet!');

      user.wallet += total;
      await user.save();

      return interaction.editReply(`✅ Collected rent from **${collected}** properties! Total: **${formatMoney(total)}**`);
    }

    if (sub === 'upgrade') {
      const name = interaction.options.getString('name');
      const property = await RealEstate.findOne({ userId: interaction.user.id, name });
      if (!property) return interaction.editReply(`❌ Property **"${name}"** not found.`);

      const prop = PROPERTIES[property.propertyType];
      if (property.level >= prop.maxLevel) return interaction.editReply('✅ This property is at **Max Level**!');

      const cost = Math.floor(property.purchasePrice * UPGRADE_COST_MULT * property.level);
      if (user.wallet < cost) return interaction.editReply(`❌ Upgrade costs **${formatMoney(cost)}**. You have **${formatMoney(user.wallet)}**.`);

      user.wallet -= cost;
      await user.save();

      property.level += 1;
      property.currentValue += cost;
      await property.save();

      return interaction.editReply(`✅ **"${name}"** upgraded to **Level ${property.level}**! Rent income increased.`);
    }

    if (sub === 'sell') {
      const name = interaction.options.getString('name');
      const property = await RealEstate.findOne({ userId: interaction.user.id, name });
      if (!property) return interaction.editReply(`❌ Property **"${name}"** not found.`);

      const sellPrice = Math.floor(property.currentValue * 0.8);
      user.wallet += sellPrice;
      await user.save();

      await RealEstate.deleteOne({ _id: property._id });

      return interaction.editReply(`🏚️ Sold **"${name}"** for **${formatMoney(sellPrice)}**! (80% of current value)`);
    }
  },
};