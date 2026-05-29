const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getOrCreateUser, formatMoney } = require('../../utils/helpers');

const ACCOUNTS = {
  wallet: '🪙 Wallet',
  bank: '🏦 Bank',
  tradingAccount: '📈 Trading Account',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('transfer')
    .setDescription('Transfer funds between your accounts')
    .addStringOption((o) =>
      o.setName('from').setDescription('Source account').setRequired(true)
        .addChoices(
          { name: '🪙 Wallet', value: 'wallet' },
          { name: '🏦 Bank', value: 'bank' },
          { name: '📈 Trading Account', value: 'tradingAccount' }
        )
    )
    .addStringOption((o) =>
      o.setName('to').setDescription('Destination account').setRequired(true)
        .addChoices(
          { name: '🪙 Wallet', value: 'wallet' },
          { name: '🏦 Bank', value: 'bank' },
          { name: '📈 Trading Account', value: 'tradingAccount' }
        )
    )
    .addNumberOption((o) =>
      o.setName('amount').setDescription('Amount to transfer').setRequired(true).setMinValue(0.01)
    ),

  async execute(interaction) {
    const from = interaction.options.getString('from');
    const to = interaction.options.getString('to');
    const amount = interaction.options.getNumber('amount');

    if (from === to) return interaction.reply({ content: '❌ Cannot transfer to the same account.', ephemeral: true });

    const user = await getOrCreateUser(interaction.user.id, interaction.user.username);

    if (user[from] < amount) {
      return interaction.reply({
        content: `❌ Insufficient funds. ${ACCOUNTS[from]} has **${formatMoney(user[from])}**.`,
        ephemeral: true,
      });
    }

    user[from] -= amount;
    user[to] += amount;
    await user.save();

    const embed = new EmbedBuilder()
      .setColor(0x00ff88)
      .setTitle('✅ Transfer Successful')
      .addFields(
        { name: 'From', value: `${ACCOUNTS[from]}: **${formatMoney(user[from])}**`, inline: true },
        { name: 'To', value: `${ACCOUNTS[to]}: **${formatMoney(user[to])}**`, inline: true },
        { name: 'Amount', value: `**${formatMoney(amount)}**`, inline: false }
      );

    await interaction.reply({ embeds: [embed] });
  },
};