# BorderPay — Architecture & Decision Log

## Decision 1: Single escrow contract (not factory pattern)

**Decision:** One contract managing all jobs via an on-chain `Job` map keyed by `u64` ID.

**Rationale:** Per-contract deployment on Stellar Testnet costs extra in storage fees. A single auditable contract is also simpler to reason about. Factory pattern is noted as future work for mainnet at high volume.

---

## Decision 2: Stroops for all on-chain amounts

**Decision:** All amounts are `i128` in stroops (10,000,000 stroops = 1 USDC). UI converts with `stroopsToUsdc()` / `usdcToStroops()`.

---

## Decision 3: soroban-sdk version pinned to 25.x

**Decision:** Used `soroban-sdk = "25"` — the version the Stellar CLI 26 templates ship with.

**Background:** SDK versions 20–22 had a transitive `ed25519-dalek v3` incompatibility in testutils that broke `ChaCha20Rng: CryptoRng`. SDK 25 (shipped with Stellar CLI 26) resolves this entirely.

---

## Decision 4: Off-chain metadata via Next.js API routes + Prisma

**Decision:** Job titles/descriptions in Postgres (Supabase). On-chain milestones store short descriptions (≤200 chars). Off-chain sync happens after on-chain creation via `POST /api/jobs`.

---

## Decision 5: Feedback stored entirely off-chain

**Decision:** Ratings + comments go to Postgres only. `/api/feedback` provides aggregate stats for the `/status` page. No on-chain cost, allows editing.

---

## Decision 6: Freighter as primary wallet (Freighter-only MVP)

**Decision:** Freighter-only for MVP using `@stellar/freighter-api` v6. Stellar Wallets Kit (Albedo, xBull) noted as future work.

---

## Decision 7: Next.js 15 over 14

**Decision:** Upgraded from Next.js 14 to 15 to ensure SWC native binary compatibility with Node.js 24 on Windows x64.

---

## Decision 8: WatchWalletChanges instantiated as class (not static)

**Decision:** `WatchWalletChanges` in freighter-api v6 is a class — instantiate with `new WatchWalletChanges(3000)`, call `.watch(cb)`, stop with `.stop()`.
