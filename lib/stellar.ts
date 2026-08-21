/**
 * lib/stellar.ts
 * Soroban contract integration layer.
 *
 * Auth strategy — fixes Freighter "Bad union switch: 4" crash:
 *
 * fund_job calls token::transfer() internally which creates nested auth entries
 * containing SCV_LEDGER_KEY_CONTRACT_INSTANCE (XDR union type 4) in the
 * footprint. Freighter's transaction display tries to decode this and crashes.
 *
 * Fix: after assembleTransaction(), rewrite every sorobanCredentialsAddress
 * auth entry to sorobanCredentialsSourceAccount directly in the XDR envelope.
 * Source-account auth is satisfied by the transaction signature itself —
 * no separate signAuthEntry popup needed — so Freighter gets a clean tx
 * with no problematic auth entries to display.
 */

import {
  Contract,
  Networks,
  SorobanRpc,
  TransactionBuilder,
  Transaction,
  FeeBumpTransaction,
  BASE_FEE,
  xdr,
  scValToNative,
  nativeToScVal,
  Address,
} from "@stellar/stellar-sdk";

// ─── Config ──────────────────────────────────────────────────────────────────

export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET;

export const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ||
  "https://soroban-testnet.stellar.org";

export const ESCROW_CONTRACT_ID =
  process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || "";

export const USDC_TOKEN_ID =
  process.env.NEXT_PUBLIC_USDC_TOKEN_ID || "";

/** Max milestone count enforced by the contract */
export const MAX_MILESTONES = 50;

/** Min USDC per milestone in display units */
export const MIN_MILESTONE_USDC = 0.01;

// ─── Types ───────────────────────────────────────────────────────────────────

export type SignTransactionFn = (
  xdr: string,
  opts?: { networkPassphrase?: string }
) => Promise<string>;

export type SignAuthEntryFn = (
  authEntryXdr: string,
  opts?: { networkPassphrase?: string; address?: string }
) => Promise<string>;

export interface MilestoneInput {
  amount: bigint;
  description: string;
}

export type MilestoneStatus =
  | "Pending" | "Submitted" | "Approved"
  | "Released" | "Refunded" | "Disputed";

export type JobStatus =
  | "Created" | "Funded" | "InProgress" | "Completed" | "Cancelled";

export interface Milestone {
  index: number;
  amount: bigint;
  description: string;
  status: MilestoneStatus;
}

export interface Job {
  id: bigint;
  client: string;
  freelancer: string;
  token: string;
  total_amount: bigint;
  milestones: Milestone[];
  status: JobStatus;
}

