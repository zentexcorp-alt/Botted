const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Clan = require('../../models/Clan');
const { getOrCreateUser, formatMoney } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clan')
    .setDescription('Create and manage your clan')
    .addSubcommand((sub) =>
      sub.setName('create')
        .setDescription('Create a new clan ($10,000)')
        .addStringOption((o) => o.setName('name').setDescription('Clan name').setRequired(true))
        .addStringOption((o) => o.setName('tag').setDescription('Short tag (3-5 chars)').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('info').setDescription('View your clan info'))
    .addSubcommand((sub) =>
      sub.setName('lookup')
        .setDescription('Look up any clan')
        .addStringOption((o) => o.setName('name').setDescription('Clan name').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('invite')
        .setDescription('Invite a member to your clan')
        .addUserOption((o) => o.setName('user').setDescription('User to invite').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('kick')
        .setDescription('Kick a member from your clan')
        .addUserOption((o) => o.setName('user').setDescription('User to kick').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('leave').setDescription('Leave your current clan'))
    .addSubcommand((sub) =>
      sub.setName('deposit')
        .setDescription('Deposit money into clan bank')
        .addNumberOption((o) => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub.setName('withdraw')
        .setDescription('Withdraw from clan bank (Owner only)')
        .addNumberOption((o) => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub.setName('promote')
        .setDescription('Promote a member to officer')
        .addUserOption((o) => o.setName('user').setDescription('User to promote').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('leaderboard').setDescription('Top clans by bank balance'))
    .addSubcommand((sub) => sub.setName('disband').setDescription('Disband your clan (Owner only)')),

  async execute(interaction) {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();
    const user = await getOrCreateUser(interaction.user.id, interaction.user.username);

    if (sub === 'create') {
      const existingMembership = await Clan.findOne({ 'members.userId': interaction.user.id });
      if (existingMembership) return interaction.editReply('❌ You are already in a clan! Leave it first.');

      const name = interaction.options.getString('name');
      const tag = interaction.options.getString('tag').toUpperCase();

      if (tag.length < 2 || tag.length > 5) return interaction.editReply('❌ Tag must be 2–5 characters.');
      if (user.wallet < 10000) return interaction.editReply('❌ Creating a clan costs **$10,000**.');

      const existing = await Clan.findOne({ $or: [{ name }, { tag }] });
      if (existing) return interaction.editReply('❌ A clan with that name or tag already exists.');

      user.wallet -= 10000;
      await user.save();

      const clan = await Clan.create({
        name, tag,
        ownerId: interaction.user.id,
        members: [{ userId: interaction.user.id, username: interaction.user.username, role: 'owner' }],
      });

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('⚔️ Clan Created!')
        .addFields(
          { name: 'Name', value: clan.name, inline: true },
          { name: 'Tag', value: `[${clan.tag}]`, inline: true },
          { name: 'Members', value: '1/10', inline: true },
          { name: '💡 Next', value: 'Use `/clan invite @user` to grow your clan!', inline: false }
        );

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'info') {
      const clan = await Clan.findOne({ 'members.userId': interaction.user.id });
      if (!clan) return interaction.editReply('❌ You are not in a clan. Use `/clan create` or get invited!');

      const memberList = clan.members.map((m) => {
        const badge = m.role === 'owner' ? '👑' : m.role === 'officer' ? '⭐' : '👤';
        return `${badge} ${m.username}`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`⚔️ [${clan.tag}] ${clan.name}`)
        .addFields(
          { name: 'Level', value: `${clan.level}`, inline: true },
          { name: 'Members', value: `${clan.members.length}/${clan.maxMembers}`, inline: true },
          { name: '🏦 Clan Bank', value: formatMoney(clan.bank), inline: true },
          { name: '👥 Roster', value: memberList, inline: false }
        );

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'lookup') {
      const name = interaction.options.getString('name');
      const clan = await Clan.findOne({ name: { $regex: name, $options: 'i' } });
      if (!clan) return interaction.editReply(`❌ Clan **"${name}"** not found.`);

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`⚔️ [${clan.tag}] ${clan.name}`)
        .addFields(
          { name: 'Level', value: `${clan.level}`, inline: true },
          { name: 'Members', value: `${clan.members.length}/${clan.maxMembers}`, inline: true },
          { name: '🏦 Bank', value: formatMoney(clan.bank), inline: true },
          { name: 'Owner', value: clan.members.find((m) => m.role === 'owner')?.username || 'Unknown', inline: true }
        );

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'invite') {
      const clan = await Clan.findOne({ ownerId: interaction.user.id });
      if (!clan) return interaction.editReply('❌ Only the clan owner can invite members.');
      if (clan.members.length >= clan.maxMembers) return interaction.editReply('❌ Clan is full!');

      const target = interaction.options.getUser('user');
      const alreadyIn = await Clan.findOne({ 'members.userId': target.id });
      if (alreadyIn) return interaction.editReply('❌ That user is already in a clan.');

      clan.members.push({ userId: target.id, username: target.username, role: 'member' });
      await clan.save();

      return interaction.editReply(`✅ **${target.username}** has been added to **${clan.name}**!`);
    }

    if (sub === 'kick') {
      const clan = await Clan.findOne({ ownerId: interaction.user.id });
      if (!clan) return interaction.editReply('❌ Only the clan owner can kick members.');

      const target = interaction.options.getUser('user');
      if (target.id === interaction.user.id) return interaction.editReply('❌ You cannot kick yourself.');

      const idx = clan.members.findIndex((m) => m.userId === target.id);
      if (idx === -1) return interaction.editReply('❌ That user is not in your clan.');

      clan.members.splice(idx, 1);
      await clan.save();

      return interaction.editReply(`✅ **${target.username}** has been kicked from **${clan.name}**.`);
    }

    if (sub === 'leave') {
      const clan = await Clan.findOne({ 'members.userId': interaction.user.id });
      if (!clan) return interaction.editReply('❌ You are not in a clan.');
      if (clan.ownerId === interaction.user.id) return interaction.editReply('❌ You are the owner! Disband the clan or transfer ownership first.');

      clan.members = clan.members.filter((m) => m.userId !== interaction.user.id);
      await clan.save();

      return interaction.editReply(`✅ You left **${clan.name}**.`);
    }

    if (sub === 'deposit') {
      const clan = await Clan.findOne({ 'members.userId': interaction.user.id });
      if (!clan) return interaction.editReply('❌ You are not in a clan.');

      const amount = interaction.options.getNumber('amount');
      if (user.wallet < amount) return interaction.editReply(`❌ You only have **${formatMoney(user.wallet)}** in your wallet.`);

      user.wallet -= amount;
      await user.save();

      clan.bank += amount;
      clan.xp += Math.floor(amount / 100);
      await clan.save();

      return interaction.editReply(`✅ Deposited **${formatMoney(amount)}** into **${clan.name}**'s bank. New balance: **${formatMoney(clan.bank)}**`);
    }

    if (sub === 'withdraw') {
      const clan = await Clan.findOne({ ownerId: interaction.user.id });
      if (!clan) return interaction.editReply('❌ Only the clan owner can withdraw.');

      const amount = interaction.options.getNumber('amount');
      if (clan.bank < amount) return interaction.editReply(`❌ Clan bank only has **${formatMoney(clan.bank)}**.`);

      clan.bank -= amount;
      await clan.save();

      user.wallet += amount;
      await user.save();

      return interaction.editReply(`✅ Withdrew **${formatMoney(amount)}** from clan bank. Your wallet: **${formatMoney(user.wallet)}**`);
    }

    if (sub === 'promote') {
      const clan = await Clan.findOne({ ownerId: interaction.user.id });
      if (!clan) return interaction.editReply('❌ Only the owner can promote members.');

      const target = interaction.options.getUser('user');
      const member = clan.members.find((m) => m.userId === target.id);
      if (!member) return interaction.editReply('❌ That user is not in your clan.');

      member.role = 'officer';
      await clan.save();

      return interaction.editReply(`✅ **${target.username}** has been promoted to **Officer** ⭐`);
    }

    if (sub === 'leaderboard') {
      const clans = await Clan.find({}).sort({ bank: -1 }).limit(10);
      if (clans.length === 0) return interaction.editReply('No clans found!');

      const medals = ['🥇', '🥈', '🥉'];
      const lines = clans.map((c, i) => `${medals[i] || `**${i + 1}.**`} **[${c.tag}] ${c.name}** — Bank: ${formatMoney(c.bank)} | Members: ${c.members.length} | Lv${c.level}`);

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('⚔️ Clan Leaderboard')
        .setDescription(lines.join('\n'));

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'disband') {
      const clan = await Clan.findOne({ ownerId: interaction.user.id });
      if (!clan) return interaction.editReply('❌ You don\'t own a clan.');

      const refund = Math.floor(clan.bank + 5000);
      user.wallet += refund;
      await user.save();

      await Clan.deleteOne({ _id: clan._id });

      return interaction.editReply(`💔 **${clan.name}** has been disbanded. You received **${formatMoney(refund)}** back.`);
    }
  },
};