const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const User = require('../../models/User');
const { formatMoney } = require('../../utils/helpers');

const STARTER_CASH = 1000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('start')
    .setDescription('Create your account and begin your journey!'),

  async execute(interaction) {
    const existing = await User.findOne({ userId: interaction.user.id });

    if (existing) {
      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('✅ Account Already Active!')
        .setDescription(`Hey **${interaction.user.username}**, you already have an account!`)
        .addFields(
          { name: '🪙 Wallet', value: formatMoney(existing.wallet), inline: true },
          { name: '⭐ Level', value: `${existing.level}`, inline: true },
          { name: '💼 Job', value: existing.job || '*Unemployed*', inline: true },
          { name: '🔗 Quick Links', value: '`/profile` — Full stats\n`/balance` — All balances\n`/help` — Command guide', inline: false }
        )
        .setThumbnail(interaction.user.displayAvatarURL());

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🎉 Welcome to EconomyBot!')
      .setDescription(`Hey **${interaction.user.username}**! You're about to start your financial journey.\n\nYou'll receive **${formatMoney(STARTER_CASH)}** in your wallet to get started.`)
      .addFields(
        {
          name: '💳 5 Accounts',
          value: ['🪙 Wallet', '🏦 Bank', '₿ Crypto', '📈 Stocks', '🎰 Casino'].join('\n'),
          inline: true,
        },
        {
          name: '🎮 Features',
          value: ['🏢 Businesses', '🌾 Farming', '🏠 Real Estate', '⚔️ Clans', '🏆 Tournaments', '🎟️ Lottery'].join('\n'),
          inline: true,
        },
        {
          name: '🚀 First Steps',
          value: ['1. `/work jobs` — Find a job', '2. `/work join <id>` — Get hired', '3. `/work do` — Earn money', '4. `/daily` — Free daily cash', '5. `/help` — Full command list'].join('\n'),
          inline: false,
        }
      )
      .setThumbnail(interaction.user.displayAvatarURL())
      .setFooter({ text: 'Click "Create Account" below to get started!' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm_start').setLabel('🚀 Create Account').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('cancel_start').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );

    const reply = await interaction.reply({ embeds: [welcomeEmbed], components: [row], fetchReply: true });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60_000,
      filter: (i) => i.user.id === interaction.user.id,
    });

    collector.on('collect', async (i) => {
      if (i.customId === 'cancel_start') {
        await i.update({ embeds: [new EmbedBuilder().setColor(0x95a5a6).setDescription('❌ Cancelled. Use `/start` anytime.')], components: [] });
        return collector.stop();
      }

      if (i.customId === 'confirm_start') {
        const doubleCheck = await User.findOne({ userId: interaction.user.id });
        if (doubleCheck) {
          await i.update({ embeds: [new EmbedBuilder().setColor(0xffd700).setDescription('⚠️ Account already exists!')], components: [] });
          return collector.stop();
        }

        const user = await User.create({
          userId: interaction.user.id,
          username: interaction.user.username,
          wallet: STARTER_CASH,
        });

        const successEmbed = new EmbedBuilder()
          .setColor(0x00ff88)
          .setTitle('✅ Account Created!')
          .setDescription(`Welcome aboard, **${interaction.user.username}**! 🚀`)
          .addFields(
            { name: '🪙 Wallet', value: formatMoney(user.wallet), inline: true },
            { name: '⭐ Level', value: `${user.level}`, inline: true },
            { name: '🎯 Next Steps', value: '`/work jobs` — Get a job\n`/daily` — Free daily cash\n`/help` — All commands', inline: false }
          )
          .setThumbnail(interaction.user.displayAvatarURL())
          .setTimestamp();

        await i.update({ embeds: [successEmbed], components: [] });
        collector.stop();
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time') {
        try {
          await reply.edit({
            components: [new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('expired').setLabel('Timed out — use /start again').setStyle(ButtonStyle.Secondary).setDisabled(true)
            )],
          });
        } catch {}
      }
    });
  },
};