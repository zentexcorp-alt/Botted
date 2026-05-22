const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const Asset = require('../../models/Asset');
const { formatMoney, calcNetWorth } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the server leaderboard')
    .addStringOption((o) =>
      o
        .setName('type')
        .setDescription('Leaderboard type')
        .setRequired(false)
        .addChoices(
          { name: 'Net Worth', value: 'networth' },
          { name: 'Level', value: 'level' },
          { name: 'Casino Wins', value: 'casino' }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const type = interaction.options.getString('type') || 'networth';

    const users = await User.find({}).limit(50);
    const assets = await Asset.find({ active: true });
    const assetMap = {};
    assets.forEach((a) => (assetMap[a.symbol] = a));

    let sorted = [];
    let title = '';

    if (type === 'networth') {
      title = '💎 Net Worth Leaderboard';
      const withNetWorth = await Promise.all(
        users.map(async (u) => ({ user: u, value: await calcNetWorth(u, assetMap) }))
      );
      sorted = withNetWorth.sort((a, b) => b.value - a.value).slice(0, 10);
    } else if (type === 'level') {
      title = '⭐ Level Leaderboard';
      sorted = users
        .sort((a, b) => b.level - a.level || b.xp - a.xp)
        .slice(0, 10)
        .map((u) => ({ user: u, value: u.level }));
    } else if (type === 'casino') {
      title = '🎰 Casino Wins Leaderboard';
      sorted = users
        .sort((a, b) => b.casinoWins - a.casinoWins)
        .slice(0, 10)
        .map((u) => ({ user: u, value: u.casinoWins }));
    }

    const medals = ['🥇', '🥈', '🥉'];

    const lines = sorted.map(({ user, value }, i) => {
      const medal = medals[i] || `**${i + 1}.**`;
      const name = user.username || `User ${user.userId}`;
      const display =
        type === 'networth'
          ? formatMoney(value)
          : type === 'level'
          ? `Level ${value}`
          : `${value} wins`;
      return `${medal} **${name}** — ${display}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle(title)
      .setDescription(lines.length > 0 ? lines.join('\n') : 'No data yet.')
      .setFooter({ text: 'Updated just now' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
