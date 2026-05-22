const BanList = require('../models/BanList');
const BotSettings = require('../models/BotSettings');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;

    // ── Maintenance check ──────────────────────────────────────────────────
    const maintenance = await BotSettings.findOne({ key: 'maintenance' });
    if (maintenance?.value === true) {
      const { ADMIN_IDS } = require('../config');
      if (!ADMIN_IDS.includes(interaction.user.id)) {
        return interaction.reply({
          content: '🔧 The bot is currently under **maintenance**. Please check back soon!',
          ephemeral: true,
        });
      }
    }

    // ── Ban check ──────────────────────────────────────────────────────────
    const banned = await BanList.findOne({ userId: interaction.user.id });
    if (banned) {
      return interaction.reply({
        content: `🔨 You are **banned** from using this bot.\nReason: **${banned.reason}**`,
        ephemeral: true,
      });
    }

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error in /${interaction.commandName}:`, error);
      const msg = { content: '❌ An error occurred while running this command.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    }
  },
};