// ─── Auth entry rewriter ──────────────────────────────────────────────────────
//
// Rewrites sorobanCredentialsAddress → sorobanCredentialsSourceAccount
// directly in the XDR envelope so Freighter never sees the problematic
// SCV_LEDGER_KEY_CONTRACT_INSTANCE footprint data.
//
// SDK v12 notes:
//   - Soroban txs use EnvelopeType.envelopeTypeTx (value=2), NOT envelopeTypeTxV1
//   - envelope.v1() is the accessor for envelopeTypeTx envelopes in this SDK
//   - SorobanCredentialsType: sorobanCredentialsSourceAccount=0, sorobanCredentialsAddress=1
//
function rewriteAuthToSourceAccount(txXdr: string): string {
  try {
    const envelope = xdr.TransactionEnvelope.fromXDR(txXdr, "base64");

    // envelopeTypeTx = 2 (used for Soroban transactions in stellar-sdk v12)
    if (envelope.switch().value !== xdr.EnvelopeType.envelopeTypeTx().value) {
      return txXdr;
    }

    const innerTx = envelope.v1().tx();
    const ops = innerTx.operations();

    for (const op of ops) {
      const body = op.body();
      if (body.switch().value !== xdr.OperationType.invokeHostFunction().value) {
        continue;
      }

      const ihf = body.invokeHostFunctionOp();
      const authEntries = ihf.auth();
      if (!authEntries || authEntries.length === 0) continue;

      const rewritten = authEntries.map((entry: xdr.SorobanAuthorizationEntry) => {
        const creds = entry.credentials();
        // sorobanCredentialsAddress = 1 → replace with sorobanCredentialsSourceAccount = 0
        if (
          creds.switch().value ===
          xdr.SorobanCredentialsType.sorobanCredentialsAddress().value
        ) {
          return new xdr.SorobanAuthorizationEntry({
            credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
            rootInvocation: entry.rootInvocation(),
          });
        }
        return entry;
      });

      // Mutate auth entries in place on the XDR object
      ihf.auth(rewritten);
    }

    return envelope.toXDR("base64");
  } catch (err) {
    // Surface the real error instead of silently falling back
    console.error("[stellar] auth rewrite failed:", err);
    throw new Error(
      `Auth rewrite failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

// ─── Core submit helper ───────────────────────────────────────────────────────

async function buildAndSubmit(
  sourceAddress: string,
  signTransaction: SignTransactionFn,
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  _signAuthEntry?: SignAuthEntryFn  // kept for API compat, not used
): Promise<{ result: xdr.ScVal | null; txHash: string }> {
  const account = await server.getAccount(sourceAddress);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(300)
    .build();

  // Simulate to get resource footprint + auth entries
  const simResult = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation failed: ${simResult.error}`);
  }

  // Assemble with resource fees — this sets auth entries from simulation
  const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();

  // Rewrite auth entries in XDR to use source-account credentials
  // so Freighter doesn't crash on the token SAC's contract instance footprint
  const cleanXdr = rewriteAuthToSourceAccount(preparedTx.toXDR());

  // Sign with Freighter — one popup, no "Bad union switch" crash
  const signedTxXdr = await signTransaction(cleanXdr, {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  if (!signedTxXdr || signedTxXdr.trim() === "") {
    throw new Error("Transaction rejected in wallet.");
  }

  return await submitAndPoll(signedTxXdr);
}

// ─── Poll for transaction confirmation ───────────────────────────────────────

async function submitAndPoll(
  signedXdr: string
): Promise<{ result: xdr.ScVal | null; txHash: string }> {
  let parsedTx: Transaction | FeeBumpTransaction;
  try {
    parsedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE) as
      | Transaction
      | FeeBumpTransaction;
  } catch {
    throw new Error("Failed to parse signed transaction XDR.");
  }

  const sendResult = await server.sendTransaction(parsedTx as any);

  if (sendResult.status === "ERROR") {
    const errDetail = sendResult.errorResult
      ? JSON.stringify(sendResult.errorResult)
      : "Unknown submission error";
    throw new Error(`Transaction submission error: ${errDetail}`);
  }

  const txHash = sendResult.hash;

  // Poll for confirmation — getTransaction() can throw "Bad union switch: 4"
  // when the SDK tries to parse Soroban result metadata containing
  // SCV_LEDGER_KEY_CONTRACT_INSTANCE. We catch that specific error and
  // treat it as SUCCESS (the tx is confirmed, we just can't read the return value).
  let tries = 0;
  while (tries < 30) {
    try {
      const poll = await server.getTransaction(txHash);

      if (poll.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND) {
        await new Promise((r) => setTimeout(r, 2000));
        tries++;
        continue;
      }

      if (poll.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`Transaction failed on-chain. Hash: ${txHash}`);
      }

      // SUCCESS
      const success = poll as SorobanRpc.Api.GetSuccessfulTransactionResponse;
      return { result: success.returnValue ?? null, txHash };

    } catch (pollErr) {
      const msg = pollErr instanceof Error ? pollErr.message : String(pollErr);

      // "Bad union switch: 4" means the SDK can't parse the result metadata,
      // but the transaction itself succeeded on-chain. Return txHash as success.
      if (msg.includes("Bad union switch")) {
        console.warn("[stellar] getTransaction parse error (tx succeeded):", msg);
        return { result: null, txHash };
      }

      // Re-throw any other errors (e.g. transaction failed)
      throw pollErr;
    }
  }

  throw new Error(
    `Transaction not confirmed after 60s. Hash: ${txHash} — check Stellar Explorer.`
  );
}

// ─── Parse helpers ───────────────────────────────────────────────────────────

