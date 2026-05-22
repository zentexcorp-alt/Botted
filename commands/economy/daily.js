const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getOrCreateUser, formatMoney, checkCooldown, randInt, formatDuration } = require('../../utils/helpers');
const { checkLevelUp } = require('../../utils/jobs');

const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily reward'),

  async execute(interaction) {
    const user = await getOrCreateUser(interaction.user.id, interaction.user.username);
    const { ready, remaining } = checkCooldown(user.lastDaily, DAILY_COOLDOWN);

    if (!ready) {
      return interaction.reply({
        content: `⏳ Daily already claimed! Come back in **${formatDuration(remaining)}**.`,
        ephemeral: true,
      });
    }

    const base = 500 + user.level * 50;
    const amount = randInt(base, base * 2);
    const xpGain = 25 + user.level * 5;

    user.wallet += amount;
    user.xp += xpGain;
    user.lastDaily = new Date();
    user.totalEarned += amount;

    const leveled = await checkLevelUp(user);
    await user.save();

    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle('🎁 Daily Reward Claimed!')
      .addFields(
        { name: '💰 Reward', value: formatMoney(amount), inline: true },
        { name: '⭐ XP Gained', value: `+${xpGain} XP`, inline: true },
        { name: '🪙 New Wallet', value: formatMoney(user.wallet), inline: true }
      );

    if (leveled) {
      embed.addFields({ name: '🎉 Level Up!', value: `You are now **Level ${user.level}**!`, inline: false });
    }

    await interaction.reply({ embeds: [embed] });
  },
};
