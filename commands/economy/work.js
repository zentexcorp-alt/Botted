const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getOrCreateUser, formatMoney, checkCooldown, randInt, formatDuration } = require('../../utils/helpers');
const { getAvailableJobs, getJobById, checkLevelUp } = require('../../utils/jobs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('work')
    .setDescription('Work to earn money')
    .addSubcommand((sub) => sub.setName('do').setDescription('Do your current job'))
    .addSubcommand((sub) => sub.setName('jobs').setDescription('Browse available jobs for your level'))
    .addSubcommand((sub) =>
      sub
        .setName('join')
        .setDescription('Join a job')
        .addStringOption((o) => o.setName('job').setDescription('Job ID to join').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('quit').setDescription('Quit your current job')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const user = await getOrCreateUser(interaction.user.id, interaction.user.username);

    if (sub === 'jobs') {
      const available = getAvailableJobs(user.level);
      if (available.length === 0) {
        return interaction.reply({ content: '❌ No jobs available at your level.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`💼 Available Jobs (Level ${user.level})`)
        .setDescription('Use `/work join <job_id>` to join a job.');

      for (const job of available) {
        embed.addFields({
          name: `${job.name} (\`${job.id}\`)`,
          value: [
            `📝 ${job.description}`,
            `💰 Pay: **${formatMoney(job.minPay)}–${formatMoney(job.maxPay)}**`,
            `⏱ Cooldown: **${formatDuration(job.cooldown)}**`,
            `⭐ XP: **+${job.xpReward}**`,
            `🔒 Levels: ${job.minLevel}–${job.maxLevel === 999 ? '∞' : job.maxLevel}`,
          ].join('\n'),
          inline: false,
        });
      }

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'join') {
      const jobId = interaction.options.getString('job');
      const job = getJobById(jobId);
      if (!job) return interaction.reply({ content: '❌ Unknown job ID.', ephemeral: true });
      if (user.level < job.minLevel) {
        return interaction.reply({ content: `❌ You need to be at least Level ${job.minLevel} for this job.`, ephemeral: true });
      }
      user.job = job.name;
      user.lastWork = null; // reset cooldown on new job
      await user.save();
      return interaction.reply({ content: `✅ You are now a **${job.name}**! Use \`/work do\` to work.`, ephemeral: false });
    }

    if (sub === 'quit') {
      if (!user.job) return interaction.reply({ content: '❌ You are not employed.', ephemeral: true });
      const oldJob = user.job;
      user.job = null;
      user.workStreak = 0;
      await user.save();
      return interaction.reply({ content: `👋 You quit your job as **${oldJob}**.` });
    }

    // sub === 'do'
    if (!user.job) {
      return interaction.reply({ content: '❌ You have no job! Use `/work jobs` to find one and `/work join <id>` to join.', ephemeral: true });
    }

    const job = [...require('../../utils/jobs').JOBS].find((j) => j.name === user.job);
    if (!job) {
      user.job = null;
      await user.save();
      return interaction.reply({ content: '❌ Your job no longer exists. Please join a new one.', ephemeral: true });
    }

    const { ready, remaining } = checkCooldown(user.lastWork, job.cooldown);
    if (!ready) {
      return interaction.reply({
        content: `⏳ You need to rest! Work again in **${formatDuration(remaining)}**.`,
        ephemeral: true,
      });
    }

    const pay = randInt(job.minPay, job.maxPay);
    const xpGain = job.xpReward + Math.floor(user.workStreak * 2);

    user.wallet += pay;
    user.xp += xpGain;
    user.lastWork = new Date();
    user.workStreak = (user.workStreak || 0) + 1;
    user.totalEarned += pay;

    const leveled = await checkLevelUp(user);
    await user.save();

    const response = job.responses[Math.floor(Math.random() * job.responses.length)].replace(
      '{amount}',
      formatMoney(pay)
    );

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(`${job.name} — Work Complete!`)
      .setDescription(response)
      .addFields(
        { name: '💰 Earned', value: formatMoney(pay), inline: true },
        { name: '⭐ XP', value: `+${xpGain}`, inline: true },
        { name: '🔥 Streak', value: `${user.workStreak}`, inline: true },
        { name: '🪙 Wallet', value: formatMoney(user.wallet), inline: true }
      );

    if (leveled) {
      embed.addFields({ name: '🎉 Level Up!', value: `You are now **Level ${user.level}**!`, inline: false });
      embed.addFields({ name: '💼 New Jobs Available?', value: 'Check `/work jobs` for newly unlocked jobs!', inline: false });
    }

    await interaction.reply({ embeds: [embed] });
  },
};