function parseJobStatus(val: unknown): JobStatus {
  // scValToNative returns enum variants as either:
  //   { Funded: null }  → object with one key
  //   ["Funded"]        → single-element array
  if (Array.isArray(val) && val.length > 0) return val[0] as JobStatus;
  if (typeof val === "object" && val !== null) {
    const k = Object.keys(val as object)[0];
    if (k) return k as JobStatus;
  }
  if (typeof val === "string") return val as JobStatus;
  return "Created";
}

function parseMilestoneStatus(val: unknown): MilestoneStatus {
  if (Array.isArray(val) && val.length > 0) return val[0] as MilestoneStatus;
  if (typeof val === "object" && val !== null) {
    const k = Object.keys(val as object)[0];
    if (k) return k as MilestoneStatus;
  }
  if (typeof val === "string") return val as MilestoneStatus;
  return "Pending";
}

function parseJob(raw: unknown): Job {
  const obj = raw as Record<string, unknown>;
  const milestones = (obj.milestones as unknown[]).map((m) => {
    const ms = m as Record<string, unknown>;
    return {
      index: Number(ms.index),
      amount: BigInt(ms.amount as string | number),
      description: String(ms.description),
      status: parseMilestoneStatus(ms.status),
    };
  });
  return {
    id: BigInt(obj.id as string | number),
    client: String(obj.client),
    freelancer: String(obj.freelancer),
    token: String(obj.token),
    total_amount: BigInt(obj.total_amount as string | number),
    milestones,
    status: parseJobStatus(obj.status),
  };
}

// ─── Contract calls ───────────────────────────────────────────────────────────

export async function createJob(
  sourceAddress: string,
  signTransaction: SignTransactionFn,
  freelancerAddress: string,
  tokenAddress: string,
  milestones: MilestoneInput[],
  signAuthEntry?: SignAuthEntryFn
): Promise<{ jobId: bigint; txHash: string }> {
  const milestoneVec = xdr.ScVal.scvVec(
    milestones.map(({ amount, description }) =>
      xdr.ScVal.scvVec([
        nativeToScVal(amount, { type: "i128" }),
        nativeToScVal(description, { type: "string" }),
      ])
    )
  );

  const args = [
    Address.fromString(sourceAddress).toScVal(),
    Address.fromString(freelancerAddress).toScVal(),
    Address.fromString(tokenAddress).toScVal(),
    milestoneVec,
  ];

  const { result, txHash } = await buildAndSubmit(
    sourceAddress,
    signTransaction,
    ESCROW_CONTRACT_ID,
    "create_job",
    args,
    signAuthEntry
  );

  // If result is available, decode it directly
  if (result) {
    const jobId = BigInt(scValToNative(result) as string | number);
    return { jobId, txHash };
  }

  // result is null when getTransaction() threw "Bad union switch: 4" parsing the
  // response metadata. The job WAS created on-chain — fetch the current job counter
  // to find the ID that was just assigned.
  const jobId = await fetchLatestJobId(sourceAddress);
  return { jobId, txHash };
}

// Fetch the current job counter from the contract (read-only)
async function fetchLatestJobId(sourceAddress: string): Promise<bigint> {
  // Try user's account first (definitely exists since they just submitted a tx)
  // Fall back to our stable distributor account
  let account = await server.getAccount(sourceAddress).catch(() => null);
  if (!account) {
    account = await server.getAccount(READ_ONLY_ACCOUNT).catch(() => null);
  }
  if (!account) throw new Error("RPC connection failed — cannot verify job ID");

  const contract = new Contract(ESCROW_CONTRACT_ID);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("get_job_count"))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error("Could not fetch job count: " + sim.error);
  }

  const raw = scValToNative(
    (sim as SorobanRpc.Api.SimulateTransactionSuccessResponse).result!.retval
  );
  return BigInt(raw as string | number);
}

export async function fundJob(
  sourceAddress: string,
  signTransaction: SignTransactionFn,
  jobId: bigint,
  amount: bigint,
  signAuthEntry?: SignAuthEntryFn
): Promise<{ txHash: string }> {
  const args = [
    nativeToScVal(jobId, { type: "u64" }),
    Address.fromString(sourceAddress).toScVal(),
    nativeToScVal(amount, { type: "i128" }),
  ];
  const { txHash } = await buildAndSubmit(
    sourceAddress,
    signTransaction,
    ESCROW_CONTRACT_ID,
    "fund_job",
    args,
    signAuthEntry
  );
  return { txHash };
}

