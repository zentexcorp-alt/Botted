const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getOrCreateUser, formatMoney } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gift')
    .setDescription('Send money to another player')
    .addUserOption((o) => o.setName('user').setDescription('User to gift').setRequired(true))
    .addNumberOption((o) => o.setName('amount').setDescription('Amount to send').setRequired(true).setMinValue(1))
    .addStringOption((o) => o.setName('message').setDescription('Optional message')),

  async execute(interaction) {
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getNumber('amount');
    const message = interaction.options.getString('message') || null;

    if (target.id === interaction.user.id) return interaction.reply({ content: '❌ You cannot gift yourself.', ephemeral: true });
    if (target.bot) return interaction.reply({ content: '❌ You cannot gift a bot.', ephemeral: true });

    const sender = await getOrCreateUser(interaction.user.id, interaction.user.username);
    const receiver = await getOrCreateUser(target.id, target.username);

    // 5% tax on gifts over $10,000
    const tax = amount > 10000 ? Math.floor(amount * 0.05) : 0;
    const received = amount - tax;

    if (sender.wallet < amount) {
      return interaction.reply({ content: `❌ You only have **${formatMoney(sender.wallet)}** in your wallet.`, ephemeral: true });
    }

    sender.wallet -= amount;
    receiver.wallet += received;

    await sender.save();
    await receiver.save();

    const embed = new EmbedBuilder()
      .setColor(0xff69b4)
      .setTitle('🎁 Gift Sent!')
      .addFields(
        { name: 'From', value: interaction.user.username, inline: true },
        { name: 'To', value: target.username, inline: true },
        { name: 'Amount Sent', value: formatMoney(amount), inline: true },
        { name: 'Tax (5%)', value: tax > 0 ? formatMoney(tax) : 'None', inline: true },
        { name: 'Received', value: formatMoney(received), inline: true }
      );

    if (message) embed.addFields({ name: '💬 Message', value: message, inline: false });

    return interaction.reply({ embeds: [embed] });
  },
};