const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Lottery = require('../../models/Lottery');
const { getOrCreateUser, formatMoney } = require('../../utils/helpers');

async function getOrCreateLottery(guildId) {
  let lottery = await Lottery.findOne({ guildId, active: true });
  if (!lottery) {
    lottery = await Lottery.create({ guildId, jackpot: 10000 });
  }
  return lottery;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lottery')
    .setDescription('Server lottery system')
    .addSubcommand((sub) =>
      sub.setName('buy')
        .setDescription('Buy lottery tickets ($500 each)')
        .addIntegerOption((o) => o.setName('amount').setDescription('Number of tickets').setRequired(true).setMinValue(1).setMaxValue(10))
    )
    .addSubcommand((sub) => sub.setName('info').setDescription('View current lottery jackpot and your tickets'))
    .addSubcommand((sub) => sub.setName('draw').setDescription('Draw the lottery winner (Admin only)')),

  async execute(interaction) {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();
    const user = await getOrCreateUser(interaction.user.id, interaction.user.username);
    const lottery = await getOrCreateLottery(interaction.guildId);

    if (sub === 'buy') {
      const amount = interaction.options.getInteger('amount');
      const cost = amount * lottery.ticketPrice;

      if (user.wallet < cost) return interaction.editReply(`❌ **${amount} tickets** costs **${formatMoney(cost)}**. You have **${formatMoney(user.wallet)}**.`);

      user.wallet -= cost;
      await user.save();

      lottery.jackpot += cost;
      const existing = lottery.tickets.find((t) => t.userId === interaction.user.id);
      if (existing) {
        existing.count += amount;
      } else {
        lottery.tickets.push({ userId: interaction.user.id, username: interaction.user.username, count: amount });
      }
      await lottery.save();

      const myTickets = lottery.tickets.find((t) => t.userId === interaction.user.id)?.count || 0;
      const totalTickets = lottery.tickets.reduce((a, t) => a + t.count, 0);
      const odds = ((myTickets / totalTickets) * 100).toFixed(1);

      return interaction.editReply(`🎟️ Bought **${amount} ticket(s)** for **${formatMoney(cost)}**!\nYour tickets: **${myTickets}** | Win chance: **${odds}%** | Jackpot: **${formatMoney(lottery.jackpot)}**`);
    }

    if (sub === 'info') {
      const totalTickets = lottery.tickets.reduce((a, t) => a + t.count, 0);
      const myEntry = lottery.tickets.find((t) => t.userId === interaction.user.id);
      const myTickets = myEntry?.count || 0;
      const odds = totalTickets > 0 ? ((myTickets / totalTickets) * 100).toFixed(1) : '0';

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('🎰 Server Lottery')
        .addFields(
          { name: '💰 Jackpot', value: formatMoney(lottery.jackpot), inline: true },
          { name: '🎟️ Ticket Price', value: formatMoney(lottery.ticketPrice), inline: true },
          { name: '👥 Total Tickets', value: `${totalTickets}`, inline: true },
          { name: '🎟️ Your Tickets', value: `${myTickets}`, inline: true },
          { name: '🎯 Your Odds', value: `${odds}%`, inline: true },
          { name: '📢', value: 'Admin draws winner with `/lottery draw`', inline: false }
        );

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'draw') {
      if (!interaction.member.permissions.has(8n)) return interaction.editReply('❌ Admins only.');
      if (lottery.tickets.length === 0) return interaction.editReply('❌ No tickets sold yet!');

      // Weighted random draw
      const pool = [];
      for (const t of lottery.tickets) {
        for (let i = 0; i < t.count; i++) pool.push(t);
      }

      const winner = pool[Math.floor(Math.random() * pool.length)];
      const prize = lottery.jackpot;

      const winnerUser = await getOrCreateUser(winner.userId, winner.username);
      winnerUser.wallet += prize;
      await winnerUser.save();

      lottery.active = false;
      lottery.winnerId = winner.userId;
      await lottery.save();

      // Create new lottery
      await Lottery.create({ guildId: interaction.guildId, jackpot: 10000 });

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('🎉 Lottery Draw!')
        .setDescription(`**${winner.username}** wins the jackpot of **${formatMoney(prize)}**!`)
        .addFields(
          { name: 'Winning Tickets', value: `${winner.count}`, inline: true },
          { name: 'Total Tickets', value: `${pool.length}`, inline: true },
          { name: '🆕 New Jackpot', value: formatMoney(10000), inline: true }
        );

      return interaction.editReply({ embeds: [embed] });
    }
  },
};