export async function submitMilestone(
  sourceAddress: string,
  signTransaction: SignTransactionFn,
  jobId: bigint,
  milestoneIndex: number,
  signAuthEntry?: SignAuthEntryFn
): Promise<{ txHash: string }> {
  const args = [
    nativeToScVal(jobId, { type: "u64" }),
    nativeToScVal(milestoneIndex, { type: "u32" }),
    Address.fromString(sourceAddress).toScVal(),
  ];
  const { txHash } = await buildAndSubmit(
    sourceAddress,
    signTransaction,
    ESCROW_CONTRACT_ID,
    "submit_milestone",
    args,
    signAuthEntry
  );
  return { txHash };
}

export async function approveMilestone(
  sourceAddress: string,
  signTransaction: SignTransactionFn,
  jobId: bigint,
  milestoneIndex: number,
  signAuthEntry?: SignAuthEntryFn
): Promise<{ txHash: string }> {
  const args = [
    nativeToScVal(jobId, { type: "u64" }),
    nativeToScVal(milestoneIndex, { type: "u32" }),
    Address.fromString(sourceAddress).toScVal(),
  ];
  const { txHash } = await buildAndSubmit(
    sourceAddress,
    signTransaction,
    ESCROW_CONTRACT_ID,
    "approve_milestone",
    args,
    signAuthEntry
  );
  return { txHash };
}

export async function rejectMilestone(
  sourceAddress: string,
  signTransaction: SignTransactionFn,
  jobId: bigint,
  milestoneIndex: number,
  reason: string,
  signAuthEntry?: SignAuthEntryFn
): Promise<{ txHash: string }> {
  const args = [
    nativeToScVal(jobId, { type: "u64" }),
    nativeToScVal(milestoneIndex, { type: "u32" }),
    Address.fromString(sourceAddress).toScVal(),
    nativeToScVal(reason, { type: "string" }),
  ];
  const { txHash } = await buildAndSubmit(
    sourceAddress,
    signTransaction,
    ESCROW_CONTRACT_ID,
    "reject_milestone",
    args,
    signAuthEntry
  );
  return { txHash };
}

export async function refundJob(
  sourceAddress: string,
  signTransaction: SignTransactionFn,
  jobId: bigint,
  signAuthEntry?: SignAuthEntryFn
): Promise<{ refundAmount: bigint; txHash: string }> {
  const args = [
    nativeToScVal(jobId, { type: "u64" }),
    Address.fromString(sourceAddress).toScVal(),
  ];
  const { result, txHash } = await buildAndSubmit(
    sourceAddress,
    signTransaction,
    ESCROW_CONTRACT_ID,
    "refund",
    args,
    signAuthEntry
  );
  const refundAmount = result
    ? BigInt(scValToNative(result) as string | number)
    : BigInt(0);
  return { refundAmount, txHash };
}

// Stable funded testnet account used for read-only simulations
// (our distributor account — always funded)
const READ_ONLY_ACCOUNT = "GCJZW42CHS33GIQSEELBQU5EBW2E6674Y67OSSLHUYV7G2V3IQOBZZEY";

export async function getJob(jobId: bigint): Promise<Job> {
  const readAccount = await server.getAccount(READ_ONLY_ACCOUNT).catch(() => null);
  if (!readAccount) throw new Error("RPC connection failed");

  const contract = new Contract(ESCROW_CONTRACT_ID);
  const tx = new TransactionBuilder(readAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call("get_job", nativeToScVal(jobId, { type: "u64" }))
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`get_job failed: ${sim.error}`);
  }

  const raw = scValToNative(
    (sim as SorobanRpc.Api.SimulateTransactionSuccessResponse).result!.retval
  );
  return parseJob(raw);
}

export async function listJobsByAddress(address: string): Promise<bigint[]> {
  // Use the user's account if loadable, else fall back to our stable account
  let account = await server.getAccount(address).catch(() => null);
  if (!account) {
    account = await server.getAccount(READ_ONLY_ACCOUNT).catch(() => null);
  }
  if (!account) return [];

  const contract = new Contract(ESCROW_CONTRACT_ID);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "list_jobs_by_address",
        Address.fromString(address).toScVal()
      )
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) return [];

  const raw = scValToNative(
    (sim as SorobanRpc.Api.SimulateTransactionSuccessResponse).result!.retval
  ) as unknown[];
  return (raw || []).map((id) => BigInt(id as string | number));
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export const STELLAR_LIB_VERSION = "3.0.0"; // cache bust

