const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ProcessingPlant = require('../../models/ProcessingPlant');
const Warehouse = require('../../models/Warehouse');
const Asset = require('../../models/Asset');
const { getOrCreateUser, formatMoney, formatDuration } = require('../../utils/helpers');
const { getOrCreateWarehouse, addToWarehouse } = require('../../utils/productionEngine');
const {
  PLANTS, getPlant, calcProcessingTime,
  calcProcessingOutput, getDurabilityEfficiency,
} = require('../../utils/processingEngine');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('process')
    .setDescription('Manage your processing plants')
    .addSubcommand((sub) =>
      sub.setName('buy')
        .setDescription('Buy a processing plant (one of each type allowed)')
        .addStringOption((o) =>
          o.setName('plant').setDescription('Plant type').setRequired(true)
            .addChoices(
              { name: '🏭 Oil Refinery ($2,000,000)', value: 'oil_refinery' },
              { name: '🔴 Gas Processing Plant ($1,500,000)', value: 'gas_plant' },
              { name: '🛸 Smelter Gold & Silver ($3,000,000)', value: 'smelter' },
              { name: '🌾 Crop Processor ($500,000)', value: 'crop_processor' },
              { name: '🔨 Steel Mill ($5,000,000)', value: 'steel_mill' },
            )
        )
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('View all your processing plants'))
    .addSubcommand((sub) =>
      sub.setName('start')
        .setDescription('Start a processing batch')
        .addStringOption((o) =>
          o.setName('plant').setDescription('Plant to use').setRequired(true)
            .addChoices(
              { name: '🏭 Oil Refinery', value: 'oil_refinery' },
              { name: '🔴 Gas Plant', value: 'gas_plant' },
              { name: '🛸 Smelter', value: 'smelter' },
              { name: '🌾 Crop Processor', value: 'crop_processor' },
              { name: '🔨 Steel Mill', value: 'steel_mill' },
            )
        )
        .addStringOption((o) => o.setName('input').setDescription('Input material symbol (e.g. OIL, XAU, CORN)').setRequired(true))
        .addNumberOption((o) => o.setName('quantity').setDescription('How many units to process').setRequired(true).setMinValue(1))
    )
    .addSubcommand((sub) => sub.setName('status').setDescription('Check current processing status'))
    .addSubcommand((sub) =>
      sub.setName('collect')
        .setDescription('Collect finished processed goods')
        .addStringOption((o) =>
          o.setName('plant').setDescription('Plant to collect from').setRequired(true)
            .addChoices(
              { name: '🏭 Oil Refinery', value: 'oil_refinery' },
              { name: '🔴 Gas Plant', value: 'gas_plant' },
              { name: '🛸 Smelter', value: 'smelter' },
              { name: '🌾 Crop Processor', value: 'crop_processor' },
              { name: '🔨 Steel Mill', value: 'steel_mill' },
            )
        )
    )
    .addSubcommand((sub) =>
      sub.setName('repair')
        .setDescription('Repair a damaged processing plant')
        .addStringOption((o) =>
          o.setName('plant').setDescription('Plant to repair').setRequired(true)
            .addChoices(
              { name: '🏭 Oil Refinery', value: 'oil_refinery' },
              { name: '🔴 Gas Plant', value: 'gas_plant' },
              { name: '🛸 Smelter', value: 'smelter' },
              { name: '🌾 Crop Processor', value: 'crop_processor' },
              { name: '🔨 Steel Mill', value: 'steel_mill' },
            )
        )
    )
    .addSubcommand((sub) =>
      sub.setName('upgrade')
        .setDescription('Upgrade a processing plant')
        .addStringOption((o) =>
          o.setName('plant').setDescription('Plant to upgrade').setRequired(true)
            .addChoices(
              { name: '🏭 Oil Refinery', value: 'oil_refinery' },
              { name: '🛸 Smelter', value: 'smelter' },
            )
        )
        .addStringOption((o) =>
          o.setName('upgrade').setDescription('Upgrade to buy').setRequired(true)
            .addChoices(
              { name: '⚡ Speed Upgrade (Refinery)', value: 'speed' },
              { name: '📦 Capacity Upgrade (Refinery)', value: 'capacity' },
              { name: '🔧 Durability Upgrade (Refinery)', value: 'durability' },
              { name: '🔥 Hotter Furnace (Smelter)', value: 'hotterFurnace' },
              { name: '🛡️ Reinforced Lining (Smelter)', value: 'reinforcedLining' },
            )
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();
    const user = await getOrCreateUser(interaction.user.id, interaction.user.username);

    // ── BUY ────────────────────────────────────────────────────────────────
    if (sub === 'buy') {
      const plantType = interaction.options.getString('plant');
      const plantInfo = getPlant(plantType);

      // Check already owns one
      const existing = await ProcessingPlant.findOne({
        userId: interaction.user.id,
        plantType,
        destroyed: false,
      });
      if (existing) return interaction.editReply(`❌ You already own a **${plantInfo.name}**! You can only own one of each type.`);

      if (user.wallet < plantInfo.cost) {
        return interaction.editReply(
          `❌ Need **${formatMoney(plantInfo.cost)}**.\n` +
          `💰 Your Wallet: **${formatMoney(user.wallet)}**`
        );
      }

      user.wallet -= plantInfo.cost;
      await user.save();

      await ProcessingPlant.create({
        userId: interaction.user.id,
        plantType,
      });

      const inputs = plantInfo.inputs.join(', ');
      const outputs = Object.values(plantInfo.outputs).map((o) => o.symbol).join(', ');

      const embed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle(`✅ ${plantInfo.name} Purchased!`)
        .addFields(
          { name: '💰 Cost', value: formatMoney(plantInfo.cost), inline: true },
          { name: '📥 Inputs', value: inputs, inline: true },
          { name: '📤 Outputs', value: outputs, inline: true },
          { name: '📦 Max Batch', value: `${plantInfo.maxCapacity} units`, inline: true },
          { name: '🔋 Durability', value: '100%', inline: true },
          { name: '🔧 Repair Cost', value: formatMoney(plantInfo.repairCost), inline: true },
          { name: '💡 How to use', value: `Use \`/process start plant:${plantType} input:<SYMBOL> quantity:<amount>\` to start processing!`, inline: false }
        );

      return interaction.editReply({ embeds: [embed] });
    }

    // ── LIST ───────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const plants = await ProcessingPlant.find({ userId: interaction.user.id, destroyed: false });
      if (plants.length === 0) return interaction.editReply('📭 No processing plants owned. Buy one with `/process buy`!');

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('🏭 Your Processing Plants');

      for (const plant of plants) {
        const info = getPlant(plant.plantType);
        const efficiency = getDurabilityEfficiency(plant.durability);
        const durBar = '█'.repeat(Math.floor(plant.durability / 10)) + '░'.repeat(10 - Math.floor(plant.durability / 10));
        const status = plant.broken ? '🔴 BROKEN' : plant.isProcessing ? '⚙️ Processing...' : '✅ Ready';

        const upgradeList = Object.entries(plant.upgrades)
          .filter(([k, v]) => v === true)
          .map(([k]) => k)
          .join(', ') || 'None';

        embed.addFields({
          name: `${info.name}`,
          value: [
            `Status: **${status}**`,
            `Durability: \`${durBar}\` **${plant.durability}%** (${(efficiency * 100).toFixed(0)}% efficiency)`,
            `Batches Processed: **${plant.batchCount}**`,
            `Upgrades: **${upgradeList}**`,
            plant.isProcessing ? `⏰ Finishes: <t:${Math.floor(new Date(plant.processingFinishTime).getTime() / 1000)}:R>` : '',
          ].filter(Boolean).join('\n'),
          inline: false,
        });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    // ── START ──────────────────────────────────────────────────────────────
    if (sub === 'start') {
      const plantType = interaction.options.getString('plant');
      const inputSymbol = interaction.options.getString('input').toUpperCase();
      const quantity = interaction.options.getNumber('quantity');
      const plantInfo = getPlant(plantType);

      const plant = await ProcessingPlant.findOne({ userId: interaction.user.id, plantType, destroyed: false });
      if (!plant) return interaction.editReply(`❌ You don't own a **${plantInfo.name}**. Buy one with \`/process buy\`!`);
      if (plant.broken) return interaction.editReply(`❌ Your **${plantInfo.name}** is broken! Repair it first with \`/process repair\`.`);
      if (plant.isProcessing) {
        const timeLeft = new Date(plant.processingFinishTime) - Date.now();
        return interaction.editReply(`❌ Already processing! Finishes <t:${Math.floor(new Date(plant.processingFinishTime).getTime() / 1000)}:R>.`);
      }

      // Validate input
      if (!plantInfo.inputs.includes(inputSymbol)) {
        return interaction.editReply(`❌ **${plantInfo.name}** cannot process **${inputSymbol}**.\nAccepted inputs: **${plantInfo.inputs.join(', ')}**`);
      }

      // Check warehouse has enough
      const warehouse = await Warehouse.findOne({ userId: interaction.user.id });
      const warehouseItem = warehouse?.items.find((i) => i.symbol === inputSymbol);
      const maxBatch = plant.upgrades.capacity ? plantInfo.maxCapacity * 2 : plantInfo.maxCapacity;

      if (!warehouseItem || warehouseItem.quantity < quantity) {
        return interaction.editReply(
          `❌ Not enough **${inputSymbol}** in warehouse!\n` +
          `You have: **${warehouseItem?.quantity.toFixed(4) || 0} ${inputSymbol}**\n` +
          `You need: **${quantity} ${inputSymbol}**`
        );
      }

      if (quantity > maxBatch) {
        return interaction.editReply(`❌ Max batch size is **${maxBatch} units**${plant.upgrades.capacity ? ' (with capacity upgrade)' : ''}.`);
      }

      // Deduct from warehouse
      warehouseItem.quantity = parseFloat((warehouseItem.quantity - quantity).toFixed(4));
      warehouse.usedCapacity = warehouse.items.reduce((a, i) => a + i.quantity, 0);
      await warehouse.save();

      // Calculate processing time
      const processTime = calcProcessingTime(plantInfo, quantity, plant.upgrades.speed);
      const finishTime = new Date(Date.now() + processTime);

      plant.isProcessing = true;
      plant.processingStarted = new Date();
      plant.processingInput = inputSymbol;
      plant.processingQuantity = quantity;
      plant.processingFinishTime = finishTime;
      await plant.save();

      // Calculate expected output
      const output = calcProcessingOutput(plantInfo, inputSymbol, quantity, plant.upgrades.hotterFurnace);
      const outputAsset = await Asset.findOne({ symbol: output?.symbol, active: true });
      const inputAsset = await Asset.findOne({ symbol: inputSymbol, active: true });
      const inputValue = (inputAsset?.currentPrice || 0) * quantity;
      const outputValue = (outputAsset?.currentPrice || (inputAsset?.currentPrice || 0) * (typeof plantInfo.outputMultiplier === 'object' ? plantInfo.outputMultiplier[inputSymbol] : plantInfo.outputMultiplier)) * (output?.quantity || 0);

      const embed = new EmbedBuilder()
        .setColor(0xf7931a)
        .setTitle(`⚙️ Processing Started — ${plantInfo.name}`)
        .addFields(
          { name: '📥 Input', value: `${quantity} ${inputSymbol}`, inline: true },
          { name: '📤 Expected Output', value: output ? `${output.quantity} ${output.symbol}` : 'N/A', inline: true },
          { name: '⏰ Finishes', value: `<t:${Math.floor(finishTime.getTime() / 1000)}:R>`, inline: true },
          { name: '💰 Input Value', value: formatMoney(inputValue), inline: true },
          { name: '📈 Expected Value', value: formatMoney(outputValue), inline: true },
          { name: '📊 Value Gain', value: `+${formatMoney(outputValue - inputValue)}`, inline: true },
        )
        .setFooter({ text: 'Use /process collect to collect when done!' });

      return interaction.editReply({ embeds: [embed] });
    }

    // ── STATUS ─────────────────────────────────────────────────────────────
    if (sub === 'status') {
      const plants = await ProcessingPlant.find({ userId: interaction.user.id, isProcessing: true, destroyed: false });
      if (plants.length === 0) return interaction.editReply('📭 No active processing jobs right now.');

      const embed = new EmbedBuilder()
        .setColor(0xf7931a)
        .setTitle('⚙️ Processing Status');

      for (const plant of plants) {
        const info = getPlant(plant.plantType);
        const timeLeft = new Date(plant.processingFinishTime) - Date.now();
        const isDone = timeLeft <= 0;

        embed.addFields({
          name: info.name,
          value: [
            `Input: **${plant.processingQuantity} ${plant.processingInput}**`,
            isDone ? '✅ **DONE! Use `/process collect` to collect!**' : `⏰ Finishes: <t:${Math.floor(new Date(plant.processingFinishTime).getTime() / 1000)}:R>`,
          ].join('\n'),
          inline: false,
        });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    // ── COLLECT ────────────────────────────────────────────────────────────
    if (sub === 'collect') {
      const plantType = interaction.options.getString('plant');
      const plantInfo = getPlant(plantType);

      const plant = await ProcessingPlant.findOne({ userId: interaction.user.id, plantType, destroyed: false });
      if (!plant) return interaction.editReply(`❌ You don't own a **${plantInfo.name}**.`);
      if (!plant.isProcessing) return interaction.editReply(`❌ Nothing is being processed right now. Start with \`/process start\`!`);

      const timeLeft = new Date(plant.processingFinishTime) - Date.now();
      if (timeLeft > 0) {
        return interaction.editReply(`⏳ Not done yet! Finishes <t:${Math.floor(new Date(plant.processingFinishTime).getTime() / 1000)}:R>.`);
      }

      // Calculate output with durability efficiency
      const efficiency = getDurabilityEfficiency(plant.durability);
      const output = calcProcessingOutput(plantInfo, plant.processingInput, plant.processingQuantity, plant.upgrades.hotterFurnace);
      if (!output) return interaction.editReply('❌ Processing error. Contact admin.');

      const finalQty = parseFloat((output.quantity * efficiency).toFixed(4));

      // Add to warehouse
      const warehouse = await getOrCreateWarehouse(interaction.user.id);
      addToWarehouse(warehouse, output.symbol, finalQty);
      await warehouse.save();

      // Durability loss
      let durLoss = plantInfo.durabilityLoss;
      if (plant.upgrades.durability) durLoss = 1;
      if (plant.upgrades.reinforcedLining) durLoss *= 0.5;

      plant.durability = Math.max(0, parseFloat((plant.durability - durLoss).toFixed(1)));
      plant.isProcessing = false;
      plant.processingInput = null;
      plant.processingQuantity = 0;
      plant.processingFinishTime = null;
      plant.batchCount += 1;
      plant.totalProcessed += finalQty;

      // Check if broken
      if (plant.durability === 0) {
        plant.broken = true;
        plant.brokenAt = new Date();
      }

      await plant.save();

      // Get output asset price
      const outputAsset = await Asset.findOne({ symbol: output.symbol, active: true });
      const value = (outputAsset?.currentPrice || 0) * finalQty;

      const embed = new EmbedBuilder()
        .setColor(plant.broken ? 0xff4545 : 0x00ff88)
        .setTitle(`✅ Processing Complete — ${plantInfo.name}`)
        .addFields(
          { name: '📤 Output', value: `${finalQty} ${output.symbol} (${output.name})`, inline: true },
          { name: '💰 Market Value', value: formatMoney(value), inline: true },
          { name: '🔋 Durability', value: `${plant.durability}%`, inline: true },
          { name: '📊 Efficiency', value: `${(efficiency * 100).toFixed(0)}%`, inline: true },
          { name: '🏭 Batches Done', value: `${plant.batchCount}`, inline: true },
        );

      if (plant.broken) {
        embed.addFields({ name: '⚠️ PLANT BROKEN!', value: `Your **${plantInfo.name}** has broken! Repair it with \`/process repair\` before using again.`, inline: false });
      }

      embed.setFooter({ text: 'Output added to your warehouse • Sell with /commodities sell' });
      return interaction.editReply({ embeds: [embed] });
    }

    // ── REPAIR ─────────────────────────────────────────────────────────────
    if (sub === 'repair') {
      const plantType = interaction.options.getString('plant');
      const plantInfo = getPlant(plantType);

      const plant = await ProcessingPlant.findOne({ userId: interaction.user.id, plantType, destroyed: false });
      if (!plant) return interaction.editReply(`❌ You don't own a **${plantInfo.name}**.`);
      if (plant.durability === 100 && !plant.broken) return interaction.editReply('✅ Plant is already at full durability!');

      // Check if destroyed (48h broken)
      if (plant.broken && plant.brokenAt) {
        const hoursBroken = (Date.now() - new Date(plant.brokenAt).getTime()) / (60 * 60 * 1000);
        if (hoursBroken > 48) {
          plant.destroyed = true;
          await plant.save();
          const rebuildCost = plantInfo.cost * 0.5;
          return interaction.editReply(
            `💥 Your **${plantInfo.name}** was ignored for too long and is now **DESTROYED**!\n\n` +
            `Rebuild cost: **${formatMoney(rebuildCost)}**\n` +
            `Buy a new one with \`/process buy\`!`
          );
        }
      }

      const repairCost = plant.broken ? plantInfo.repairCost : Math.floor(plantInfo.repairCost * ((100 - plant.durability) / 100));
      if (repairCost === 0) return interaction.editReply('✅ No repair needed!');

      if (user.wallet < repairCost) {
        return interaction.editReply(`❌ Repair costs **${formatMoney(repairCost)}**. You have **${formatMoney(user.wallet)}**.`);
      }

      user.wallet -= repairCost;
      await user.save();

      plant.durability = 100;
      plant.broken = false;
      plant.brokenAt = null;
      await plant.save();

      return interaction.editReply(`✅ **${plantInfo.name}** fully repaired! Durability: **100%** — Cost: **${formatMoney(repairCost)}**`);
    }

    // ── UPGRADE ────────────────────────────────────────────────────────────
    if (sub === 'upgrade') {
      const plantType = interaction.options.getString('plant');
      const upgradeKey = interaction.options.getString('upgrade');
      const plantInfo = getPlant(plantType);

      if (!plantInfo.upgrades[upgradeKey]) {
        return interaction.editReply(`❌ That upgrade is not available for **${plantInfo.name}**.`);
      }

      const plant = await ProcessingPlant.findOne({ userId: interaction.user.id, plantType, destroyed: false });
      if (!plant) return interaction.editReply(`❌ You don't own a **${plantInfo.name}**.`);
      if (plant.upgrades[upgradeKey]) return interaction.editReply(`✅ You already have the **${plantInfo.upgrades[upgradeKey].name}** upgrade!`);

      const upgradeInfo = plantInfo.upgrades[upgradeKey];
      if (user.wallet < upgradeInfo.cost) {
        return interaction.editReply(`❌ Upgrade costs **${formatMoney(upgradeInfo.cost)}**. You have **${formatMoney(user.wallet)}**.`);
      }

      user.wallet -= upgradeInfo.cost;
      await user.save();

      plant.upgrades[upgradeKey] = true;
      await plant.save();

      return interaction.editReply(`✅ **${upgradeInfo.name}** installed on your **${plantInfo.name}**!\n${upgradeInfo.effect}`);
    }
  },
};