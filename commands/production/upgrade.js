const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Production = require('../../models/Production');
const Upgrade = require('../../models/Upgrade');
const Warehouse = require('../../models/Warehouse');
const { getOrCreateUser, formatMoney } = require('../../utils/helpers');
const { getProductionUpgrades } = require('../../utils/processingEngine');

const TYPE_MAP = {
  oil_field: '🛢️ Oil Field',
  gas_field: '⛽ Gas Field',
  gold_mine: '🥇 Gold Mine',
  silver_mine: '🥈 Silver Mine',
  crop_farm: '🌾 Crop Farm',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('upgrade')
    .setDescription('Upgrade your production assets')
    .addSubcommand((sub) =>
      sub.setName('list')
        .setDescription('See available upgrades for an asset')
        .addStringOption((o) => o.setName('name').setDescription('Asset name').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('buy')
        .setDescription('Buy an upgrade for a production asset')
        .addStringOption((o) => o.setName('name').setDescription('Asset name').setRequired(true))
        .addStringOption((o) => o.setName('upgrade').setDescription('Upgrade ID to buy').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('status').setDescription('View all your upgrades')),

  async execute(interaction) {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();
    const user = await getOrCreateUser(interaction.user.id, interaction.user.username);

    if (sub === 'list') {
      const name = interaction.options.getString('name');
      const asset = await Production.findOne({ userId: interaction.user.id, name, active: true });
      if (!asset) return interaction.editReply(`❌ Asset **"${name}"** not found.`);

      const upgrades = getProductionUpgrades(asset.type);
      if (Object.keys(upgrades).length === 0) return interaction.editReply(`❌ No upgrades available for **${TYPE_MAP[asset.type] || asset.type}**.`);

      // Get already purchased upgrades
      const owned = await Upgrade.findOne({ userId: interaction.user.id, assetId: asset._id.toString() });
      const ownedIds = new Set((owned?.upgrades || []).map((u) => u.upgradeId));

      const lines = Object.entries(upgrades).map(([id, upg]) => {
        const hasIt = ownedIds.has(id);
        const matCost = upg.materialCost
          ? Object.entries(upg.materialCost).map(([sym, qty]) => `${qty} ${sym}`).join(' + ')
          : null;
        return [
          `${hasIt ? '✅' : '🔒'} **${upg.name}** (\`${id}\`)`,
          `📝 ${upg.description}`,
          `💰 Cost: ${formatMoney(upg.cost)}${matCost ? ` + ${matCost} from warehouse` : ''}`,
          hasIt ? '*Already owned*' : '',
        ].filter(Boolean).join('\n');
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`🔧 Upgrades — ${name} (${TYPE_MAP[asset.type] || asset.type})`)
        .setDescription(lines.join('\n\n'))
        .setFooter({ text: 'Use /upgrade buy <name> <upgrade_id> to purchase' });

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'buy') {
      const name = interaction.options.getString('name');
      const upgradeId = interaction.options.getString('upgrade');
      const asset = await Production.findOne({ userId: interaction.user.id, name, active: true });
      if (!asset) return interaction.editReply(`❌ Asset **"${name}"** not found.`);

      const upgrades = getProductionUpgrades(asset.type);
      const upgradeInfo = upgrades[upgradeId];
      if (!upgradeInfo) return interaction.editReply(`❌ Upgrade **"${upgradeId}"** not found. Use \`/upgrade list ${name}\` to see available upgrades.`);

      // Check already owned
      let owned = await Upgrade.findOne({ userId: interaction.user.id, assetId: asset._id.toString() });
      if (!owned) owned = new Upgrade({ userId: interaction.user.id, assetId: asset._id.toString(), assetType: asset.type, upgrades: [] });

      const alreadyOwned = owned.upgrades.find((u) => u.upgradeId === upgradeId);
      if (alreadyOwned && !upgradeInfo.oneTime) return interaction.editReply(`✅ You already have **${upgradeInfo.name}**!`);

      // Check wallet
      if (user.wallet < upgradeInfo.cost) {
        return interaction.editReply(`❌ Need **${formatMoney(upgradeInfo.cost)}**. You have **${formatMoney(user.wallet)}**.`);
      }

      // Check material cost
      if (upgradeInfo.materialCost) {
        const warehouse = await Warehouse.findOne({ userId: interaction.user.id });
        for (const [sym, qty] of Object.entries(upgradeInfo.materialCost)) {
          const item = warehouse?.items.find((i) => i.symbol === sym);
          if (!item || item.quantity < qty) {
            return interaction.editReply(`❌ Need **${qty} ${sym}** in warehouse. You have **${item?.quantity.toFixed(2) || 0}**.`);
          }
        }

        // Deduct materials
        for (const [sym, qty] of Object.entries(upgradeInfo.materialCost)) {
          const item = warehouse.items.find((i) => i.symbol === sym);
          item.quantity = parseFloat((item.quantity - qty).toFixed(4));
        }
        await warehouse.save();
      }

      // Apply upgrade effect to production asset
      if (upgradeInfo.effect === 'output' && !upgradeInfo.oneTime) {
        asset.outputPerHour = parseFloat((asset.outputPerHour * upgradeInfo.effectValue).toFixed(4));
        await asset.save();
      }

      user.wallet -= upgradeInfo.cost;
      await user.save();

      owned.upgrades.push({ upgradeId, name: upgradeInfo.name });
      await owned.save();

      return interaction.editReply(
        `✅ **${upgradeInfo.name}** applied to **${name}**!\n` +
        `📝 ${upgradeInfo.description}\n` +
        `💰 Paid: **${formatMoney(upgradeInfo.cost)}**`
      );
    }

    if (sub === 'status') {
      const assets = await Production.find({ userId: interaction.user.id, active: true });
      if (assets.length === 0) return interaction.editReply('📭 No production assets found.');

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('🔧 Your Production Upgrades');

      for (const asset of assets) {
        const owned = await Upgrade.findOne({ userId: interaction.user.id, assetId: asset._id.toString() });
        const upgrades = owned?.upgrades || [];
        embed.addFields({
          name: `${TYPE_MAP[asset.type] || asset.type} — "${asset.name}"`,
          value: upgrades.length > 0
            ? upgrades.map((u) => `✅ ${u.name}`).join('\n')
            : '*No upgrades yet*',
          inline: false,
        });
      }

      return interaction.editReply({ embeds: [embed] });
    }
  },
};