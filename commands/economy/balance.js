const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getOrCreateUser, formatMoney } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your account balances')
    .addUserOption((o) => o.setName('user').setDescription('User to check')),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const user = await getOrCreateUser(target.id, target.username);

    const total =
      user.wallet + user.bank + user.cryptoBalance + user.stockBalance + user.casinoBalance;

    const embed = new EmbedBuilder()
      .setColor(0x00d4aa)
      .setTitle(`💳 ${target.username}'s Balances`)
      .addFields(
        { name: '🪙 Wallet', value: formatMoney(user.wallet), inline: true },
        { name: '🏦 Bank', value: formatMoney(user.bank), inline: true },
        { name: '₿ Crypto', value: formatMoney(user.cryptoBalance), inline: true },
        { name: '📈 Stocks', value: formatMoney(user.stockBalance), inline: true },
        { name: '🎰 Casino', value: formatMoney(user.casinoBalance), inline: true },
        { name: '💎 Total', value: `**${formatMoney(total)}**`, inline: true }
      );

    await interaction.reply({ embeds: [embed] });
  },
};
