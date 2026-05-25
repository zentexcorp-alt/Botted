const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ADMIN_IDS } = require('../../config');
const { getOrCreateTax } = require('../../utils/tax');
const User = require('../../models/User');
const { formatMoney } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('taxmanage')
    .setDescription('Admin tax management')
    .addSubcommand((sub) => sub.setName('info').setDescription('View tax vault and settings'))
    .addSubcommand((sub) =>
      sub.setName('setrate')
        .setDescription('Set tax rate')
        .addNumberOption((o) => o.setName('rate').setDescription('Rate % (e.g. 5 = 5%)').setRequired(true).setMinValue(0).setMaxValue(50))
    )
    .addSubcommand((sub) =>
      sub.setName('distribute')
        .setDescription('Distribute tax vault equally to all players')
    )
    .addSubcommand((sub) =>
      sub.setName('clear')
        .setDescription('Clear the tax vault')
    ),

  async execute(interaction) {
    if (!ADMIN_IDS.includes(interaction.user.id)) {
      return interaction.reply({ content: '❌ No permission.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const tax = await getOrCreateTax(interaction.guildId);

    if (sub === 'info') {
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('💰 Tax System Info')
        .addFields(
          { name: '📊 Current Rate', value: `${(tax.taxRate * 100).toFixed(1)}%`, inline: true },
          { name: '🏦 Tax Vault', value: formatMoney(tax.taxVault), inline: true },
          { name: '💵 Total Collected', value: formatMoney(tax.totalCollected), inline: true },
          { name: '📅 Last Distributed', value: tax.lastDistributed ? new Date(tax.lastDistributed).toDateString() : 'Never', inline: true }
        )
        .addFields({
          name: '📋 Tax Brackets',
          value: [
            '⬜ Under $10,000 → **No tax**',
            '🟩 $10k–$100k → **2%**',
            '🟦 $100k–$1M → **5%**',
            '🟪 $1M–$10M → **8%**',
            '🟨 Over $10M → **12%**',
          ].join('\n'),
          inline: false,
        });

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'setrate') {
      const rate = interaction.options.getNumber('rate') / 100;
      tax.taxRate = rate;
      await tax.save();
      return interaction.editReply(`✅ Tax rate set to **${(rate * 100).toFixed(1)}%**`);
    }

    if (sub === 'distribute') {
      if (tax.taxVault <= 0) return interaction.editReply('❌ Tax vault is empty!');

      const users = await User.find({});
      if (users.length === 0) return interaction.editReply('❌ No users found.');

      const share = Math.floor(tax.taxVault / users.length);
      for (const user of users) {
        user.wallet += share;
        await user.save();
      }

      const total = tax.taxVault;
      tax.lastDistributed = new Date();
      tax.taxVault = 0;
      await tax.save();

      const embed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle('💰 Tax Distributed!')
        .addFields(
          { name: '💵 Total Distributed', value: formatMoney(total), inline: true },
          { name: '👥 Players', value: `${users.length}`, inline: true },
          { name: '💰 Per Player', value: formatMoney(share), inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
      await interaction.channel.send({ embeds: [embed] });
    }

    if (sub === 'clear') {
      tax.taxVault = 0;
      await tax.save();
      return interaction.editReply('✅ Tax vault cleared.');
    }
  },
};