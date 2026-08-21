# BorderPay — Deployment Guide

## Prerequisites

- Rust + `wasm32v1-none` target: `rustup target add wasm32v1-none`
- Stellar CLI 26+: `cargo install --locked stellar-cli --features opt`
- Node 18+ and npm
- Postgres (Supabase recommended)

---

## 1. Build the Soroban Contract

```bash
cd contracts
stellar contract build
# Output: contracts/target/wasm32v1-none/release/escrow.wasm
```

---

## 2. Deploy to Testnet

```bash
# Generate and fund a deployer key (one-time)
stellar keys generate deployer --network testnet
stellar keys fund deployer --network testnet

# Deploy
stellar contract deploy \
  --wasm contracts/target/wasm32v1-none/release/escrow.wasm \
  --source deployer \
  --network testnet
```

Copy the output contract ID (starts with `C...`) and add to `.env.local`:

```
NEXT_PUBLIC_ESCROW_CONTRACT_ID=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

## 3. Get USDC Token Address (Testnet SAC)

```bash
stellar contract id asset \
  --asset USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 \
  --network testnet
```

Add the result to `.env.local`:

```
NEXT_PUBLIC_USDC_TOKEN_ID=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

## 4. Database (Supabase)

1. Create a project at [supabase.com](https://supabase.com)
2. Copy the **Direct connection** string from Project Settings → Database
3. Add to `.env.local` as `DATABASE_URL`
4. Run migrations:

```bash
npx prisma migrate deploy
```

---

## 5. Deploy Frontend to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Set these environment variables in your Vercel project dashboard:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_ESCROW_CONTRACT_ID` | Your deployed contract ID |
| `NEXT_PUBLIC_USDC_TOKEN_ID` | USDC SAC address on testnet |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` |
| `DATABASE_URL` | Supabase connection string |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN (optional) |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog key (optional) |

---

## Contract Deployment Record

| Field | Value |
|---|---|
| **Contract ID** | `CBUBO5S57IZTIWU4BQXGJP2VAUD7CK7N5EXWFZQGKGMFZENL2F5Z4DTT` |
| **USDC Token** | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAM` |
| **Deploy Tx** | [635cb5976e8d...](https://stellar.expert/explorer/testnet/tx/635cb5976e8d2ea4b9ab9024d02aeb9ccc875d9698df359a840f8cc08a910bfb) |
| **Deployed by** | `deployer` keypair |
| **SDK version** | soroban-sdk 25.3.2 |
| **Explorer** | https://stellar.expert/explorer/testnet |

---

## Run Contract Tests

```bash
cd contracts
cargo test
```

Expected: 7 tests pass — happy path, unauthorized submit, double-release rejection, refund path, insufficient funding, dispute, list jobs.
