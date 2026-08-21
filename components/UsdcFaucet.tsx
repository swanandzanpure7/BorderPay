"use client";

/**
 * UsdcFaucet — one-click testnet USDC setup.
 * Handles: XLM friendbot → trustline (via Freighter) → USDC mint (via API).
 */
import { useState } from "react";
import { useWallet } from "@/lib/hooks/useWallet";
import { Spinner } from "@/components/ui/Spinner";
import {
  Networks, TransactionBuilder, BASE_FEE,
  Operation, Asset, Horizon
} from "@stellar/stellar-sdk";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const NP = Networks.TESTNET;
const USDC_ISSUER = process.env.NEXT_PUBLIC_USDC_ISSUER || "";
const USDC_ASSET_CODE = "USDC";

type Step = "idle" | "xlm" | "trustline" | "usdc" | "done" | "error";

export function UsdcFaucet() {
  const { address, sign } = useWallet();
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);

  const checkBalance = async () => {
    if (!address) return null;
    try {
      const horizon = new Horizon.Server(HORIZON_URL);
      const acc = await horizon.loadAccount(address);
      const bal = acc.balances.find(
        (b: any) => b.asset_code === USDC_ASSET_CODE && b.asset_issuer === USDC_ISSUER
      );
      return bal?.balance ?? null;
    } catch { return null; }
  };

  const run = async () => {
    if (!address || !sign) return;
    setError(null);
    setTxHash(null);

    const horizon = new Horizon.Server(HORIZON_URL);

    // Step 1: Ensure account exists (fund with XLM via Friendbot)
    setStep("xlm");
    let accountExists = false;
    try {
      await horizon.loadAccount(address);
      accountExists = true;
    } catch {
      // Fund via Friendbot
      const fb = await fetch(`https://friendbot.stellar.org/?addr=${address}`);
      if (!fb.ok) {
        const txt = await fb.text();
        // Account may already exist (400 = duplicate) — that's fine
        if (!txt.includes("createAccountAlreadyExist")) {
          setError("Friendbot failed. Your account may already be funded.");
        }
      }
      await new Promise(r => setTimeout(r, 4000));
      accountExists = true;
    }

    if (!accountExists) {
      setError("Could not create account. Try again.");
      setStep("error");
      return;
    }

    // Step 2: Add USDC trustline if not present
    setStep("trustline");
    try {
      const acc = await horizon.loadAccount(address);
      const hasTrustline = acc.balances.some(
        (b: any) => b.asset_code === USDC_ASSET_CODE && b.asset_issuer === USDC_ISSUER
      );

      if (!hasTrustline) {
        if (!USDC_ISSUER) throw new Error("USDC issuer not configured");

        // Build changeTrust transaction
        const USDC = new Asset(USDC_ASSET_CODE, USDC_ISSUER);
        const tx = new TransactionBuilder(acc, {
          fee: BASE_FEE,
          networkPassphrase: NP,
        })
          .addOperation(Operation.changeTrust({ asset: USDC, limit: "1000000" }))
          .setTimeout(30)
          .build();

        // Sign with Freighter
        const signedXdr = await sign(tx.toXDR(), { networkPassphrase: NP });
        const { TransactionBuilder: TB } = await import("@stellar/stellar-sdk");
        const signedTx = TB.fromXDR(signedXdr, NP);
        await horizon.submitTransaction(signedTx as any);
        await new Promise(r => setTimeout(r, 3000));
      }
    } catch (err: any) {
      if (err.message?.includes("rejected") || err.message?.includes("cancel")) {
        setError("Trustline setup cancelled. Please approve in Freighter.");
      } else {
        setError("Trustline setup failed: " + (err.message || String(err)));
      }
      setStep("error");
      return;
    }

    // Step 3: Request USDC from faucet API
    setStep("usdc");
    try {
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "TRUSTLINE_REQUIRED") {
          setError("Trustline not found on-chain yet. Wait a moment and try again.");
        } else {
          setError(data.error || "Faucet request failed.");
        }
        setStep("error");
        return;
      }

      setTxHash(data.txHash);
      await new Promise(r => setTimeout(r, 3000));
      const bal = await checkBalance();
      setUsdcBalance(bal);
      setStep("done");
    } catch (err: any) {
      setError("Faucet error: " + (err.message || String(err)));
      setStep("error");
    }
  };

  const isRunning = step === "xlm" || step === "trustline" || step === "usdc";

  const stepLabel = {
    idle: null,
    xlm: "Step 1/3: Checking XLM balance…",
    trustline: "Step 2/3: Adding USDC trustline (approve in Freighter)…",
    usdc: "Step 3/3: Sending 100 testnet USDC…",
    done: null,
    error: null,
  }[step];

  if (step === "done") {
    return (
      <div className="rounded-lg bg-green-950/50 border border-green-800 p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-green-400 text-lg">✓</span>
          <span className="font-semibold text-green-300">100 testnet USDC received!</span>
        </div>
        {usdcBalance && (
          <p className="text-sm text-green-400">Your balance: {usdcBalance} USDC</p>
        )}
        {txHash && (
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-green-500 hover:underline mt-1 block"
          >
            View transaction →
          </a>
        )}
        <p className="text-xs text-green-600 mt-2">
          You can now post jobs on BorderPay.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-indigo-950/40 border border-indigo-800 p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="font-semibold text-indigo-200 text-sm">Need testnet USDC?</p>
          <p className="text-xs text-indigo-400 mt-0.5">
            Get 100 free USDC to use on BorderPay testnet — one click.
          </p>
        </div>
        <button
          onClick={run}
          disabled={isRunning || !address}
          className="btn-primary text-sm py-2 px-4 shrink-0"
        >
          {isRunning ? <><Spinner size="sm" /> Getting USDC…</> : "Get Test USDC"}
        </button>
      </div>

      {isRunning && stepLabel && (
        <p className="text-xs text-indigo-300 mt-3 animate-pulse">{stepLabel}</p>
      )}

      {error && (
        <div className="mt-3 rounded bg-red-900/40 border border-red-800 px-3 py-2 text-xs text-red-300 flex items-start gap-2">
          <span className="shrink-0 mt-0.5">⚠</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
