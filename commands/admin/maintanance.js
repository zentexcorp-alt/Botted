const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ADMIN_IDS } = require('../../config');
const BotSettings = require('../../models/BotSettings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('maintenance')
    .setDescription('Toggle bot maintenance mode')
    .addBooleanOption((o) => o.setName('enabled').setDescription('True = on, False = off').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for maintenance').setRequired(false)),

  async execute(interaction) {
    if (!ADMIN_IDS.includes(interaction.user.id)) {
      return interaction.reply({ content: '❌ No permission.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const enabled = interaction.options.getBoolean('enabled');
    const reason = interaction.options.getString('reason') || 'Routine maintenance';

    await BotSettings.findOneAndUpdate(
      { key: 'maintenance' },
      { key: 'maintenance', value: enabled, updatedAt: new Date() },
      { upsert: true }
    );

    const embed = new EmbedBuilder()
      .setColor(enabled ? 0xff9900 : 0x00ff88)
      .setTitle(enabled ? '🔧 Maintenance Mode ON' : '✅ Maintenance Mode OFF')
      .addFields(
        { name: 'Status', value: enabled ? '🔴 Bot locked to admins only' : '🟢 Bot available to everyone', inline: true },
        { name: 'Reason', value: reason, inline: true }
      );

    return interaction.editReply({ embeds: [embed] });
  },
};