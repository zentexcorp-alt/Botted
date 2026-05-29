const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Production = require('../../models/Production');
const { getOrCreateUser, formatMoney, formatDuration, checkCooldown } = require('../../utils/helpers');
const { getOrCreateWarehouse, addToWarehouse, PRODUCTION_TYPES } = require('../../utils/productionEngine');
const Asset = require('../../models/Asset');

const COLLECT_COOLDOWN = 60 * 60 * 1000; // 1 hour

module.exports = {
  data: new SlashCommandBuilder()
    .setName('oilgas')
    .setDescription('Manage your oil and gas production')
    .addSubcommand((sub) =>
      sub.setName('buy')
        .setDescription('Buy an oil or gas field')
        .addStringOption((o) =>
          o.setName('type').setDescription('Field type').setRequired(true)
            .addChoices(
              { name: '🛢️ Small Oil Field ($50,000)', value: 'oil_0' },
              { name: '🛢️ Medium Oil Field ($200,000)', value: 'oil_1' },
              { name: '🛢️ Large Oil Field ($750,000)', value: 'oil_2' },
              { name: '🛢️ Offshore Platform ($3,000,000)', value: 'oil_3' },
              { name: '⛽ Small Gas Field ($40,000)', value: 'gas_0' },
              { name: '⛽ Medium Gas Field ($150,000)', value: 'gas_1' },
              { name: '⛽ Large Gas Field ($600,000)', value: 'gas_2' },
              { name: '⛽ Deep Well ($2,500,000)', value: 'gas_3' },
            )
        )
        .addStringOption((o) => o.setName('name').setDescription('Name your field').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('View all your fields'))
    .addSubcommand((sub) => sub.setName('collect').setDescription('Collect production from all fields'))
    .addSubcommand((sub) =>
      sub.setName('upgrade')
        .setDescription('Upgrade a field')
        .addStringOption((o) => o.setName('name').setDescription('Field name').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('maintain')
        .setDescription('Pay maintenance for a field')
        .addStringOption((o) => o.setName('name').setDescription('Field name').setRequired(true))
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();
    const user = await getOrCreateUser(interaction.user.id, interaction.user.username);

    if (sub === 'buy') {
      const typeStr = interaction.options.getString('type');
      const name = interaction.options.getString('name');
      const [productType, tierIndex] = typeStr.split('_');
      const fullType = productType === 'oil' ? 'oil_field' : 'gas_field';
      const prodInfo = PRODUCTION_TYPES[fullType];
      const tier = prodInfo.tiers[parseInt(tierIndex)];

      if (user.wallet < tier.cost) {
        return interaction.editReply(
          `❌ Need **${formatMoney(tier.cost)}** in your wallet.\n` +
          `You have: **${formatMoney(user.wallet)}**`
        );
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
        .setColor(0x00ff88)
        .setTitle(`✅ ${prodInfo.name} Purchased!`)
        .addFields(
          { name: 'Name', value: name, inline: true },
          { name: 'Tier', value: tier.name, inline: true },
          { name: 'Output/hr', value: `${tier.outputPerHour} ${prodInfo.unit}`, inline: true },
          { name: 'Cost', value: formatMoney(tier.cost), inline: true },
          { name: 'Maintenance/day', value: formatMoney(tier.maintenanceCost), inline: true }
        )
        .setFooter({ text: 'Use /oilgas collect every hour to collect production!' });

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'list') {
      const fields = await Production.find({
        userId: interaction.user.id,
        type: { $in: ['oil_field', 'gas_field'] },
        active: true,
      });

      if (fields.length === 0) {
        return interaction.editReply('📭 No oil or gas fields. Buy one with `/oilgas buy`!');
      }

      const oilPrice = (await Asset.findOne({ symbol: 'OIL', active: true }))?.currentPrice || 0;
      const gasPrice = (await Asset.findOne({ symbol: 'GAS', active: true }))?.currentPrice || 0;

      const lines = fields.map((f) => {
        const prodInfo = PRODUCTION_TYPES[f.type];
        const price = f.type === 'oil_field' ? oilPrice : gasPrice;
        const hourlyValue = f.outputPerHour * price;
        const { ready, remaining } = checkCooldown(f.lastCollect, COLLECT_COOLDOWN);
        return [
          `**${f.name}** (${prodInfo.name} Lv${f.level})`,
          `Output: **${f.outputPerHour} ${prodInfo.unit}/hr** worth **${formatMoney(hourlyValue)}/hr**`,
          `Collect: ${ready ? '✅ Ready!' : `⏳ ${formatDuration(remaining)}`}`,
          `Maintenance: ${f.maintenanceDue ? '⚠️ Due!' : '✅ OK'}`,
        ].join('\n');
      });

      const embed = new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle('🛢️ Your Oil & Gas Fields')
        .setDescription(lines.join('\n\n'))
        .addFields(
          { name: '🛢️ OIL Price', value: formatMoney(oilPrice) + '/barrel', inline: true },
          { name: '⛽ GAS Price', value: formatMoney(gasPrice) + '/unit', inline: true }
        );

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'collect') {
      const fields = await Production.find({
        userId: interaction.user.id,
        type: { $in: ['oil_field', 'gas_field'] },
        active: true,
      });

      if (fields.length === 0) return interaction.editReply('📭 No fields to collect from!');

      const oilPrice = (await Asset.findOne({ symbol: 'OIL', active: true }))?.currentPrice || 0;
      const gasPrice = (await Asset.findOne({ symbol: 'GAS', active: true }))?.currentPrice || 0;

      const warehouse = await getOrCreateWarehouse(interaction.user.id);
      let totalOil = 0, totalGas = 0;
      let collected = 0;

      for (const field of fields) {
        const { ready } = checkCooldown(field.lastCollect, COLLECT_COOLDOWN);
        if (!ready) continue;
        if (field.maintenanceDue) continue;

        const hours = Math.min(
          (Date.now() - new Date(field.lastCollect).getTime()) / (60 * 60 * 1000),
          24
        );
        const produced = parseFloat((field.outputPerHour * hours).toFixed(4));

        if (field.type === 'oil_field') {
          addToWarehouse(warehouse, 'OIL', produced);
          totalOil += produced;
        } else {
          addToWarehouse(warehouse, 'GAS', produced);
          totalGas += produced;
        }

        field.lastCollect = new Date();
        field.totalProduced += produced;
        await field.save();
        collected++;
      }

      if (collected === 0) {
        return interaction.editReply('⏳ No fields ready to collect yet! Check `/oilgas list` for timers.');
      }

      await warehouse.save();

      const embed = new EmbedBuilder()
        .setColor(0xf7931a)
        .setTitle('🏭 Production Collected!')
        .setDescription('Resources added to your **Warehouse**. Sell them with `/commodities sell <symbol> warehouse`!')
        .addFields(
          totalOil > 0 ? { name: '🛢️ Oil Collected', value: `${totalOil.toFixed(2)} barrels (~${formatMoney(totalOil * oilPrice)})`, inline: true } : null,
          totalGas > 0 ? { name: '⛽ Gas Collected', value: `${totalGas.toFixed(2)} units (~${formatMoney(totalGas * gasPrice)})`, inline: true } : null,
          { name: '🏭 Fields Collected', value: `${collected}`, inline: true }
        ).filter(Boolean);

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'upgrade') {
      const name = interaction.options.getString('name');
      const field = await Production.findOne({ userId: interaction.user.id, name, active: true });
      if (!field) return interaction.editReply(`❌ Field **"${name}"** not found.`);

      const prodInfo = PRODUCTION_TYPES[field.type];
      if (field.level >= prodInfo.tiers.length) {
        return interaction.editReply('✅ This field is already at maximum level!');
      }

      const nextTier = prodInfo.tiers[field.level];
      const upgradeCost = Math.floor(nextTier.cost * prodInfo.upgradeCostMult);

      if (user.wallet < upgradeCost) {
        return interaction.editReply(`❌ Upgrade costs **${formatMoney(upgradeCost)}**. You have **${formatMoney(user.wallet)}**.`);
      }

      user.wallet -= upgradeCost;
      await user.save();

      field.level += 1;
      field.outputPerHour = nextTier.outputPerHour;
      await field.save();

      return interaction.editReply(`✅ **${name}** upgraded to **Level ${field.level}**! Output: **${field.outputPerHour} ${prodInfo.unit}/hr**`);
    }

    if (sub === 'maintain') {
      const name = interaction.options.getString('name');
      const field = await Production.findOne({ userId: interaction.user.id, name, active: true });
      if (!field) return interaction.editReply(`❌ Field **"${name}"** not found.`);

      const prodInfo = PRODUCTION_TYPES[field.type];
      const tier = prodInfo.tiers[field.level - 1];
      const cost = tier.maintenanceCost;

      if (user.wallet < cost) return interaction.editReply(`❌ Maintenance costs **${formatMoney(cost)}**.`);

      user.wallet -= cost;
      await user.save();

      field.maintenanceDue = false;
      field.lastMaintenance = new Date();
      await field.save();

      return interaction.editReply(`✅ Maintenance paid for **${name}**! Cost: **${formatMoney(cost)}**`);
    }
  },
};