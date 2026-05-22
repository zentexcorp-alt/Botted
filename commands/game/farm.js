const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Farm = require('../../models/Farm');
const { getOrCreateUser, formatMoney, formatDuration, randInt } = require('../../utils/helpers');

const CROPS = {
  wheat:    { name: '🌾 Wheat',       cost: 50,    growTime: 10 * 60 * 1000,       minYield: 100,   maxYield: 200,   level: 1 },
  corn:     { name: '🌽 Corn',        cost: 120,   growTime: 30 * 60 * 1000,       minYield: 250,   maxYield: 450,   level: 1 },
  tomato:   { name: '🍅 Tomato',      cost: 200,   growTime: 60 * 60 * 1000,       minYield: 400,   maxYield: 700,   level: 2 },
  strawberry:{ name: '🍓 Strawberry', cost: 400,   growTime: 2 * 60 * 60 * 1000,   minYield: 800,   maxYield: 1400,  level: 2 },
  pumpkin:  { name: '🎃 Pumpkin',     cost: 600,   growTime: 4 * 60 * 60 * 1000,   minYield: 1200,  maxYield: 2000,  level: 3 },
  grape:    { name: '🍇 Grape',       cost: 1000,  growTime: 6 * 60 * 60 * 1000,   minYield: 2000,  maxYield: 3500,  level: 3 },
  truffle:  { name: '🍄 Truffle',     cost: 3000,  growTime: 12 * 60 * 60 * 1000,  minYield: 6000,  maxYield: 10000, level: 5 },
  dragon:   { name: '🐉 Dragon Fruit',cost: 8000,  growTime: 24 * 60 * 60 * 1000,  minYield: 16000, maxYield: 28000, level: 7 },
};

