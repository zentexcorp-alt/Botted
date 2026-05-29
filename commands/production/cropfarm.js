const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Production = require('../../models/Production');
const { getOrCreateUser, formatMoney, formatDuration, checkCooldown } = require('../../utils/helpers');
const { getOrCreateWarehouse, addToWarehouse, PRODUCTION_TYPES, CROP_TYPES } = require('../../utils/productionEngine');
const Asset = require('../../models/Asset');

const COLLECT_COOLDOWN = 60 * 60 * 1000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cropfarm')
    .setDescription('Manage your crop farms')
    .addSubcommand((sub) =>
      sub.setName('buy')
        .setDescription('Buy a crop farm')
        .addStringOption((o) =>
          o.setName('type').setDescription('Farm size').setRequired(true)
            .addChoices(
              { name: '🌾 Small Farm ($10,000)', value: 'farm_0' },
              { name: '🌾 Medium Farm ($40,000)', value: 'farm_1' },
              { name: '🌾 Large Farm ($150,000)', value: 'farm_2' },
              { name: '🌾 Industrial Farm ($500,000)', value: 'farm_3' },
            )
        )
        .addStringOption((o) => o.setName('name').setDescription('Farm name').setRequired(true))
        .addStringOption((o) =>
          o.setName('crop').setDescription('What to grow').setRequired(true)
            .addChoices(
              { name: '🌽 Corn (CORN)', value: 'CORN' },
              { name: '🌾 Wheat (WEAT)', value: 'WEAT' },
              { name: '☕ Coffee (COFF)', value: 'COFF' },
            )
        )
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('View all your farms'))
    .addSubcommand((sub) => sub.setName('collect').setDescription('Collect from all farms'))
    .addSubcommand((sub) =>
      sub.setName('setcrop')
        .setDescription('Change what a farm grows')
        .addStringOption((o) => o.setName('name').setDescription('Farm name').setRequired(true))
        .addStringOption((o) =>
          o.setName('crop').setDescription('New crop').setRequired(true)
            .addChoices(
              { name: '🌽 Corn', value: 'CORN' },
              { name: '🌾 Wheat', value: 'WEAT' },
              { name: '☕ Coffee', value: 'COFF' },
            )
        )
    )
    .addSubcommand((sub) =>
      sub.setName('upgrade')
        .setDescription('Upgrade a farm')
        .addStringOption((o) => o.setName('name').setDescription('Farm name').setRequired(true))
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();
    const user = await getOrCreateUser(interaction.user.id, interaction.user.username);

    if (sub === 'buy') {
      const typeStr = interaction.options.getString('type');
      const name = interaction.options.getString('name');
      const crop = interaction.options.getString('crop');
      const tierIndex = parseInt(typeStr.split('_')[1]);
      const prodInfo = PRODUCTION_TYPES.crop_farm;
      const tier = prodInfo.tiers[tierIndex];

      if (user.wallet < tier.cost) {
        return interaction.editReply(`❌ Need **${formatMoney(tier.cost)}**. You have **${formatMoney(user.wallet)}**.`);
      }

      user.wallet -= tier.cost;
      await user.save();

      await Production.create({
        userId: interaction.user.id,
        type: 'crop_farm',
        name,
        level: tierIndex + 1,
        outputPerHour: tier.outputPerHour,
        cropType: crop,
      });

      const cropEmoji = { CORN: '🌽', WEAT: '🌾', COFF: '☕' }[crop] || '🌱';

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('✅ Crop Farm Purchased!')
        .addFields(
          { name: 'Name', value: name, inline: true },
          { name: 'Tier', value: tier.name, inline: true },
          { name: 'Crop', value: `${cropEmoji} ${crop}`, inline: true },
          { name: 'Output/hr', value: `${tier.outputPerHour} bushels`, inline: true },
          { name: 'Cost', value: formatMoney(tier.cost), inline: true }
        );

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'list') {
      const farms = await Production.find({
        userId: interaction.user.id,
        type: 'crop_farm',
        active: true,
      });

      if (farms.length === 0) return interaction.editReply('📭 No farms owned. Buy one with `/cropfarm buy`!');

      const prices = {};
      for (const crop of CROP_TYPES) {
        const asset = await Asset.findOne({ symbol: crop, active: true });
        prices[crop] = asset?.currentPrice || 0;
      }

      const lines = farms.map((f) => {
        const cropEmoji = { CORN: '🌽', WEAT: '🌾', COFF: '☕' }[f.cropType] || '🌱';
        const price = prices[f.cropType] || 0;
        const hourlyValue = f.outputPerHour * price;
        const { ready, remaining } = checkCooldown(f.lastCollect, COLLECT_COOLDOWN);
        return [
          `**${f.name}** — ${cropEmoji} ${f.cropType} (Lv${f.level})`,
          `Output: **${f.outputPerHour} bushels/hr** worth **${formatMoney(hourlyValue)}/hr**`,
          `Collect: ${ready ? '✅ Ready!' : `⏳ ${formatDuration(remaining)}`}`,
        ].join('\n');
      });

      const priceLines = CROP_TYPES.map((c) => {
        const emoji = { CORN: '🌽', WEAT: '🌾', COFF: '☕' }[c];
        return `${emoji} ${c}: **${formatMoney(prices[c])}/bushel**`;
      });

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('🌾 Your Crop Farms')
        .setDescription(lines.join('\n\n'))
        .addFields({ name: '📊 Current Crop Prices', value: priceLines.join(' | '), inline: false });

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'collect') {
      const farms = await Production.find({
        userId: interaction.user.id,
        type: 'crop_farm',
        active: true,
      });

      if (farms.length === 0) return interaction.editReply('📭 No farms to collect from!');

      const prices = {};
      for (const crop of CROP_TYPES) {
        const asset = await Asset.findOne({ symbol: crop, active: true });
        prices[crop] = asset?.currentPrice || 0;
      }

      const warehouse = await getOrCreateWarehouse(interaction.user.id);
      const collected_amounts = {};
      let collected = 0;

      for (const farm of farms) {
        const { ready } = checkCooldown(farm.lastCollect, COLLECT_COOLDOWN);
        if (!ready || !farm.cropType) continue;

        const hours = Math.min(
          (Date.now() - new Date(farm.lastCollect).getTime()) / (60 * 60 * 1000),
          24
        );
        const produced = parseFloat((farm.outputPerHour * hours).toFixed(2));

        addToWarehouse(warehouse, farm.cropType, produced);
        collected_amounts[farm.cropType] = (collected_amounts[farm.cropType] || 0) + produced;

        farm.lastCollect = new Date();
        farm.totalProduced += produced;
        await farm.save();
        collected++;
      }

      if (collected === 0) return interaction.editReply('⏳ No farms ready to collect yet!');

      await warehouse.save();

      const lines = Object.entries(collected_amounts).map(([crop, qty]) => {
        const emoji = { CORN: '🌽', WEAT: '🌾', COFF: '☕' }[crop] || '🌱';
        const value = qty * (prices[crop] || 0);
        return `${emoji} **${crop}**: ${qty.toFixed(2)} bushels (~${formatMoney(value)})`;
      });

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('🌾 Harvest Complete!')
        .setDescription('Crops added to your **Warehouse**!\n\n' + lines.join('\n'));

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'setcrop') {
      const name = interaction.options.getString('name');
      const crop = interaction.options.getString('crop');
      const farm = await Production.findOne({ userId: interaction.user.id, name, type: 'crop_farm', active: true });
      if (!farm) return interaction.editReply(`❌ Farm **"${name}"** not found.`);

      farm.cropType = crop;
      await farm.save();

      const cropEmoji = { CORN: '🌽', WEAT: '🌾', COFF: '☕' }[crop];
      return interaction.editReply(`✅ **${name}** is now growing ${cropEmoji} **${crop}**!`);
    }

    if (sub === 'upgrade') {
      const name = interaction.options.getString('name');
      const farm = await Production.findOne({ userId: interaction.user.id, name, type: 'crop_farm', active: true });
      if (!farm) return interaction.editReply(`❌ Farm **"${name}"** not found.`);

      const prodInfo = PRODUCTION_TYPES.crop_farm;
      if (farm.level >= prodInfo.tiers.length) return interaction.editReply('✅ Already at max level!');

      const nextTier = prodInfo.tiers[farm.level];
      const cost = Math.floor(nextTier.cost * prodInfo.upgradeCostMult);

      if (user.wallet < cost) return interaction.editReply(`❌ Upgrade costs **${formatMoney(cost)}**.`);

      user.wallet -= cost;
      await user.save();

      farm.level += 1;
      farm.outputPerHour = nextTier.outputPerHour;
      await farm.save();

      return interaction.editReply(`✅ **${name}** upgraded to **Level ${farm.level}**! Output: **${farm.outputPerHour} bushels/hr**`);
    }
  },
};