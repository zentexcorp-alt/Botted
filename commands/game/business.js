const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Business = require('../../models/Business');
const { getOrCreateUser, formatMoney, checkCooldown, formatDuration, randInt } = require('../../utils/helpers');

const BUSINESS_TYPES = {
  restaurant: { name: '🍕 Restaurant', startup: 5000, cooldown: 2 * 60 * 60 * 1000, minIncome: 500, maxIncome: 800 },
  techstartup: { name: '💻 Tech Startup', startup: 20000, cooldown: 4 * 60 * 60 * 1000, minIncome: 1500, maxIncome: 3000 },
  store: { name: '🏪 Convenience Store', startup: 3000, cooldown: 60 * 60 * 1000, minIncome: 200, maxIncome: 400 },
  recordlabel: { name: '🎵 Record Label', startup: 15000, cooldown: 3 * 60 * 60 * 1000, minIncome: 1000, maxIncome: 2000 },
  gym: { name: '🏋️ Gym', startup: 8000, cooldown: 2 * 60 * 60 * 1000, minIncome: 600, maxIncome: 1000 },
  hotel: { name: '🏨 Hotel', startup: 40000, cooldown: 6 * 60 * 60 * 1000, minIncome: 3000, maxIncome: 6000 },
  cryptoexchange: { name: '🚀 Crypto Exchange', startup: 75000, cooldown: 8 * 60 * 60 * 1000, minIncome: 8000, maxIncome: 15000 },
  gamestudio: { name: '🎮 Game Studio', startup: 30000, cooldown: 5 * 60 * 60 * 1000, minIncome: 2000, maxIncome: 5000 },
};

const STAFF_ROLES = {
  manager: { name: '👔 Manager', salary: 500, benefit: 'Auto-collects income' },
  marketing: { name: '📣 Marketing', salary: 300, benefit: '+20% income' },
  accountant: { name: '🧮 Accountant', salary: 400, benefit: '-15% expenses' },
  security: { name: '🔒 Security', salary: 350, benefit: 'Prevents negative events' },
  cleaner: { name: '🧹 Cleaner', salary: 150, benefit: '+5% reputation' },
};

const LEVEL_COSTS = [0, 10000, 25000, 50000, 100000, 200000, 350000, 500000, 750000, 1000000];
const LEVEL_BOOST = [1, 1.25, 1.5, 1.8, 2.2, 2.7, 3.3, 4.0, 4.8, 6.0];

const RANDOM_EVENTS = [
  { name: '⭐ Viral Moment!', desc: '3x income for 2 hours!', boost: 3, duration: 2 * 60 * 60 * 1000, repBoost: 5 },
  { name: '🏆 Best Business Award!', desc: 'Reputation boost + bonus cash!', boost: 1, duration: 0, repBoost: 20, bonusCash: true },
  { name: '📺 TV Feature!', desc: 'Income doubled for 1 hour!', boost: 2, duration: 60 * 60 * 1000, repBoost: 10 },
  { name: '💡 Innovation Breakthrough!', desc: 'Permanent +10% income boost!', boost: 1.1, duration: -1, repBoost: 5 },
  { name: '👑 Celebrity Visit!', desc: 'Massive reputation spike!', boost: 1, duration: 0, repBoost: 30 },
];

function getRepMultiplier(rep) {
  if (rep <= 20) return 0.5;
  if (rep <= 40) return 0.75;
  if (rep <= 60) return 1.0;
  if (rep <= 80) return 1.25;
  return 1.5;
}