const LEVEL_PLOTS = [0, 3, 4, 5, 6, 7, 8, 9, 10];
const UPGRADE_COSTS = [0, 5000, 15000, 35000, 70000, 120000, 200000, 300000];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('farm')
    .setDescription('Manage your farm')
    .addSubcommand((sub) => sub.setName('start').setDescription('Start your farm'))
    .addSubcommand((sub) =>
      sub.setName('plant')
        .setDescription('Plant a crop')
        .addStringOption((o) =>
          o.setName('crop').setDescription('Crop to plant').setRequired(true)
            .addChoices(
              { name: '🌾 Wheat ($50)', value: 'wheat' },
              { name: '🌽 Corn ($120)', value: 'corn' },
              { name: '🍅 Tomato ($200)', value: 'tomato' },
              { name: '🍓 Strawberry ($400)', value: 'strawberry' },
              { name: '🎃 Pumpkin ($600)', value: 'pumpkin' },
              { name: '🍇 Grape ($1,000)', value: 'grape' },
              { name: '🍄 Truffle ($3,000)', value: 'truffle' },
              { name: '🐉 Dragon Fruit ($8,000)', value: 'dragon' }
            )
        )
    )
    .addSubcommand((sub) => sub.setName('harvest').setDescription('Harvest all ready crops'))
    .addSubcommand((sub) => sub.setName('info').setDescription('View your farm'))
    .addSubcommand((sub) => sub.setName('water').setDescription('Water your crops for a growth boost'))
    .addSubcommand((sub) => sub.setName('fertilize').setDescription('Fertilize your farm ($500) for 2x yield'))
    .addSubcommand((sub) => sub.setName('upgrade').setDescription('Upgrade your farm for more plots')),

  async execute(interaction) {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();
    const user = await getOrCreateUser(interaction.user.id, interaction.user.username);

    if (sub === 'start') {
      const existing = await Farm.findOne({ userId: interaction.user.id });
      if (existing) return interaction.editReply('❌ You already have a farm! Use `/farm info` to view it.');

      await Farm.create({ userId: interaction.user.id });

      const embed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle('🌾 Farm Started!')
        .setDescription('Your farm is ready! You have **3 plots** to start.')
        .addFields(
          { name: '🌱 Next Step', value: 'Use `/farm plant <crop>` to plant your first crop!', inline: false },
          { name: '💡 Tip', value: 'Water your crops with `/farm water` to speed up growth!', inline: false }
        );

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'plant') {
      const farm = await Farm.findOne({ userId: interaction.user.id });
      if (!farm) return interaction.editReply('❌ You don\'t have a farm! Use `/farm start` first.');

      const cropKey = interaction.options.getString('crop');
      const crop = CROPS[cropKey];

      if (user.level < crop.level) return interaction.editReply(`❌ You need **Level ${crop.level}** to plant ${crop.name}.`);

      const activeCrops = farm.crops.filter((c) => !c.harvested).length;
      if (activeCrops >= farm.plots) return interaction.editReply(`❌ All **${farm.plots} plots** are full! Harvest first or upgrade your farm.`);

      if (user.wallet < crop.cost) return interaction.editReply(`❌ You need **${formatMoney(crop.cost)}** to plant ${crop.name}.`);

      user.wallet -= crop.cost;
      await user.save();

      const growTime = farm.fertilized ? crop.growTime * 0.5 : crop.growTime;
      const readyAt = new Date(Date.now() + growTime);

      farm.crops.push({ cropType: cropKey, readyAt, quantity: 1 });
      await farm.save();

      return interaction.editReply(`🌱 Planted ${crop.name}! Ready in **${formatDuration(growTime)}**${farm.fertilized ? ' (fertilizer 2x applied!)' : ''}.`);
    }

    if (sub === 'harvest') {
      const farm = await Farm.findOne({ userId: interaction.user.id });
      if (!farm) return interaction.editReply('❌ You don\'t have a farm!');

      const ready = farm.crops.filter((c) => !c.harvested && new Date() >= new Date(c.readyAt));
      if (ready.length === 0) return interaction.editReply('⏳ No crops are ready to harvest yet! Use `/farm info` to check timers.');

      let totalEarned = 0;
      const lines = [];

      for (const crop of ready) {
        const info = CROPS[crop.cropType];
        const yield_ = randInt(info.minYield, info.maxYield) * (farm.fertilized ? 2 : 1);
        totalEarned += yield_;
        lines.push(`${info.name} → **${formatMoney(yield_)}**`);
        crop.harvested = true;
      }

      // Clean harvested crops
      farm.crops = farm.crops.filter((c) => !c.harvested);
      farm.totalHarvested += totalEarned;
      farm.fertilized = false;
      await farm.save();

      user.wallet += totalEarned;
      await user.save();

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('🌾 Harvest Complete!')
        .setDescription(lines.join('\n'))
        .addFields(
          { name: '💰 Total Earned', value: formatMoney(totalEarned), inline: true },
          { name: '🪙 Wallet', value: formatMoney(user.wallet), inline: true }
        );

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'info') {
      const farm = await Farm.findOne({ userId: interaction.user.id });
      if (!farm) return interaction.editReply('❌ You don\'t have a farm! Use `/farm start` first.');

      const activeCrops = farm.crops.filter((c) => !c.harvested);
      const cropLines = activeCrops.length > 0
        ? activeCrops.map((c) => {
            const info = CROPS[c.cropType];
            const ready = new Date() >= new Date(c.readyAt);
            const remaining = new Date(c.readyAt) - Date.now();
            return `${info.name} — ${ready ? '✅ Ready!' : `⏳ ${formatDuration(remaining)}`}`;
          }).join('\n')
        : 'No crops planted';

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('🌾 Your Farm')
        .addFields(
          { name: 'Level', value: `${farm.level}`, inline: true },
          { name: 'Plots', value: `${activeCrops.length}/${farm.plots} used`, inline: true },
          { name: 'Fertilized', value: farm.fertilized ? '✅ Yes' : '❌ No', inline: true },
          { name: 'Total Harvested', value: formatMoney(farm.totalHarvested), inline: true },
          { name: '🌱 Crops', value: cropLines, inline: false }
        );

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'water') {
      const farm = await Farm.findOne({ userId: interaction.user.id });
      if (!farm) return interaction.editReply('❌ You don\'t have a farm!');

      const now = Date.now();
      const lastWatered = farm.lastWatered ? new Date(farm.lastWatered).getTime() : 0;
      if (now - lastWatered < 60 * 60 * 1000) {
        return interaction.editReply(`⏳ You already watered! Come back in **${formatDuration(60 * 60 * 1000 - (now - lastWatered))}**.`);
      }

      // Speed up all crops by 10%
      for (const crop of farm.crops.filter((c) => !c.harvested)) {
        const remaining = new Date(crop.readyAt).getTime() - now;
        if (remaining > 0) crop.readyAt = new Date(now + remaining * 0.9);
      }

      farm.lastWatered = new Date();
      await farm.save();

      return interaction.editReply('💧 Crops watered! Growth speed increased by **10%**.');
    }

    if (sub === 'fertilize') {
      const farm = await Farm.findOne({ userId: interaction.user.id });
      if (!farm) return interaction.editReply('❌ You don\'t have a farm!');
      if (farm.fertilized) return interaction.editReply('✅ Your farm is already fertilized!');
      if (user.wallet < 500) return interaction.editReply('❌ Fertilizing costs **$500**.');

      user.wallet -= 500;
      await user.save();
      farm.fertilized = true;
      await farm.save();

      return interaction.editReply('🌿 Farm fertilized! Next harvest gives **2x yield** and **50% faster growth**!');
    }

    if (sub === 'upgrade') {
      const farm = await Farm.findOne({ userId: interaction.user.id });
      if (!farm) return interaction.editReply('❌ You don\'t have a farm!');
      if (farm.level >= 8) return interaction.editReply('✅ Your farm is at **Max Level**!');

      const cost = UPGRADE_COSTS[farm.level];
      if (user.wallet < cost) return interaction.editReply(`❌ Upgrade costs **${formatMoney(cost)}**. You have **${formatMoney(user.wallet)}**.`);

      user.wallet -= cost;
      await user.save();

      farm.level += 1;
      farm.plots = LEVEL_PLOTS[farm.level] || farm.plots;
      await farm.save();

      return interaction.editReply(`✅ Farm upgraded to **Level ${farm.level}**! You now have **${farm.plots} plots**.`);
    }
  },
};