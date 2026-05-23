const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getOrCreateUser, formatMoney } = require('../../utils/helpers');
const Transaction = require('../../models/Transaction');

const TYPE_EMOJI = {
  buy_crypto: '₿ Buy Crypto',
  sell_crypto: '₿ Sell Crypto',
  buy_stock: '📈 Buy Stock',
  sell_stock: '📈 Sell Stock',
  deposit: '🏦 Deposit',
  withdraw: '🏦 Withdraw',
  work: '💼 Work',
  daily: '🎁 Daily',
  casino_win: '🎰 Casino Win',
  casino_loss: '🎰 Casino Loss',
  interest: '💹 Interest',
  admin: '🛡️ Admin',
  transfer: '💸 Transfer',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('View your transaction history')
    .addStringOption((o) =>
      o.setName('filter').setDescription('Filter by type').setRequired(false)
        .addChoices(
          { name: '₿ Crypto Trades', value: 'crypto' },
          { name: '📈 Stock Trades', value: 'stock' },
          { name: '🎰 Casino', value: 'casino' },
          { name: '💼 Work', value: 'work' },
          { name: '🎁 Daily', value: 'daily' },
          { name: '💸 All', value: 'all' }
        )
    )
    .addIntegerOption((o) =>
      o.setName('limit').setDescription('How many to show (max 20)').setMinValue(1).setMaxValue(20)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const filter = interaction.options.getString('filter') || 'all';
    const limit = interaction.options.getInteger('limit') || 10;

    let query = { userId: interaction.user.id };

    if (filter === 'crypto') query.type = { $in: ['buy_crypto', 'sell_crypto'] };
    else if (filter === 'stock') query.type = { $in: ['buy_stock', 'sell_stock'] };
    else if (filter === 'casino') query.type = { $in: ['casino_win', 'casino_loss'] };
    else if (filter === 'work') query.type = 'work';
    else if (filter === 'daily') query.type = 'daily';

    const transactions = await Transaction.find(query)
      .sort({ timestamp: -1 })
      .limit(limit);

    if (transactions.length === 0) {
      return interaction.editReply('📭 No transactions found.');
    }

    // Calculate stats
    const totalIn = transactions
      .filter((t) => ['sell_crypto', 'sell_stock', 'casino_win', 'work', 'daily', 'interest'].includes(t.type))
      .reduce((a, t) => a + t.total, 0);

    const totalOut = transactions
      .filter((t) => ['buy_crypto', 'buy_stock', 'casino_loss'].includes(t.type))
      .reduce((a, t) => a + t.total, 0);

    const lines = transactions.map((t) => {
      const emoji = TYPE_EMOJI[t.type] || t.type;
      const symbol = t.symbol ? ` **${t.symbol}**` : '';
      const date = new Date(t.timestamp).toLocaleDateString();
      const time = new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const isIncome = ['sell_crypto', 'sell_stock', 'casino_win', 'work', 'daily', 'interest'].includes(t.type);
      const amountStr = isIncome ? `+${formatMoney(t.total)}` : `-${formatMoney(t.total)}`;
      return `\`${date} ${time}\` ${emoji}${symbol} — **${amountStr}**`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📋 Transaction History`)
      .setDescription(lines.join('\n'))
      .addFields(
        { name: '💰 Total In', value: formatMoney(totalIn), inline: true },
        { name: '💸 Total Out', value: formatMoney(totalOut), inline: true },
        { name: '📊 Net', value: formatMoney(totalIn - totalOut), inline: true }
      )
      .setFooter({ text: `Showing last ${transactions.length} transactions` });

    return interaction.editReply({ embeds: [embed] });
  },
};