const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Production = require('../../models/Production');
const { getOrCreateUser, formatMoney, formatDuration, checkCooldown } = require('../../utils/helpers');
const { getOrCreateWarehouse, addToWarehouse, PRODUCTION_TYPES } = require('../../utils/productionEngine');
const Asset = require('../../models/Asset');

const COLLECT_COOLDOWN = 60 * 60 * 1000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mines')
    .setDescription('Manage your gold and silver mines')
    .addSubcommand((sub) =>
      sub.setName('buy')
        .setDescription('Buy a mine')
        .addStringOption((o) =>
          o.setName('type').setDescription('Mine type').setRequired(true)
            .addChoices(
              { name: '🥇 Surface Gold Mine ($100,000)', value: 'gold_0' },
              { name: '🥇 Underground Gold Mine ($400,000)', value: 'gold_1' },
              { name: '🥇 Deep Gold Mine ($1,500,000)', value: 'gold_2' },
              { name: '🥇 Mega Gold Mine ($5,000,000)', value: 'gold_3' },
              { name: '🥈 Surface Silver Mine ($30,000)', value: 'silver_0' },
              { name: '🥈 Underground Silver Mine ($120,000)', value: 'silver_1' },
              { name: '🥈 Deep Silver Mine ($450,000)', value: 'silver_2' },
              { name: '🥈 Mega Silver Mine ($1,500,000)', value: 'silver_3' },
            )
        )
        .addStringOption((o) => o.setName('name').setDescription('Name your mine').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('View all your mines'))
    .addSubcommand((sub) => sub.setName('collect').setDescription('Collect from all mines'))
    .addSubcommand((sub) =>
      sub.setName('upgrade')
        .setDescription('Upgrade a mine')
        .addStringOption((o) => o.setName('name').setDescription('Mine name').setRequired(true))
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();
    const user = await getOrCreateUser(interaction.user.id, interaction.user.username);

    if (sub === 'buy') {
      const typeStr = interaction.options.getString('type');
      const name = interaction.options.getString('name');
      const [metalType, tierIndex] = typeStr.split('_');
      const fullType = metalType === 'gold' ? 'gold_mine' : 'silver_mine';
      const prodInfo = PRODUCTION_TYPES[fullType];
      const tier = prodInfo.tiers[parseInt(tierIndex)];

      if (user.wallet < tier.cost) {
        return interaction.editReply(`❌ Need **${formatMoney(tier.cost)}**. You have **${formatMoney(user.wallet)}**.`);
      }

      user.wallet -= tier.cost;
      await user.save();

      await Production.create({
        userId: interaction.user.id,
        type: fullType,
        name,
        level: parseInt(tierIndex) + 1,
        outputPerHour: tier.outputPerHour,
      });

      const embed = new EmbedBuilder()
        .setColor(metalType === 'gold' ? 0xffd700 : 0xc0c0c0)
        .setTitle(`✅ ${prodInfo.name} Purchased!`)
        .addFields(
          { name: 'Name', value: name, inline: true },
          { name: 'Tier', value: tier.name, inline: true },
          { name: 'Output/hr', value: `${tier.outputPerHour} ${prodInfo.unit}`, inline: true },
          { name: 'Cost', value: formatMoney(tier.cost), inline: true }
        );

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'list') {
      const mines = await Production.find({
        userId: interaction.user.id,
        type: { $in: ['gold_mine', 'silver_mine'] },
        active: true,
      });

      if (mines.length === 0) return interaction.editReply('📭 No mines owned. Buy one with `/mines buy`!');

      const goldPrice = (await Asset.findOne({ symbol: 'XAU', active: true }))?.currentPrice || 0;
      const silverPrice = (await Asset.findOne({ symbol: 'XAG', active: true }))?.currentPrice || 0;

      const lines = mines.map((m) => {
        const prodInfo = PRODUCTION_TYPES[m.type];
        const price = m.type === 'gold_mine' ? goldPrice : silverPrice;
        const hourlyValue = m.outputPerHour * price;
        const { ready, remaining } = checkCooldown(m.lastCollect, COLLECT_COOLDOWN);
        return [
          `**${m.name}** (${prodInfo.name} Lv${m.level})`,
          `Output: **${m.outputPerHour} ${prodInfo.unit}/hr** worth **${formatMoney(hourlyValue)}/hr**`,
          `Collect: ${ready ? '✅ Ready!' : `⏳ ${formatDuration(remaining)}`}`,
        ].join('\n');
      });

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('⛏️ Your Mines')
        .setDescription(lines.join('\n\n'))
        .addFields(
          { name: '🥇 Gold Price', value: formatMoney(goldPrice) + '/oz', inline: true },
          { name: '🥈 Silver Price', value: formatMoney(silverPrice) + '/oz', inline: true }
        );

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'collect') {
      const mines = await Production.find({
        userId: interaction.user.id,
        type: { $in: ['gold_mine', 'silver_mine'] },
        active: true,
      });

      if (mines.length === 0) return interaction.editReply('📭 No mines to collect from!');

      const goldPrice = (await Asset.findOne({ symbol: 'XAU', active: true }))?.currentPrice || 0;
      const silverPrice = (await Asset.findOne({ symbol: 'XAG', active: true }))?.currentPrice || 0;

      const warehouse = await getOrCreateWarehouse(interaction.user.id);
      let totalGold = 0, totalSilver = 0, collected = 0;

      for (const mine of mines) {
        const { ready } = checkCooldown(mine.lastCollect, COLLECT_COOLDOWN);
        if (!ready) continue;

        const hours = Math.min(
          (Date.now() - new Date(mine.lastCollect).getTime()) / (60 * 60 * 1000),
          24
        );
        const produced = parseFloat((mine.outputPerHour * hours).toFixed(4));

        if (mine.type === 'gold_mine') {
          addToWarehouse(warehouse, 'XAU', produced);
          totalGold += produced;
        } else {
          addToWarehouse(warehouse, 'XAG', produced);
          totalSilver += produced;
        }

        mine.lastCollect = new Date();
        mine.totalProduced += produced;
        await mine.save();
        collected++;
      }

      if (collected === 0) return interaction.editReply('⏳ No mines ready to collect yet!');

      await warehouse.save();

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('⛏️ Mine Production Collected!')
        .setDescription('Resources added to your **Warehouse**!')
        .addFields(
          totalGold > 0 ? { name: '🥇 Gold Collected', value: `${totalGold.toFixed(4)} oz (~${formatMoney(totalGold * goldPrice)})`, inline: true } : null,
          totalSilver > 0 ? { name: '🥈 Silver Collected', value: `${totalSilver.toFixed(4)} oz (~${formatMoney(totalSilver * silverPrice)})`, inline: true } : null,
          { name: '⛏️ Mines Collected', value: `${collected}`, inline: true }
        ).filter(Boolean);

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'upgrade') {
      const name = interaction.options.getString('name');
      const mine = await Production.findOne({ userId: interaction.user.id, name, active: true });
      if (!mine) return interaction.editReply(`❌ Mine **"${name}"** not found.`);

      const prodInfo = PRODUCTION_TYPES[mine.type];
      if (mine.level >= prodInfo.tiers.length) return interaction.editReply('✅ Already at max level!');

      const nextTier = prodInfo.tiers[mine.level];
      const cost = Math.floor(nextTier.cost * prodInfo.upgradeCostMult);

      if (user.wallet < cost) return interaction.editReply(`❌ Upgrade costs **${formatMoney(cost)}**.`);

      user.wallet -= cost;
      await user.save();

      mine.level += 1;
      mine.outputPerHour = nextTier.outputPerHour;
      await mine.save();

      return interaction.editReply(`✅ **${name}** upgraded to **Level ${mine.level}**! Output: **${mine.outputPerHour} oz/hr**`);
    }
  },
};