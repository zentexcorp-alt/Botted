const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ADMIN_IDS } = require('../../config');
const WorldEvent = require('../../models/WorldEvent');
const User = require('../../models/User');
const Tax = require('../../models/Tax');
const { EVENT_TYPES, getActiveEvents } = require('../../utils/worldEvents');
const { formatMoney } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('worldevent')
    .setDescription('Admin world event controls')
    .addSubcommand((sub) =>
      sub.setName('start')
        .setDescription('Start a world event')
        .addStringOption((o) =>
          o.setName('type').setDescription('Event type').setRequired(true)
            .addChoices(
              { name: '🐂 Bull Run — Crypto prices surge', value: 'bull_run' },
              { name: '🐻 Bear Market — Stock prices drop', value: 'bear_market' },
              { name: '🌾 Harvest Season — Farm yields doubled', value: 'harvest_season' },
              { name: '💼 Job Fair — Work pay doubled', value: 'job_fair' },
              { name: '🎰 Lucky Weekend — Casino doubled', value: 'lucky_weekend' },
              { name: '⚡ Flash Sale — Shop 50% off', value: 'flash_sale' },
              { name: '🏠 Housing Boom — Real estate doubled', value: 'housing_boom' },
              { name: '💰 Airdrop — Free money for all', value: 'airdrop' },
              { name: '⭐ XP Boost — Double XP', value: 'xp_boost' },
              { name: '🎉 Tax Holiday — No taxes', value: 'tax_holiday' }
            )
        )
        .addIntegerOption((o) => o.setName('duration').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(1440))
        .addNumberOption((o) => o.setName('airdrop_amount').setDescription('Amount per player (for airdrop only)').setMinValue(1))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List all active events'))
    .addSubcommand((sub) =>
      sub.setName('end')
        .setDescription('End an active event early')
        .addStringOption((o) => o.setName('name').setDescription('Event name to end').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('history').setDescription('View past events')),

  async execute(interaction) {
    if (!ADMIN_IDS.includes(interaction.user.id)) {
      return interaction.reply({ content: '❌ No permission.', ephemeral: true });
    }

    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      const type = interaction.options.getString('type');
      const duration = interaction.options.getInteger('duration');
      const eventInfo = EVENT_TYPES[type];
      if (!eventInfo) return interaction.editReply('❌ Unknown event type.');

      const endsAt = new Date(Date.now() + duration * 60 * 1000);

      // Handle airdrop specially
      if (type === 'airdrop') {
        const amount = interaction.options.getNumber('airdrop_amount') || 1000;
        const users = await User.find({});
        let count = 0;
        for (const user of users) {
          user.wallet += amount;
          await user.save();
          count++;
        }

        const embed = new EmbedBuilder()
          .setColor(0x00d4aa)
          .setTitle('💰 AIRDROP!')
          .setDescription(`**${formatMoney(amount)}** has been dropped into every player's wallet!`)
          .addFields(
            { name: '👥 Players Received', value: `${count}`, inline: true },
            { name: '💵 Total Distributed', value: formatMoney(amount * count), inline: true }
          );

        await interaction.editReply({ embeds: [embed] });
        await interaction.channel.send({ embeds: [embed] });
        return;
      }

      await WorldEvent.create({
        guildId: interaction.guildId,
        name: eventInfo.name,
        type,
        description: eventInfo.description,
        multiplier: eventInfo.defaultMultiplier,
        affectedStat: eventInfo.affectedStat,
        endsAt,
        active: true,
        startedBy: interaction.user.id,
      });

      const embed = new EmbedBuilder()
        .setColor(eventInfo.color)
        .setTitle(`🌍 World Event Started — ${eventInfo.name}`)
        .setDescription(eventInfo.description)
        .addFields(
          { name: '⏱ Duration', value: `${duration} minutes`, inline: true },
          { name: '⏰ Ends', value: `<t:${Math.floor(endsAt / 1000)}:R>`, inline: true },
          { name: '📊 Effect', value: `${eventInfo.affectedStat} × ${eventInfo.defaultMultiplier}`, inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      // Announce to channel
      await interaction.channel.send({ content: '@everyone', embeds: [embed] });
    }

    if (sub === 'list') {
      const events = await getActiveEvents(interaction.guildId);

      if (events.length === 0) {
        return interaction.editReply('📭 No active world events right now.');
      }

      const lines = events.map((e) => {
        const timeLeft = new Date(e.endsAt) - Date.now();
        const mins = Math.floor(timeLeft / 60000);
        const hrs = Math.floor(mins / 60);
        const timeStr = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
        return `**${e.name}** — ${e.description}\n⏰ Ends in: **${timeStr}** | Effect: ${e.affectedStat} × ${e.multiplier}`;
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('🌍 Active World Events')
        .setDescription(lines.join('\n\n'));

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'end') {
      const name = interaction.options.getString('name');
      const event = await WorldEvent.findOne({
        guildId: interaction.guildId,
        active: true,
        name: { $regex: name, $options: 'i' },
      });

      if (!event) return interaction.editReply(`❌ No active event matching **${name}**.`);

      event.active = false;
      await event.save();

      return interaction.editReply(`✅ Event **${event.name}** has been ended.`);
    }

    if (sub === 'history') {
      const events = await WorldEvent.find({ guildId: interaction.guildId })
        .sort({ startedAt: -1 })
        .limit(10);

      if (events.length === 0) return interaction.editReply('No events found.');

      const lines = events.map((e) => {
        const date = new Date(e.startedAt).toLocaleDateString();
        return `${e.active ? '🟢' : '🔴'} **${e.name}** — ${date}`;
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('📋 World Event History')
        .setDescription(lines.join('\n'));

      return interaction.editReply({ embeds: [embed] });
    }
  },
};