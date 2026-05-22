# 🤖 Discord Economy & Trading Bot

A full-featured Discord economy and trading game bot with crypto, stocks, casino, leveling, jobs, and realistic market simulation.

---

## 📋 Features

### 💰 Accounts
- **Wallet** — liquid cash for everyday use
- **Bank** — interest-bearing account
- **Crypto Account** — fund for crypto trading
- **Stock Account** — fund for stock trading
- **Casino Account** — fund for gambling

### 📈 Trading
- **Crypto Market** — buy/sell crypto with real supply/demand price movement
- **Stock Market** — buy/sell stocks with sector-based pricing
- **Price Algorithm** — Brownian motion + buy/sell pressure + mean reversion + trend + admin influence
- **Charts** — Candlestick & Mountain charts with price history

### 🎮 Game Systems
- **Leveling System** — earn XP from work, trades, casino, daily
- **Job System** — 5 tiers of jobs, unlock better jobs as you level up
- **Work Streaks** — bonus XP for consistent work
- **Daily Rewards** — scale with level

### 🎰 Casino
- **Slots** — weighted symbols, up to 20x jackpot
- **Coinflip** — 50/50 chance, 2x payout
- **Blackjack** — play against the dealer
- **Dice** — guess the roll for 5x payout

### 🏆 Leaderboards
- Net Worth, Level, Casino Wins

### 🛡️ Admin Commands
- Add/edit/delete stocks and crypto
- Set price, volatility, trend, admin price target
- Inject custom candlestick data
- Add/remove money from any user account
- Set user level, reset accounts

---

## 🚀 Setup

### 1. Prerequisites
- Node.js v18+
- MongoDB Atlas account (free) or local MongoDB

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
```bash
cp .env.example .env
```
Edit `.env`:
```
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_client_id
GUILD_ID=your_discord_server_id
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/economybot
```

**Getting credentials:**
- `DISCORD_TOKEN` → [Discord Developer Portal](https://discord.com/developers/applications) → Your App → Bot → Token
- `CLIENT_ID` → Developer Portal → Your App → General Information → Application ID
- `GUILD_ID` → Right-click your server in Discord → Copy Server ID (enable Developer Mode in settings)
- `MONGODB_URI` → [MongoDB Atlas](https://cloud.mongodb.com) → Create free cluster → Connect → Drivers

### 4. Invite Bot to Server
In the Developer Portal:
- OAuth2 → URL Generator
- Scopes: `bot`, `applications.commands`
- Bot Permissions: `Send Messages`, `Embed Links`, `Attach Files`, `Read Message History`

### 5. Register Slash Commands
```bash
npm run deploy
```

### 6. Seed Default Assets
```bash
node seed.js
```

### 7. Start the Bot
```bash
npm start
# or for development with auto-restart:
npm run dev
```

---

## 📜 Commands

### Economy
| Command | Description |
|---------|-------------|
| `/balance` | View all account balances |
| `/transfer <from> <to> <amount>` | Move funds between accounts |
| `/daily` | Claim daily reward |
| `/work do` | Do your job and earn money |
| `/work jobs` | Browse available jobs |
| `/work join <id>` | Join a job |
| `/work quit` | Quit your job |

### Trading
| Command | Description |
|---------|-------------|
| `/crypto list` | List all cryptocurrencies |
| `/crypto price <symbol>` | Check crypto price |
| `/crypto buy <symbol> <amount>` | Buy crypto |
| `/crypto sell <symbol> <qty>` | Sell crypto |
| `/crypto portfolio` | View your crypto portfolio |
| `/stocks list` | List all stocks |
| `/stocks price <symbol>` | Check stock price |
| `/stocks buy <symbol> <amount>` | Buy shares |
| `/stocks sell <symbol> <shares>` | Sell shares |
| `/stocks portfolio` | View your stock portfolio |
| `/chart <symbol> [candle\|mountain]` | View price chart |

### Casino
| Command | Description |
|---------|-------------|
| `/casino slots <bet>` | Spin the slots |
| `/casino coinflip <bet> <heads\|tails>` | Flip a coin |
| `/casino blackjack <bet>` | Play blackjack |
| `/casino dice <bet> <guess>` | Roll dice |

### Info
| Command | Description |
|---------|-------------|
| `/profile [user]` | Full financial profile with holdings |
| `/leaderboard [type]` | Net worth / level / casino leaderboard |

### Admin (Administrator only)
| Command | Description |
|---------|-------------|
| `/admin asset add` | Add new crypto or stock |
| `/admin asset edit` | Edit price, volatility, trend, target |
| `/admin asset addcandle` | Inject custom candlestick data |
| `/admin asset list` | List all assets |
| `/admin asset delete` | Delete an asset |
| `/admin user addmoney` | Add/remove money from any account |
| `/admin user setlevel` | Set a user's level |
| `/admin user reset` | Reset a user's account |

---

## 📊 Price Algorithm

Prices move every 60 seconds based on:

1. **Random Walk** — Brownian motion scaled by asset volatility
2. **Supply/Demand** — Actual buy/sell volume affects price direction
3. **Trend Momentum** — Uptrends continue upward, downtrends continue downward
4. **Mean Reversion** — Prices gradually pull back toward fair value
5. **Admin Target** — Optionally set a price target with influence strength (0–1)

Admins can:
- Set `volatility` to control how wild prices move
- Set `trend` (-1 to 1) to push the market in a direction
- Set `adminPriceTarget` + `adminInfluence` to guide a price toward a target

---

## 🧩 Job Tiers

| Job | Level Range | Pay Range | Cooldown |
|-----|-------------|-----------|----------|
| 🧤 Street Beggar | 1–4 | $50–150 | 30 min |
| 🛵 Delivery Driver | 3–9 | $200–500 | 25 min |
| 💻 Freelance Programmer | 5–14 | $500–1,200 | 20 min |
| 📈 Market Analyst | 10–19 | $1,000–3,000 | 15 min |
| 🏢 Tech CEO | 20+ | $5,000–15,000 | 10 min |

---

## 🗂 Project Structure

```
discord-economy-bot/
├── index.js              # Entry point
├── deploy-commands.js    # Register slash commands
├── seed.js               # Add default assets
├── .env.example
├── commands/
│   ├── economy/          # balance, transfer, daily, work
│   ├── game/             # crypto, stocks, casino, chart
│   ├── info/             # profile, leaderboard
│   └── admin/            # admin
├── models/
│   ├── User.js           # User schema
│   ├── Asset.js          # Asset (stock/crypto) schema
│   └── Transaction.js    # Transaction log schema
├── utils/
│   ├── helpers.js        # Shared utilities
│   ├── jobs.js           # Job definitions and XP logic
│   ├── marketEngine.js   # Price simulation algorithm
│   └── chartGenerator.js # Candlestick/mountain chart generation
└── events/
    ├── ready.js
    └── interactionCreate.js
```
