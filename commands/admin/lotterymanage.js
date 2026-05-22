const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ADMIN_IDS } = require('../../config');
const Lottery = require('../../models/Lottery');
const { formatMoney } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lotterymanage')
    .setDescription('Admin lottery management')
    .addSubcommand((sub) =>
      sub.setName('reset')
        .setDescription('Reset the lottery and start fresh')
    )
    .addSubcommand((sub) =>
      sub.setName('setprice')
        .setDescription('Change ticket price')
        .addNumberOption((o) => o.setName('price').setDescription('New ticket price').setRequired(true).setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub.setName('addjackpot')
        .setDescription('Manually add to jackpot')
        .addNumberOption((o) => o.setName('amount').setDescription('Amount to add').setRequired(true).setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub.setName('info')
        .setDescription('View full lottery info')
    )
    .addSubcommand((sub) =>
      sub.setName('draw')
        .setDescription('Force draw the lottery winner')
    ),

  async execute(interaction) {
    if (!ADMIN_IDS.includes(interaction.user.id)) {
      return interaction.reply({ content: '❌ No permission.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();

    async function getActiveLottery() {
      let lottery = await Lottery.findOne({ guildId: interaction.guildId, active: true });
      if (!lottery) lottery = await Lottery.create({ guildId: interaction.guildId, jackpot: 10000 });
      return lottery;
    }

    if (sub === 'reset') {
      await Lottery.updateMany({ guildId: interaction.guildId }, { active: false });
      const newLottery = await Lottery.create({ guildId: interaction.guildId, jackpot: 10000 });

      return interaction.editReply(`✅ Lottery reset! New jackpot starts at **${formatMoney(newLottery.jackpot)}**.`);
    }

    if (sub === 'setprice') {
      const price = interaction.options.getNumber('price');
      const lottery = await getActiveLottery();
      lottery.ticketPrice = price;
      await lottery.save();

      return interaction.editReply(`✅ Ticket price set to **${formatMoney(price)}**.`);
    }

    if (sub === 'addjackpot') {
      const amount = interaction.options.getNumber('amount');
      const lottery = await getActiveLottery();
      lottery.jackpot += amount;
      await lottery.save();

      return interaction.editReply(`✅ Added **${formatMoney(amount)}** to jackpot. New jackpot: **${formatMoney(lottery.jackpot)}**.`);
    }

    if (sub === 'info') {
      const lottery = await getActiveLottery();
      const totalTickets = lottery.tickets.reduce((a, t) => a + t.count, 0);

      const topBuyers = [...lottery.tickets]
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map((t, i) => `${i + 1}. **${t.username}** — ${t.count} tickets (${((t.count / totalTickets) * 100).toFixed(1)}%)`);

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('🎟️ Lottery Admin Info')
        .addFields(
          { name: '💰 Jackpot', value: formatMoney(lottery.jackpot), inline: true },
          { name: '🎟️ Ticket Price', value: formatMoney(lottery.ticketPrice), inline: true },
          { name: '👥 Total Tickets', value: `${totalTickets}`, inline: true },
          { name: '👤 Unique Players', value: `${lottery.tickets.length}`, inline: true },
          { name: '🏆 Top Buyers', value: topBuyers.join('\n') || 'None', inline: false }
        );

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'draw') {
      const lottery = await getActiveLottery();
      if (lottery.tickets.length === 0) return interaction.editReply('❌ No tickets sold yet!');

      const pool = [];
      for (const t of lottery.tickets) {
        for (let i = 0; i < t.count; i++) pool.push(t);
      }

      const winner = pool[Math.floor(Math.random() * pool.length)];
      const prize = lottery.jackpot;

      const User = require('../../models/User');
      const { getOrCreateUser } = require('../../utils/helpers');
      const winnerUser = await getOrCreateUser(winner.userId, winner.username);
      winnerUser.wallet += prize;
      await winnerUser.save();

      lottery.active = false;
      lottery.winnerId = winner.userId;
      await lottery.save();

      await Lottery.create({ guildId: interaction.guildId, jackpot: 10000 });

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('🎉 Lottery Drawn!')
        .setDescription(`**${winner.username}** wins **${formatMoney(prize)}**!`)
        .addFields(
          { name: 'Winning Tickets', value: `${winner.count}`, inline: true },
          { name: 'Total Tickets', value: `${pool.length}`, inline: true },
          { name: '🆕 New Jackpot', value: formatMoney(10000), inline: true }
        );

      return interaction.editReply({ embeds: [embed] });
    }
  },
};