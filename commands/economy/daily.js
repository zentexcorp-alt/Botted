const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getOrCreateUser, formatMoney, randInt, formatDuration } = require('../../utils/helpers');
const { checkLevelUp } = require('../../utils/jobs');
const DailyStreak = require('../../models/DailyStreak');

const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily reward'),

  async execute(interaction) {
    const user = await getOrCreateUser(interaction.user.id, interaction.user.username);

    let streak = await DailyStreak.findOne({ userId: interaction.user.id });
    if (!streak) streak = await DailyStreak.create({ userId: interaction.user.id });

    const now = Date.now();
    const lastClaim = streak.lastClaim ? new Date(streak.lastClaim).getTime() : 0;
    const elapsed = now - lastClaim;

    if (elapsed < DAILY_COOLDOWN) {
      const remaining = DAILY_COOLDOWN - elapsed;
      return interaction.reply({
        content: `⏳ Daily already claimed! Come back in **${formatDuration(remaining)}**.\n🔥 Current streak: **${streak.currentStreak} days**`,
        ephemeral: true,
      });
    }

    // Check if streak is broken (more than 48 hours since last claim)
    const streakBroken = lastClaim > 0 && elapsed > 48 * 60 * 60 * 1000;
    if (streakBroken) streak.currentStreak = 0;

    // Increment streak
    streak.currentStreak += 1;
    streak.totalClaims += 1;
    if (streak.currentStreak > streak.longestStreak) {
      streak.longestStreak = streak.currentStreak;
    }
    streak.lastClaim = new Date();

    // Level based rewards
    let min, max;
    if (user.level <= 5) { min = 500; max = 1000; }
    else if (user.level <= 10) { min = 1000; max = 2500; }
    else if (user.level <= 20) { min = 2500; max = 6000; }
    else if (user.level <= 30) { min = 6000; max = 15000; }
    else if (user.level <= 50) { min = 15000; max = 40000; }
    else { min = 40000; max = 100000; }

    let amount = randInt(min, max);
    let bonusText = '';

    // Streak bonuses
    if (streak.currentStreak >= 30) { amount = Math.floor(amount * 3); bonusText = '🔥 **30 Day Streak! 3x Bonus!**'; }
    else if (streak.currentStreak >= 14) { amount = Math.floor(amount * 2); bonusText = '🔥 **14 Day Streak! 2x Bonus!**'; }
    else if (streak.currentStreak >= 7) { amount = Math.floor(amount * 1.5); bonusText = '🔥 **7 Day Streak! 1.5x Bonus!**'; }
    else if (streak.currentStreak >= 5) { amount = Math.floor(amount * 1.25); bonusText = '🔥 **5 Day Streak! +25% Bonus!**'; }
    else if (streak.currentStreak >= 3) { amount = Math.floor(amount * 1.1); bonusText = '🔥 **3 Day Streak! +10% Bonus!**'; }

    const xpGain = 25 + user.level * 5;
    user.wallet += amount;
    user.xp += xpGain;
    user.lastDaily = new Date();
    user.totalEarned += amount;

    const leveled = await checkLevelUp(user);
    await user.save();
    await streak.save();

    // Streak progress bar
    const nextMilestone = streak.currentStreak < 3 ? 3 : streak.currentStreak < 5 ? 5 : streak.currentStreak < 7 ? 7 : streak.currentStreak < 14 ? 14 : streak.currentStreak < 30 ? 30 : 30;
    const progress = Math.min(streak.currentStreak, nextMilestone);
    const pct = Math.floor((progress / nextMilestone) * 10);
    const bar = '🟦'.repeat(pct) + '⬜'.repeat(10 - pct);

    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle('🎁 Daily Reward Claimed!')
      .addFields(
        { name: '💰 Reward', value: formatMoney(amount), inline: true },
        { name: '⭐ XP Gained', value: `+${xpGain} XP`, inline: true },
        { name: '🪙 Wallet', value: formatMoney(user.wallet), inline: true },
        { name: '🔥 Streak', value: `**${streak.currentStreak} days**`, inline: true },
        { name: '🏆 Longest', value: `${streak.longestStreak} days`, inline: true },
        { name: `Progress to Day ${nextMilestone}`, value: `${bar} ${streak.currentStreak}/${nextMilestone}`, inline: false }
      );

    if (bonusText) embed.setDescription(bonusText);
    if (streakBroken) embed.setDescription('💔 Your streak was broken! Starting fresh from Day 1.');
    if (leveled) embed.addFields({ name: '🎉 Level Up!', value: `You are now **Level ${user.level}**!`, inline: false });

    await interaction.reply({ embeds: [embed] });
  },
};