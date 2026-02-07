# Arcis Wheel 🎡

A provably fair encrypted wheel game built and powered by **Arcium MPC** on Solana.

## 🎯 Overview

Arcis Wheel is a decentralized wheel of fortune game that uses **Arcium's Multi-Party Computation (MPC)** to generate cryptographically secure, provably fair random results. All computations are performed off-chain in Arcium's MXE (MPC Execution Environment), ensuring complete privacy and fairness.

## ✨ Features

- 🎲 **Provably Fair Randomness** - Powered by Arcium MPC for cryptographically secure results
- 🔐 **Private Computation** - All spin logic runs in encrypted MPC environment
- 💰 **Credit System** - Daily spin limits and weekly credit resets
- 🏆 **Leaderboard** - Track top players and compete for rankings
- 🔗 **On-Chain Verification** - All results are verifiable on Solana blockchain
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile

## 🎮 How It Works

1. **Connect Wallet** - Use Phantom or any Solana wallet
2. **Spin the Wheel** - Submit an encrypted computation request
3. **MPC Processing** - Arcium MXE computes the random result privately
4. **On-Chain Result** - The encrypted result is written to Solana
5. **Decrypt & Display** - Client decrypts and shows your result

## 🛠️ Tech Stack

- **Frontend:** Next.js 14, React 18, TypeScript
- **Blockchain:** Solana (Devnet)
- **MPC:** Arcium v0.8.0
- **Wallet:** Solana Wallet Adapter
- **Styling:** Tailwind CSS

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- A Solana wallet (Phantom recommended)
- SOL on Devnet (for transaction fees)

## 🚀 Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/TOBY/arcis-wheel.git
cd arcis-wheel

# Install dependencies
npm install
```

### Development

```bash
# Run development server
npm run dev

# Open http://localhost:3000
```

### Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## 🎯 Game Rules

- **Daily Spin Limit:** 5 spins per day
- **Weekly Reset:** All credits reset every Saturday at 12:00 AM UTC
- **Wheel Segments:** 8 segments with various multipliers and percentages
  - `2x`, `3x` - Multiply credits
  - `0.5x` - Add 50% of current credits
  - `-0.6x` - Deduct 60% of current credits
  - `30%` - Add 30% of current credits
  - `-20%`, `-50%`, `-80%` - Deduct percentage of credits

## 🔧 Configuration

The Solana program is deployed on Devnet:

- **Program ID:** `BvRkheZC465X6PhhkHrkuUo1o7mHWF1d1tJm3kzts92o`
- **Arcium Program ID:** `Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ`
- **Cluster:** Devnet
- **RPC:** Configured in `src/lib/program.ts`

## 📁 Project Structure

```
├── src/
│   ├── components/     # React components
│   ├── contexts/       # React contexts
│   ├── game.ts         # Main game logic
│   ├── idl/            # Solana program IDL
│   ├── lib/            # Program configuration
│   ├── pages/          # Next.js pages
│   ├── styles/         # Global styles
│   └── utils/          # Utility functions (Arcium client)
├── public/             # Static assets
└── package.json
```

## 🔐 Security & Privacy

- All user inputs are encrypted locally before submission
- Random number generation happens in Arcium's secure MPC environment
- No mock data or client-side randomness
- All results are verifiable on-chain

## 🌐 Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Import project in Vercel dashboard
3. Connect GitHub repository
4. Deploy automatically on every push

Or use Vercel CLI:

```bash
npm install -g vercel
vercel
```

## 📝 License

This project is private and proprietary.

## 🙏 Acknowledgments

- Built with [Arcium](https://arcium.com/) MPC technology
- Solana blockchain infrastructure
- Next.js framework

## 📧 Contact

For questions or issues, please open an issue on GitHub.

---

**Built with ❤️ using Arcium MPC on Solana**
