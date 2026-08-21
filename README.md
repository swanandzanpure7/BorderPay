# BorderPay

**Global freelance payments with milestone-based escrow on Stellar**

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://borderpay-azure.vercel.app)
[![Stellar Testnet](https://img.shields.io/badge/network-testnet-blue)](https://stellar.org)

---

## Overview

### The Problem

Cross-border freelance payments are broken. Wire transfers take days and cost $30+. Clients default after work is delivered. Freelancers disappear after receiving upfront payment. There's no enforceable contract between strangers who have never met.

### The Solution

BorderPay puts payment in a tamper-proof Soroban smart contract (escrow) on the Stellar network. The flow:

1. Client creates a job with N milestones (amount + description each)
2. Client deposits stablecoin (USDC) into the escrow — funds are now locked
3. Freelancer completes work → marks milestone as "submitted"
4. Client reviews → approves → contract instantly releases that milestone's funds
5. Rejected/disputed milestones stay locked until resolved; client can refund unreleased escrow

No banks. No delays. No trust required between strangers.

### Why Stellar?

- **5-second finality** — payments settle in seconds, not days
- **Sub-cent fees** — Stellar transaction fees are fractions of a cent
- **Native stablecoin support** — USDC runs natively on Stellar via the Stellar Asset Contract
- **Soroban smart contracts** — programmable escrow logic with full on-chain state

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser / Client                          │
│  Next.js 15 App Router · React Query · Tailwind CSS             │
│  useWallet() ── Freighter Extension ── @stellar/freighter-api   │
└────────────────────────────┬────────────────────────────────────┘
                             │ signed XDR transactions
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    @stellar/stellar-sdk                          │
│           lib/stellar.ts (single integration layer)             │
│   build tx → simulate → sign → submit → poll confirmation       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Stellar Testnet RPC Node                        │
│            soroban-testnet.stellar.org                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Soroban Escrow Contract (Rust)                      │
│   contracts/escrow/src/lib.rs                                   │
│   Jobs · Milestones · Auth · Token transfers · Events           │
└─────────────────────────────────────────────────────────────────┘

Off-chain (for metadata only):
┌─────────────────────────────────────────────────────────────────┐
│        Next.js API Routes  ←→  Prisma  ←→  Postgres (Supabase)  │
│   /api/jobs · /api/feedback · /api/status · /api/users          │
│   Job titles/descriptions · Feedback ratings · Tx history       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| Wallet | Freighter via `@stellar/freighter-api` |
| Stellar SDK | `@stellar/stellar-sdk` v12 |
| State | Zustand (wallet), React Query (server state) |
| Smart Contract | Soroban (Rust), `soroban-sdk` v22 |
| Database | Postgres via Supabase, Prisma ORM |
| Monitoring | Sentry (errors), PostHog (analytics) |
| Deployment | Vercel (frontend), Stellar Testnet (contract) |

---

## Setup

### Prerequisites

- Node.js 18+
- Rust + `wasm32-unknown-unknown` target
- Stellar CLI 26+
- Freighter wallet browser extension

### Clone & Install

```bash
git clone https://github.com/your-org/borderpay
cd borderpay
npm install
```

### Environment Variables

```bash
cp .env.local.example .env.local
# Fill in values — see .env.local.example for all keys
```

### Run Locally

```bash
npm run dev
```

### Run Contract Tests

```bash
cd contracts
cargo test
```

### Build & Deploy Contract

```bash
rustup target add wasm32-unknown-unknown
cd contracts
stellar contract build
stellar keys generate borderpay-deployer --network testnet
stellar keys fund borderpay-deployer --network testnet
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/borderpay_escrow.wasm \
  --source borderpay-deployer \
  --network testnet
```

### Database Setup

```bash
npx prisma migrate dev
```

### Deploy to Vercel

```bash
npx vercel --prod
```

---

## Contract Deployment (Testnet)

| | |
|---|---|
| **Contract ID** | `CBUBO5S57IZTIWU4BQXGJP2VAUD7CK7N5EXWFZQGKGMFZENL2F5Z4DTT` |
| **USDC Token SAC** | `CDRIM3DJHXSGQSFCUDNYZZWMQKUSJYBACQTI5IZ275SPNTG5T7OYFWAL` |
| **Network** | Stellar Testnet |
| **Explorer** | [View Contract](https://stellar.expert/explorer/testnet/contract/CBUBO5S57IZTIWU4BQXGJP2VAUD7CK7N5EXWFZQGKGMFZENL2F5Z4DTT) |

---

## Live Demo

🌐 **[borderpay-azure.vercel.app](https://borderpay-azure.vercel.app)**

---

## Proof of User Interactions

All transactions on Stellar Testnet — verifiable on [stellar.expert](https://stellar.expert/explorer/testnet).

**Contract:** `CBUBO5S57IZTIWU4BQXGJP2VAUD7CK7N5EXWFZQGKGMFZENL2F5Z4DTT`

### User 1 — Mayur Vanve · [Job #46](https://borderpay-azure.vercel.app/jobs/46)

**Wallet:** `GDNLHD6F7J57DT56UOADY4O7Q6T7QHU4NMEJ7JRXXYXKVSFS44IPTF4T`

| # | Action | Tx Hash | Explorer |
|---|--------|---------|----------|
| 1 | `create_job` | `96e4ef2f...e3ed8` | [↗](https://stellar.expert/explorer/testnet/tx/96e4ef2f889821a0d7eabc8b3d189391a2f23c5111c4b0d8e1819fda7a6e3ed8) |
| 2 | `submit_milestone` | `3bf598338...98e4` | [↗](https://stellar.expert/explorer/testnet/tx/bf598338cae1c893c32f029cfcabd526561ace9768cc4195a52a421c5c5198e4) |
| 3 | `approve_milestone` | `c598fdb7...43a1` | [↗](https://stellar.expert/explorer/testnet/tx/c598fdb72cc364e21e3c36b4ee5aecfcfb48b0ab8e0d54a193db7cfe27d143a1) |

### User 2 — Sneha Bhambare · [Job #47](https://borderpay-azure.vercel.app/jobs/47)

**Wallet:** `GDG4K3RXV5RGEIJ4FKK3GU3CPVQLZZVZOCKREXEKSWTP4LQTAKQDSPFM`

| # | Action | Tx Hash | Explorer |
|---|--------|---------|----------|
| 1 | `create_job` | `604499bd...1223` | [↗](https://stellar.expert/explorer/testnet/tx/604499bd0d32bc9ab920a1e94f55c5d601743fe658dfc00295539b5d36741223) |
| 2 | `submit_milestone` | `0bd64ab1...7483` | [↗](https://stellar.expert/explorer/testnet/tx/0bd64ab1957cdfec419f15fdc46309041c9f2ca9d058ed9a6dc5efd06b227483) |
| 3 | `approve_milestone` | `d2c94f3b...a697` | [↗](https://stellar.expert/explorer/testnet/tx/d2c94f3b1ade957509247e0539d218a336869df43609e29db564a6a2dc27a697) |

### User 3 — Sahil Zanpure · [Job #48](https://borderpay-azure.vercel.app/jobs/48)

**Wallet:** `GDLKFNG44HQ7EOFWWPTUE3DJJT56FWALJUBBKUNBEMGGYO43DIEXZI5E`

| # | Action | Tx Hash | Explorer |
|---|--------|---------|----------|
| 1 | `create_job` | `b6328884...af75` | [↗](https://stellar.expert/explorer/testnet/tx/b632888434bbbe965aad60bdfb85e768936deca3ab99095ba377b330baeeaf75) |
| 2 | `submit_milestone` | `35edcaa8...8684` | [↗](https://stellar.expert/explorer/testnet/tx/35edcaa8d493e88cc7d95b326037e1214281a85c8ed1e1d3101fd5f0211c8684) |
| 3 | `approve_milestone` | `3b58c26a...ee15` | [↗](https://stellar.expert/explorer/testnet/tx/3b58c26afa9178e2dc478a6cf228ed239d0007c7b1cc692c42e47fa70a18ee15) |

### User 4 — Sarthak Jamadar · [Job #45](https://borderpay-azure.vercel.app/jobs/45)

**Wallet:** `GDMLXC46ZIHDDCOGYRPSGXAAGFQXKDIYX3JGOQR54LEQNOKL3CZ4ZZ2B`

| # | Action | Tx Hash | Explorer |
|---|--------|---------|----------|
| 1 | `create_job` | `10bac092...14af` | [↗](https://stellar.expert/explorer/testnet/tx/10bac09266c90647aeda0cfbc2bb0934cda1a3a4e6a7593fdde77f0a382e14af) |
| 2 | `submit_milestone` | `7e772724...9a73` | [↗](https://stellar.expert/explorer/testnet/tx/7e7727242eaef0f1116d742295dfd9e0ff8f841b0264cae6298933ccd44f9a73) |
| 3 | `approve_milestone` | `be31c244...1343` | [↗](https://stellar.expert/explorer/testnet/tx/be31c24438165c2252b398ddae5b6e232b3c43e0bd4dad46b78caf5471e11343) |

### User 5 — Sakib Inamdar · [Job #49](https://borderpay-azure.vercel.app/jobs/49)

**Wallet:** `GC7PLHEA4232X6DOOXZUZT3BP6LSTQI7AEMHTIQS47K6AWRPBZJK2C2M`

| # | Action | Tx Hash | Explorer |
|---|--------|---------|----------|
| 1 | `create_job` | `235e1270...f6c0` | [↗](https://stellar.expert/explorer/testnet/tx/235e127002cc7eaa671d4437b32c74762b4e08726cfa07c8f871a7bc4db8f6c0) |
| 2 | `submit_milestone` | `80be3477...9e8e` | [↗](https://stellar.expert/explorer/testnet/tx/80be3477cefd90264dce54029dde83f8d137ae4f907513e269c2a3cd14d79e8e) |
| 3 | `approve_milestone` | `cacb2332...35e5` | [↗](https://stellar.expert/explorer/testnet/tx/cacb23321864aeda54cea268dc556406b864f4c5a5a7893f6b6aaa322ac735e5) |

### User 6 — Om Ozharkar · [Job #50](https://borderpay-azure.vercel.app/jobs/50)

**Wallet:** `GBCWPSZ3WMH4LTC5P22H3VUZ6NPWC52PAF676BDEC4VCSGEIKQ4EOQKB`

| # | Action | Tx Hash | Explorer |
|---|--------|---------|----------|
| 1 | `create_job` | `ab2cb8ef...5e65` | [↗](https://stellar.expert/explorer/testnet/tx/ab2cb8efb400d7cefb40a88b28798916a7468c250e2175ef2a0188fbbe065e65) |
| 2 | `submit_milestone` | `985921ed...c1f` | [↗](https://stellar.expert/explorer/testnet/tx/985921ed3a15cdf7966d726664ebbafe1c5068fe7badd27a52516891f2c4bc1f) |
| 3 | `approve_milestone` | `0071f811...4d73` | [↗](https://stellar.expert/explorer/testnet/tx/0071f811eeabf88b71251afc32cc0f579f93d31a528ae1fd35cc43cf01524d73) |

---

## Known Limitations & Future Work

- **Wallet support**: Freighter only. Albedo/xBull via Stellar Wallets Kit is future work.
- **Dispute resolution**: Currently disputes lock funds indefinitely. A timelock + arbiter flow is planned.
- **Factory pattern**: Single contract for all jobs. High-volume mainnet deployment would benefit from per-job contracts.
- **Notifications**: No email/push notifications when milestone status changes.
- **File attachments**: Milestone deliverables are text-only; IPFS integration is future work.
