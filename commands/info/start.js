const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const User = require('../../models/User');
const { formatMoney } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('start')
    .setDescription('Create your MelonMarket account!'),

  async execute(interaction) {
    const existing = await User.findOne({ userId: interaction.user.id });

    if (existing) {
      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('✅ Account Already Active!')
        .setDescription(`Welcome back, **${interaction.user.username}**!`)
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          { name: '🪙 Wallet', value: formatMoney(existing.wallet), inline: true },
          { name: '⭐ Level', value: `${existing.level}`, inline: true },
          { name: '💼 Job', value: existing.job || '*Unemployed*', inline: true },
          { name: '🔗 Quick Links', value: '`/profile` `/balance` `/help`', inline: false }
        );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🍈 Welcome to MelonMarket!')
      .setDescription(`Hey **${interaction.user.username}**! Ready to start trading?\n\nYou'll receive **$1,000** starter cash to begin your journey.`)
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        {
          name: '💳 Your 3 Accounts',
          value: '🪙 Wallet\n🏦 Bank\n📈 Trading Account',
          inline: true,
        },
        {
          name: '🎮 Features',
          value: '📈 Stocks & Crypto\n🛢️ Oil, Gold & Crops\n🏭 Production Assets\n🏭 Warehouse System',
          inline: true,
        },
        {
          name: '🚀 First Steps',
          value: '1. `/work jobs` — Get a job\n2. `/work do` — Earn money\n3. `/transfer` — Fund trading\n4. `/stocks buy` — Make your first trade\n5. `/shop` — Buy production assets',
          inline: false,
        }
      )
      .setFooter({ text: 'Click below to create your account!' });

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
          wallet: 1000,
        });

        const successEmbed = new EmbedBuilder()
          .setColor(0x00ff88)
          .setTitle('✅ Account Created!')
          .setDescription(`Welcome to MelonMarket, **${interaction.user.username}**! 🍈`)
          .setThumbnail(interaction.user.displayAvatarURL())
          .addFields(
            { name: '🪙 Starter Cash', value: formatMoney(user.wallet), inline: true },
            { name: '⭐ Level', value: `${user.level}`, inline: true },
            { name: '🎯 Next Steps', value: '`/work jobs` — Get hired\n`/daily` — Free daily cash\n`/help` — Full guide', inline: false }
          )
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
              new ButtonBuilder().setCustomId('exp').setLabel('Timed out — use /start again').setStyle(ButtonStyle.Secondary).setDisabled(true)
            )],
          });
        } catch {}
      }
    });
  },
};