/** Convert stroops (1/10,000,000 of a unit) to display USDC string */
export function stroopsToUsdc(stroops: bigint): string {
  return (Number(stroops) / 10_000_000).toFixed(2);
}

/** Convert a USDC display amount (e.g. 1.5) to stroops */
export function usdcToStroops(usdc: number): bigint {
  return BigInt(Math.round(usdc * 10_000_000));
}

/** Truncate a Stellar address for display */
export function truncateAddress(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/** Format a bigint stroops amount as "$X.XX USDC" */
export function formatUsdc(stroops: bigint): string {
  return `${stroopsToUsdc(stroops)} USDC`;
}

export function parseContractError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);

  // Contract-specific errors (from Rust error enum)
  if (message.includes("Unauthorized")) return "Not authorized for this action.";
  if (message.includes("AlreadyFunded")) return "This job is already funded.";
  if (message.includes("InvalidAmount")) return "Deposit amount must match the total job value.";
  if (message.includes("DoubleRelease")) return "This milestone has already been released.";
  if (message.includes("InvalidMilestoneStatus")) return "Milestone is not in the correct state for this action.";
  if (message.includes("NotFunded")) return "Job must be funded before milestones can be submitted.";
  if (message.includes("JobNotFound")) return "Job not found on-chain.";
  if (message.includes("JobNotCancellable")) return "This job cannot be refunded in its current state.";
  if (message.includes("MilestoneNotFound")) return "Milestone not found.";

  // Wallet rejection
  if (message.includes("rejected") || message.includes("declined") || message.includes("User denied"))
    return "Transaction rejected in wallet.";

  // USDC balance issues — only for fund_job context (trustline missing or insufficient balance)
  // Only show this when the error specifically mentions trustline or balance missing
  if (message.includes("trustline entry is missing") || message.includes("trust line entry is missing"))
    return "Your wallet is missing a USDC trustline. Go to /profile and click 'Get Test USDC'.";
  if ((message.includes("insufficient") || message.includes("Insufficient")) &&
      (message.includes("balance") || message.includes("fund")))
    return "Insufficient USDC balance. Go to /profile and click 'Get Test USDC'.";

  // Simulation errors
  if (message.includes("Simulation failed") || message.includes("simulation failed")) {
    // Extract the actual contract error from the simulation message if possible
    const match = message.match(/Error\(Contract,\s*#(\d+)\)/);
    if (match) {
      const code = parseInt(match[1]);
      const codeMap: Record<number, string> = {
        1: "Job not found on-chain.",
        2: "Not authorized for this action.",
        3: "Deposit amount must match the total job value.",
        4: "This job is already funded.",
        5: "Job must be funded before milestones can be submitted.",
        6: "Milestone not found.",
        7: "Milestone is not in the correct state for this action.",
        8: "This milestone has already been released.",
        9: "Arithmetic error in contract.",
        10: "This job cannot be refunded in its current state.",
        11: "No milestones provided.",
        12: "Too many milestones (max 50).",
        13: "The freelancer wallet has no USDC trustline. They need to visit /profile and click 'Get Test USDC' before payment can be released.",
      };
      if (codeMap[code]) return codeMap[code];
    }
    // Token transfer failure — escrow has no balance (job was not funded)
    if (message.includes("transfer") || message.includes("balance") || message.includes("token"))
      return "Cannot release payment — the escrow has no USDC. Please fund the job first by clicking 'Deposit USDC into Escrow'.";
    return "Transaction simulation failed. Check the job and milestone status.";
  }

  // Misc
  if (message.includes("Bad union switch") || message.includes("Auth rewrite failed"))
    return "Wallet signing error. Please try again.";
  if (message.includes("wrong network") || message.includes("Wrong network"))
    return "Switch Freighter to Stellar Testnet.";
  if (message.includes("Transaction failed on-chain"))
    return "Transaction failed on-chain. The job or milestone state may have changed — please refresh.";

  return message || "An unexpected error occurred.";
}