function calcIncome(business, type) {
  const base = randInt(type.minIncome, type.maxIncome);
  const levelMult = LEVEL_BOOST[business.level - 1] || 1;
  const repMult = getRepMultiplier(business.reputation);
  const hasMarketing = business.staff.some((s) => s.role === 'marketing');
  const marketingMult = hasMarketing ? 1.2 : 1;
  const boostMult = business.incomeBoost || 1;
  return Math.floor(base * levelMult * repMult * marketingMult * boostMult);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('business')
    .setDescription('Start and manage your business')
    .addSubcommand((sub) =>
      sub.setName('start')
        .setDescription('Start a new business')
        .addStringOption((o) =>
          o.setName('type').setDescription('Business type').setRequired(true)
            .addChoices(
              { name: '🍕 Restaurant ($5,000)', value: 'restaurant' },
              { name: '💻 Tech Startup ($20,000)', value: 'techstartup' },
              { name: '🏪 Convenience Store ($3,000)', value: 'store' },
              { name: '🎵 Record Label ($15,000)', value: 'recordlabel' },
              { name: '🏋️ Gym ($8,000)', value: 'gym' },
              { name: '🏨 Hotel ($40,000)', value: 'hotel' },
              { name: '🚀 Crypto Exchange ($75,000)', value: 'cryptoexchange' },
              { name: '🎮 Game Studio ($30,000)', value: 'gamestudio' }
            )
        )
        .addStringOption((o) => o.setName('name').setDescription('Business name').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('info').setDescription('View your business dashboard'))
    .addSubcommand((sub) => sub.setName('collect').setDescription('Collect your earnings'))
    .addSubcommand((sub) => sub.setName('upgrade').setDescription('Upgrade your business to next level'))
    .addSubcommand((sub) => sub.setName('advertise').setDescription('Spend money to boost reputation'))
    .addSubcommand((sub) =>
      sub.setName('hire')
        .setDescription('Hire a staff member')
        .addStringOption((o) =>
          o.setName('role').setDescription('Role to hire').setRequired(true)
            .addChoices(
              { name: '👔 Manager ($500/day)', value: 'manager' },
              { name: '📣 Marketing ($300/day)', value: 'marketing' },
              { name: '🧮 Accountant ($400/day)', value: 'accountant' },
              { name: '🔒 Security ($350/day)', value: 'security' },
              { name: '🧹 Cleaner ($150/day)', value: 'cleaner' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub.setName('fire')
        .setDescription('Fire a staff member')
        .addStringOption((o) =>
          o.setName('role').setDescription('Role to fire').setRequired(true)
            .addChoices(
              { name: 'Manager', value: 'manager' },
              { name: 'Marketing', value: 'marketing' },
              { name: 'Accountant', value: 'accountant' },
              { name: 'Security', value: 'security' },
              { name: 'Cleaner', value: 'cleaner' }
            )
        )
    )
    .addSubcommand((sub) => sub.setName('staff').setDescription('View your staff'))
    .addSubcommand((sub) =>
      sub.setName('partner')
        .setDescription('Add a co-owner to your business')
        .addUserOption((o) => o.setName('user').setDescription('Partner to add').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('unpartner').setDescription('Remove your current partner'))
    .addSubcommand((sub) =>
      sub.setName('rename')
        .setDescription('Rename your business')
        .addStringOption((o) => o.setName('name').setDescription('New name').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('leaderboard').setDescription('Top businesses on the server'))
    .addSubcommand((sub) => sub.setName('close').setDescription('Permanently close your business')),

  async execute(interaction) {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();
    const user = await getOrCreateUser(interaction.user.id, interaction.user.username);

    // ── START ──────────────────────────────────────────────────────────────
    if (sub === 'start') {
      const existing = await Business.findOne({ userId: interaction.user.id });
      if (existing) return interaction.editReply('❌ You already own a business! Use `/business info` to view it.');

      const typeKey = interaction.options.getString('type');
      const name = interaction.options.getString('name');
      const type = BUSINESS_TYPES[typeKey];

      if (user.wallet < type.startup) {
        return interaction.editReply(`❌ You need **${formatMoney(type.startup)}** in your wallet to start this business. You have **${formatMoney(user.wallet)}**.`);
      }

      user.wallet -= type.startup;
      await user.save();

      const business = await Business.create({
        userId: interaction.user.id,
        name,
        type: typeKey,
      });

      const embed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle('🏢 Business Launched!')
        .setDescription(`**${name}** is now open for business!`)
        .addFields(
          { name: 'Type', value: type.name, inline: true },
          { name: 'Startup Cost', value: formatMoney(type.startup), inline: true },
          { name: 'Collect Every', value: formatDuration(type.cooldown), inline: true },
          { name: 'Income Range', value: `${formatMoney(type.minIncome)} – ${formatMoney(type.maxIncome)}`, inline: true },
          { name: '💡 Next Steps', value: 'Use `/business collect` to collect income\nUse `/business hire` to hire staff\nUse `/business upgrade` to grow!', inline: false }
        );

      return interaction.editReply({ embeds: [embed] });
    }

    // ── INFO ───────────────────────────────────────────────────────────────
    if (sub === 'info') {
      const business = await Business.findOne({ userId: interaction.user.id });
      if (!business) return interaction.editReply('❌ You don\'t own a business. Use `/business start` to launch one!');

      const type = BUSINESS_TYPES[business.type];
      const { ready, remaining } = checkCooldown(business.lastCollect, type.cooldown);
      const staffList = business.staff.length > 0
        ? business.staff.map((s) => `• ${STAFF_ROLES[s.role]?.name || s.role}`).join('\n')
        : 'No staff hired';

      const boostActive = business.incomeBoostExpiry && new Date() < new Date(business.incomeBoostExpiry);

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`🏢 ${business.name}`)
        .addFields(
          { name: 'Type', value: type.name, inline: true },
          { name: 'Level', value: `${business.level}/10`, inline: true },
          { name: 'Reputation', value: `${business.reputation}/100 ⭐`, inline: true },
          { name: '💰 Vault', value: formatMoney(business.vault), inline: true },
          { name: '📊 Total Earned', value: formatMoney(business.totalEarned), inline: true },
          { name: '⏱ Collect', value: ready ? '✅ Ready!' : `⏳ ${formatDuration(remaining)}`, inline: true },
          { name: '👥 Staff', value: staffList, inline: true },
          { name: '🚀 Income Boost', value: boostActive ? `${business.incomeBoost}x active!` : 'None', inline: true },
          { name: '🤝 Partner', value: business.partnerId ? `<@${business.partnerId}>` : 'None', inline: true }
        )
        .setFooter({ text: `Next upgrade cost: ${business.level < 10 ? formatMoney(LEVEL_COSTS[business.level]) : 'MAX LEVEL'}` });

      return interaction.editReply({ embeds: [embed] });
    }

    // ── COLLECT ────────────────────────────────────────────────────────────
    if (sub === 'collect') {
      const business = await Business.findOne({ userId: interaction.user.id });
      if (!business) return interaction.editReply('❌ You don\'t own a business.');

      const type = BUSINESS_TYPES[business.type];
      const { ready, remaining } = checkCooldown(business.lastCollect, type.cooldown);

      if (!ready) return interaction.editReply(`⏳ Come back in **${formatDuration(remaining)}** to collect.`);

      const income = calcIncome(business, type);

      // Random event chance (10%)
      let eventMsg = '';
      if (Math.random() < 0.1 && (!business.lastEvent || Date.now() - new Date(business.lastEvent).getTime() > 60 * 60 * 1000)) {
        const event = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
        eventMsg = `\n\n🎉 **${event.name}**\n${event.desc}`;
        business.reputation = Math.min(100, business.reputation + event.repBoost);
        if (event.duration > 0) {
          business.incomeBoost = event.boost;
          business.incomeBoostExpiry = new Date(Date.now() + event.duration);
        } else if (event.duration === -1) {
          business.incomeBoost = (business.incomeBoost || 1) * event.boost;
        }
        if (event.bonusCash) {
          business.vault += income;
        }
        business.lastEvent = new Date();
      }

      // Expire boost
      if (business.incomeBoostExpiry && new Date() > new Date(business.incomeBoostExpiry)) {
        business.incomeBoost = 1;
        business.incomeBoostExpiry = null;
      }

      business.vault += income;
      business.totalEarned += income;
      business.lastCollect = new Date();

      // Reputation slight decay
      business.reputation = Math.max(0, business.reputation - 1);

      await business.save();

      user.wallet += income;
      await user.save();

      const embed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle(`💰 ${business.name} — Income Collected!`)
        .setDescription(`You collected **${formatMoney(income)}** from your business!${eventMsg}`)
        .addFields(
          { name: '🪙 Wallet', value: formatMoney(user.wallet), inline: true },
          { name: '⭐ Reputation', value: `${business.reputation}/100`, inline: true }
        );

      return interaction.editReply({ embeds: [embed] });
    }

    // ── UPGRADE ────────────────────────────────────────────────────────────
    if (sub === 'upgrade') {
      const business = await Business.findOne({ userId: interaction.user.id });
      if (!business) return interaction.editReply('❌ You don\'t own a business.');
      if (business.level >= 10) return interaction.editReply('✅ Your business is already at **Max Level 10**!');

      const cost = LEVEL_COSTS[business.level];
      if (user.wallet < cost) return interaction.editReply(`❌ You need **${formatMoney(cost)}** to upgrade. You have **${formatMoney(user.wallet)}**.`);

      user.wallet -= cost;
      await user.save();
      business.level += 1;
      await business.save();

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('🎉 Business Upgraded!')
        .addFields(
          { name: 'New Level', value: `**Level ${business.level}**`, inline: true },
          { name: 'Income Multiplier', value: `**${LEVEL_BOOST[business.level - 1]}x**`, inline: true },
          { name: 'Cost Paid', value: formatMoney(cost), inline: true }
        );

      return interaction.editReply({ embeds: [embed] });
    }

    // ── ADVERTISE ──────────────────────────────────────────────────────────
    if (sub === 'advertise') {
      const business = await Business.findOne({ userId: interaction.user.id });
      if (!business) return interaction.editReply('❌ You don\'t own a business.');

      const { ready, remaining } = checkCooldown(business.lastAdvertise, 6 * 60 * 60 * 1000);
      if (!ready) return interaction.editReply(`⏳ You can advertise again in **${formatDuration(remaining)}**.`);

      const cost = 500 * business.level;
      if (user.wallet < cost) return interaction.editReply(`❌ Advertising costs **${formatMoney(cost)}**. You have **${formatMoney(user.wallet)}**.`);

      user.wallet -= cost;
      await user.save();

      const repGain = randInt(10, 20);
      business.reputation = Math.min(100, business.reputation + repGain);
      business.lastAdvertise = new Date();
      await business.save();

      return interaction.editReply(`📣 Advertised **${business.name}**! Reputation +${repGain} → **${business.reputation}/100**. Cost: ${formatMoney(cost)}`);
    }

    // ── HIRE ───────────────────────────────────────────────────────────────
    if (sub === 'hire') {
      const business = await Business.findOne({ userId: interaction.user.id });
      if (!business) return interaction.editReply('❌ You don\'t own a business.');

      const role = interaction.options.getString('role');
      const staffInfo = STAFF_ROLES[role];
      const alreadyHired = business.staff.some((s) => s.role === role);
      if (alreadyHired) return interaction.editReply(`❌ You already have a **${staffInfo.name}** hired.`);

      const dayCost = staffInfo.salary;
      if (user.wallet < dayCost) return interaction.editReply(`❌ Need **${formatMoney(dayCost)}** to hire. You have **${formatMoney(user.wallet)}**.`);

      user.wallet -= dayCost;
      await user.save();

      business.staff.push({ role, salary: dayCost });
      await business.save();

      return interaction.editReply(`✅ Hired **${staffInfo.name}**! Benefit: ${staffInfo.benefit}. Daily salary: **${formatMoney(dayCost)}**`);
    }

    // ── FIRE ───────────────────────────────────────────────────────────────
    if (sub === 'fire') {
      const business = await Business.findOne({ userId: interaction.user.id });
      if (!business) return interaction.editReply('❌ You don\'t own a business.');

      const role = interaction.options.getString('role');
      const idx = business.staff.findIndex((s) => s.role === role);
      if (idx === -1) return interaction.editReply(`❌ You don't have a **${role}** on staff.`);

      business.staff.splice(idx, 1);
      await business.save();

      return interaction.editReply(`✅ Fired your **${STAFF_ROLES[role]?.name || role}**.`);
    }

    // ── STAFF ──────────────────────────────────────────────────────────────
    if (sub === 'staff') {
      const business = await Business.findOne({ userId: interaction.user.id });
      if (!business) return interaction.editReply('❌ You don\'t own a business.');
      if (business.staff.length === 0) return interaction.editReply('📭 No staff hired. Use `/business hire` to hire someone!');

      const totalSalary = business.staff.reduce((a, s) => a + s.salary, 0);
      const lines = business.staff.map((s) => {
        const info = STAFF_ROLES[s.role];
        return `${info?.name || s.role} — ${formatMoney(s.salary)}/day | ${info?.benefit}`;
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`👥 ${business.name} — Staff`)
        .setDescription(lines.join('\n'))
        .addFields({ name: '💸 Total Daily Salary', value: formatMoney(totalSalary), inline: false });

      return interaction.editReply({ embeds: [embed] });
    }

    // ── PARTNER ────────────────────────────────────────────────────────────
    if (sub === 'partner') {
      const business = await Business.findOne({ userId: interaction.user.id });
      if (!business) return interaction.editReply('❌ You don\'t own a business.');

      const target = interaction.options.getUser('user');
      if (target.id === interaction.user.id) return interaction.editReply('❌ You cannot partner with yourself.');

      business.partnerId = target.id;
      await business.save();

      return interaction.editReply(`✅ **${target.username}** is now a co-owner of **${business.name}**!`);
    }

    // ── UNPARTNER ──────────────────────────────────────────────────────────
    if (sub === 'unpartner') {
      const business = await Business.findOne({ userId: interaction.user.id });
      if (!business) return interaction.editReply('❌ You don\'t own a business.');
      if (!business.partnerId) return interaction.editReply('❌ You have no partner.');

      business.partnerId = null;
      await business.save();
      return interaction.editReply('✅ Partnership removed.');
    }

    // ── RENAME ─────────────────────────────────────────────────────────────
    if (sub === 'rename') {
      const business = await Business.findOne({ userId: interaction.user.id });
      if (!business) return interaction.editReply('❌ You don\'t own a business.');

      const newName = interaction.options.getString('name');
      business.name = newName;
      await business.save();
      return interaction.editReply(`✅ Business renamed to **${newName}**!`);
    }

    // ── LEADERBOARD ────────────────────────────────────────────────────────
    if (sub === 'leaderboard') {
      const businesses = await Business.find({ active: true }).sort({ totalEarned: -1 }).limit(10);
      if (businesses.length === 0) return interaction.editReply('No businesses found yet!');

      const medals = ['🥇', '🥈', '🥉'];
      const lines = businesses.map((b, i) => {
        const type = BUSINESS_TYPES[b.type];
        return `${medals[i] || `**${i + 1}.**`} **${b.name}** (${type?.name || b.type}) — Earned: ${formatMoney(b.totalEarned)} | Lv${b.level} | ⭐${b.reputation}`;
      });

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('🏢 Business Leaderboard')
        .setDescription(lines.join('\n'));

      return interaction.editReply({ embeds: [embed] });
    }

    // ── CLOSE ──────────────────────────────────────────────────────────────
    if (sub === 'close') {
      const business = await Business.findOne({ userId: interaction.user.id });
      if (!business) return interaction.editReply('❌ You don\'t own a business.');

      // Refund 25% of startup cost
      const type = BUSINESS_TYPES[business.type];
      const refund = Math.floor(type.startup * 0.25);
      user.wallet += refund + business.vault;
      await user.save();

      await Business.deleteOne({ userId: interaction.user.id });

      return interaction.editReply(`🏚️ **${business.name}** has been closed. You received a **${formatMoney(refund)}** refund + **${formatMoney(business.vault)}** from the vault.`);
    }
  },
};