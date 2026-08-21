# BorderPay — Architecture & Decision Log

## Decision 1: Single escrow contract (not factory pattern)

**Decision:** One contract managing all jobs via an on-chain `Job` map keyed by `u64` ID.

**Rationale:** Simpler deployment, lower gas overhead for testnet. Factory pattern would require deploying a new contract per job — unnecessary complexity for MVP.

---

## Decision 2: Source-account auth instead of signAuthEntry

**Decision:** Rewrite Soroban auth entries from `sorobanCredentialsAddress` to `sorobanCredentialsSourceAccount` before passing XDR to Freighter.

**Rationale:** Freighter's transaction display crashes with "Bad union switch: 4" when auth entries contain `SCV_LEDGER_KEY_CONTRACT_INSTANCE` footprint data. Source-account credentials are validated by the transaction signature — no separate auth signing needed.

---

## Decision 3: Off-chain metadata DB (Supabase + Prisma)

**Decision:** Store job titles, tx hashes, and feedback in Postgres, not on-chain.

**Rationale:** On-chain storage is expensive and unnecessary for non-financial metadata. The contract stores only the financial state (amounts, milestones, addresses). Everything else lives off-chain with the contract as the source of truth for financial data.

---

## Decision 4: Custom USDC token SAC for testnet

**Decision:** Deploy a custom USDC-like SAC token (`CDRIM3...`) instead of using Circle's testnet USDC.

**Rationale:** Circle's testnet USDC issuer key is not accessible, so we can't programmatically fund users. A custom SAC gives full control for the in-app faucet (`/profile` → "Get Test USDC").

---

## Decision 5: Zustand for wallet state (not React Context)

**Decision:** Use Zustand store for all wallet state shared across components.

**Rationale:** React Context causes re-renders in every consumer on every update. Zustand is subscription-based — components only re-render when their specific slice changes. Eliminates the "wallet flickering" issue caused by multiple components each running their own async Freighter check.
