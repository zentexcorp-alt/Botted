const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getOrCreateUser, formatMoney, randInt } = require('../../utils/helpers');
const Transaction = require('../../models/Transaction');
const { checkLevelUp } = require('../../utils/jobs');

async function recordCasino(user, win, amount) {
  if (win) {
    user.casinoWins++;
    user.casinoTotalWon += amount;
    user.casinoBalance += amount;
    user.xp += 15;
  } else {
    user.casinoLosses++;
    user.casinoTotalLost += amount;
    user.casinoBalance -= amount;
    user.xp += 5;
  }
  await checkLevelUp(user);
  await user.save();
  await Transaction.create({
    userId: user.userId,
    type: win ? 'casino_win' : 'casino_loss',
    total: amount,
    balanceAfter: user.casinoBalance,
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('casino')
    .setDescription('Casino games')
    .addSubcommand((sub) =>
      sub
        .setName('slots')
        .setDescription('Spin the slot machine')
        .addNumberOption((o) => o.setName('bet').setDescription('Bet amount').setRequired(true).setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub
        .setName('coinflip')
        .setDescription('Flip a coin')
        .addNumberOption((o) => o.setName('bet').setDescription('Bet amount').setRequired(true).setMinValue(1))
        .addStringOption((o) =>
          o.setName('side').setDescription('Heads or Tails').setRequired(true).addChoices(
            { name: 'Heads', value: 'heads' },
            { name: 'Tails', value: 'tails' }
          )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('blackjack')
        .setDescription('Play blackjack (simplified)')
        .addNumberOption((o) => o.setName('bet').setDescription('Bet amount').setRequired(true).setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub
        .setName('dice')
        .setDescription('Roll a dice (1-6)')
        .addNumberOption((o) => o.setName('bet').setDescription('Bet amount').setRequired(true).setMinValue(1))
        .addIntegerOption((o) =>
          o.setName('guess').setDescription('Your guess (1-6)').setRequired(true).setMinValue(1).setMaxValue(6)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const user = await getOrCreateUser(interaction.user.id, interaction.user.username);
    const bet = interaction.options.getNumber('bet');

    if (user.casinoBalance < bet) {
      return interaction.reply({
        content: `❌ Insufficient casino balance. You have **${formatMoney(user.casinoBalance)}**. Use \`/transfer\` to add funds.`,
        ephemeral: true,
      });
    }

    // ─── SLOTS ───────────────────────────────────────────────────────────────
    if (sub === 'slots') {
      const SYMBOLS = ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣'];
      const WEIGHTS = [30, 25, 20, 15, 7, 3]; // probability weights

      function spin() {
        const total = WEIGHTS.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        for (let i = 0; i < SYMBOLS.length; i++) {
          r -= WEIGHTS[i];
          if (r <= 0) return SYMBOLS[i];
        }
        return SYMBOLS[0];
      }

      const reels = [spin(), spin(), spin()];
      const display = reels.join(' | ');

      let win = false;
      let multiplier = 0;
      let message = '';

      if (reels[0] === reels[1] && reels[1] === reels[2]) {
        // Three of a kind
        if (reels[0] === '7️⃣') { multiplier = 20; message = '🎉 JACKPOT! Triple 7s!'; }
        else if (reels[0] === '💎') { multiplier = 10; message = '💎 Triple Diamonds!'; }
        else if (reels[0] === '⭐') { multiplier = 7; message = '⭐ Triple Stars!'; }
        else if (reels[0] === '🔔') { multiplier = 5; message = '🔔 Triple Bells!'; }
        else { multiplier = 3; message = '🎰 Three of a Kind!'; }
        win = true;
      } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
        multiplier = 1.5;
        win = true;
        message = '🎯 Two of a Kind!';
      } else {
        message = '😢 No match. Try again!';
      }

      const payout = win ? Math.floor(bet * multiplier) : 0;
      const net = win ? payout - bet : -bet;
      await recordCasino(user, win, win ? payout - bet : bet);

      const embed = new EmbedBuilder()
        .setColor(win ? 0x00ff88 : 0xff4545)
        .setTitle('🎰 Slot Machine')
        .setDescription(`\`\`\`\n[ ${display} ]\n\`\`\`\n${message}`)
        .addFields(
          { name: 'Bet', value: formatMoney(bet), inline: true },
          { name: win ? 'Won' : 'Lost', value: formatMoney(Math.abs(net)), inline: true },
          { name: 'Casino Balance', value: formatMoney(user.casinoBalance), inline: true }
        );

      return interaction.reply({ embeds: [embed] });
    }

    // ─── COINFLIP ─────────────────────────────────────────────────────────────
    if (sub === 'coinflip') {
      const guess = interaction.options.getString('side');
      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      const win = guess === result;
      const emoji = result === 'heads' ? '👑' : '🪙';

      await recordCasino(user, win, bet);

      const embed = new EmbedBuilder()
        .setColor(win ? 0x00ff88 : 0xff4545)
        .setTitle(`${emoji} Coin Flip`)
        .addFields(
          { name: 'Your Guess', value: guess.charAt(0).toUpperCase() + guess.slice(1), inline: true },
          { name: 'Result', value: result.charAt(0).toUpperCase() + result.slice(1), inline: true },
          { name: win ? '✅ Won' : '❌ Lost', value: formatMoney(bet), inline: true },
          { name: 'Casino Balance', value: formatMoney(user.casinoBalance), inline: false }
        );

      return interaction.reply({ embeds: [embed] });
    }

    // ─── BLACKJACK ───────────────────────────────────────────────────────────
    if (sub === 'blackjack') {
      function card() { return randInt(1, 11); }
      function hand() { return [card(), card()]; }
      function total(cards) { return cards.reduce((a, b) => a + b, 0); }

      const playerHand = hand();
      const dealerHand = hand();

      // Dealer hits until ≥ 17
      while (total(dealerHand) < 17) dealerHand.push(card());

      const pTotal = total(playerHand);
      const dTotal = total(dealerHand);

      let win = false;
      let push = false;
      let resultMsg = '';

      if (pTotal > 21) { resultMsg = '💥 You busted!'; }
      else if (dTotal > 21) { win = true; resultMsg = '🎉 Dealer busted! You win!'; }
      else if (pTotal > dTotal) { win = true; resultMsg = '🏆 You win!'; }
      else if (pTotal === dTotal) { push = true; resultMsg = '🤝 Push! Tie game.'; }
      else { resultMsg = '😞 Dealer wins.'; }

      if (!push) await recordCasino(user, win, bet);

      const embed = new EmbedBuilder()
        .setColor(win ? 0x00ff88 : push ? 0xffd700 : 0xff4545)
        .setTitle('🃏 Blackjack')
        .addFields(
          { name: `Your Hand (${pTotal})`, value: playerHand.join(' + '), inline: true },
          { name: `Dealer Hand (${dTotal})`, value: dealerHand.join(' + '), inline: true },
          { name: 'Result', value: resultMsg, inline: false },
          { name: push ? 'Returned' : win ? 'Won' : 'Lost', value: formatMoney(bet), inline: true },
          { name: 'Casino Balance', value: formatMoney(user.casinoBalance), inline: true }
        );

      return interaction.reply({ embeds: [embed] });
    }

    // ─── DICE ─────────────────────────────────────────────────────────────────
    if (sub === 'dice') {
      const guess = interaction.options.getInteger('guess');
      const roll = randInt(1, 6);
      const win = guess === roll;

      await recordCasino(user, win, win ? bet * 5 - bet : bet);

      const embed = new EmbedBuilder()
        .setColor(win ? 0x00ff88 : 0xff4545)
        .setTitle('🎲 Dice Roll')
        .addFields(
          { name: 'Your Guess', value: `${guess}`, inline: true },
          { name: 'Rolled', value: `${roll}`, inline: true },
          { name: win ? '✅ Won (5x!)' : '❌ Lost', value: formatMoney(win ? bet * 5 : bet), inline: true },
          { name: 'Casino Balance', value: formatMoney(user.casinoBalance), inline: false }
        );

      return interaction.reply({ embeds: [embed] });
    }
  },
};
