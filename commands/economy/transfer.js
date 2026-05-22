const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getOrCreateUser, formatMoney } = require('../../utils/helpers');

const ACCOUNTS = ['wallet', 'bank', 'cryptoBalance', 'stockBalance', 'casinoBalance'];
const LABEL = {
  wallet: '🪙 Wallet',
  bank: '🏦 Bank',
  cryptoBalance: '₿ Crypto',
  stockBalance: '📈 Stock',
  casinoBalance: '🎰 Casino',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('transfer')
    .setDescription('Transfer funds between your accounts')
    .addStringOption((o) =>
      o
        .setName('from')
        .setDescription('Source account')
        .setRequired(true)
        .addChoices(
          { name: 'Wallet', value: 'wallet' },
          { name: 'Bank', value: 'bank' },
          { name: 'Crypto Account', value: 'cryptoBalance' },
          { name: 'Stock Account', value: 'stockBalance' },
          { name: 'Casino Account', value: 'casinoBalance' }
        )
    )
    .addStringOption((o) =>
      o
        .setName('to')
        .setDescription('Destination account')
        .setRequired(true)
        .addChoices(
          { name: 'Wallet', value: 'wallet' },
          { name: 'Bank', value: 'bank' },
          { name: 'Crypto Account', value: 'cryptoBalance' },
          { name: 'Stock Account', value: 'stockBalance' },
          { name: 'Casino Account', value: 'casinoBalance' }
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
        content: `❌ Insufficient funds. ${LABEL[from]} has ${formatMoney(user[from])}.`,
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
        { name: 'From', value: `${LABEL[from]}: ${formatMoney(user[from] + amount)} → ${formatMoney(user[from])}`, inline: true },
        { name: 'To', value: `${LABEL[to]}: ${formatMoney(user[to] - amount)} → ${formatMoney(user[to])}`, inline: true },
        { name: 'Amount', value: `**${formatMoney(amount)}**`, inline: false }
      );

    await interaction.reply({ embeds: [embed] });
  },
};
