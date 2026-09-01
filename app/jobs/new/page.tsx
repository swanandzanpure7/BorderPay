"use client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/hooks/useWallet";
import { useCreateJob } from "@/lib/hooks/useJob";
import { USDC_TOKEN_ID, usdcToStroops, parseContractError } from "@/lib/stellar";
import { ErrorAlert, SuccessAlert } from "@/components/ui/ErrorAlert";
import { Spinner } from "@/components/ui/Spinner";
import Link from "next/link";

interface MilestoneForm {
  description: string;
  amount: string;
}

export default function NewJobPage() {
  const router = useRouter();
  const { address, isConnected, connect } = useWallet();
  const createJob = useCreateJob();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [freelancer, setFreelancer] = useState("");
  const [milestones, setMilestones] = useState<MilestoneForm[]>([
    { description: "", amount: "" },
    { description: "", amount: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [successTx, setSuccessTx] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "creating" | "funding" | "done">("idle");

  const totalUsdc = milestones.reduce(
    (sum, m) => sum + (parseFloat(m.amount) || 0),
    0
  );

  const addMilestone = useCallback(() => {
    setMilestones((prev) => [...prev, { description: "", amount: "" }]);
  }, []);

  const removeMilestone = useCallback((index: number) => {
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateMilestone = useCallback(
    (index: number, field: keyof MilestoneForm, value: string) => {
      setMilestones((prev) =>
        prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
      );
    },
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!address) { setError("Please connect your wallet first."); return; }
    if (!freelancer.trim() || freelancer.length < 56) {
      setError("Enter a valid 56-character Stellar wallet address for the freelancer.");
      return;
    }
    if (!freelancer.startsWith("G")) {
      setError("Freelancer must be a Stellar wallet address starting with G.");
      return;
    }
    if (milestones.some((m) => !m.description.trim())) {
      setError("All milestones need a description."); return;
    }
    if (milestones.some((m) => !m.amount || parseFloat(m.amount) <= 0)) {
      setError("All milestones need a positive USDC amount."); return;
    }

    // Check freelancer USDC trustline
    try {
      const { Horizon } = await import("@stellar/stellar-sdk");
      const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
      const issuerPublic = process.env.NEXT_PUBLIC_USDC_ISSUER || "";
      if (issuerPublic) {
        const acc = await horizon.loadAccount(freelancer).catch(() => null);
        if (acc) {
          const hasTrustline = acc.balances.some(
            (b: { asset_code?: string; asset_issuer?: string }) =>
              b.asset_code === "USDC" && b.asset_issuer === issuerPublic
          );
          if (!hasTrustline) {
            setError(
              `The freelancer wallet (${freelancer.slice(0, 8)}…) has no USDC trustline. ` +
              `They need to visit /profile and click "Get Test USDC" first.`
            );
            return;
          }
        }
      }
    } catch { /* non-fatal */ }

    try {
      const result = await createJob.mutateAsync({
        freelancer,
        token: USDC_TOKEN_ID,
        milestones: milestones.map((m) => ({
          description: m.description.trim(),
          amount: usdcToStroops(parseFloat(m.amount)),
        })),
        onStep: (s) => setStep(s),
      });
      setSuccessTx(result.txHash);
      setTimeout(() => { router.push(`/jobs/${result.jobId}`); }, 2000);
    } catch (err) {
      setStep("idle");
      setError(parseContractError(err));
    }
  };

  if (!mounted) return null;

  if (!isConnected) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-950 border border-indigo-800 flex items-center justify-center text-3xl mb-5">
          🔗
        </div>
        <h1 className="text-2xl font-bold mb-2">Connect your wallet</h1>
        <p className="text-gray-400 mb-7 max-w-sm text-sm">
          You need to connect your Freighter wallet to post a job.
        </p>
        <button onClick={connect} className="btn-primary px-7">Connect Wallet</button>
      </div>
    );
  }

  if (successTx) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
        <div className="w-20 h-20 rounded-2xl bg-emerald-950 border border-emerald-700 flex items-center justify-center text-4xl mb-5 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
          ✅
        </div>
        <h1 className="text-2xl font-bold mb-2">Job created &amp; funded!</h1>
        <p className="text-gray-400 mb-5">
          USDC is locked in escrow. Redirecting to your job page…
        </p>
        <a
          href={`https://stellar.expert/explorer/testnet/tx/${successTx}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-indigo-400 hover:underline"
        >
          View on Stellar Explorer →
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Page header */}
      <div className="mb-8">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
          ← Dashboard
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold mt-3">Post a New Job</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Define milestones, set USDC amounts, and lock funds in on-chain escrow.
        </p>
      </div>

      {/* Progress indicator */}
      {createJob.isPending && (
        <div className="mb-6 card bg-indigo-950/40 border-indigo-800">
          <div className="flex items-center gap-3">
            <Spinner size="sm" />
            <div>
              <p className="text-sm font-semibold text-white">
                {step === "creating" && "Step 1 of 2 — Creating job on-chain…"}
                {step === "funding" && "Step 2 of 2 — Depositing USDC into escrow…"}
                {step === "idle" && "Processing…"}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Approve the transaction in your Freighter wallet.
              </p>
            </div>
          </div>
          {/* Step dots */}
          <div className="flex gap-2 mt-3">
            {["Create job", "Fund escrow"].map((label, i) => {
              const done =
                (i === 0 && (step === "funding" || step === "done")) ||
                step === "done";
              const active =
                (i === 0 && step === "creating") || (i === 1 && step === "funding");
              return (
                <div
                  key={label}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
                    done
                      ? "bg-emerald-950/50 border-emerald-800 text-emerald-400"
                      : active
                      ? "bg-indigo-950/50 border-indigo-700 text-indigo-300"
                      : "bg-gray-800 border-gray-700 text-gray-500"
                  }`}
                >
                  {done ? "✓" : active ? <Spinner size="sm" /> : `${i + 1}`}
                  {label}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Freelancer */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-7 w-7 rounded-lg bg-indigo-950 border border-indigo-800 flex items-center justify-center text-sm">👤</div>
            <h2 className="font-semibold">Freelancer</h2>
          </div>
          <label htmlFor="freelancer" className="label">Wallet Address</label>
          <div className="flex gap-2 items-start">
            <input
              id="freelancer"
              type="text"
              className="input font-mono flex-1 text-xs sm:text-sm"
              placeholder="G… (56-character Stellar address)"
              value={freelancer}
              onChange={(e) => setFreelancer(e.target.value.trim())}
              required
              maxLength={56}
            />
            <button
              type="button"
              onClick={() => address && setFreelancer(address)}
              className="btn-secondary text-xs py-2.5 px-3 shrink-0"
            >
              Use mine
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Must start with <strong className="text-gray-400">G</strong>.
            Use &ldquo;Use mine&rdquo; to assign yourself for demo purposes.
          </p>
        </div>

        {/* Milestones */}
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-indigo-950 border border-indigo-800 flex items-center justify-center text-sm">🎯</div>
              <h2 className="font-semibold">Milestones</h2>
            </div>
            <button
              type="button"
              onClick={addMilestone}
              className="btn-secondary text-xs py-1.5 px-3"
              disabled={milestones.length >= 20}
            >
              + Add
            </button>
          </div>

          <div className="space-y-3">
            {milestones.map((milestone, index) => (
              <div
                key={index}
                className="rounded-xl bg-gray-800/60 border border-gray-700/80 p-4 transition-colors hover:border-gray-600"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-950 border border-indigo-800 flex items-center justify-center text-xs font-bold text-indigo-300">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-300">Milestone {index + 1}</span>
                  </div>
                  {milestones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMilestone(index)}
                      className="text-xs text-gray-600 hover:text-red-400 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label htmlFor={`desc-${index}`} className="label text-xs">Description</label>
                    <input
                      id={`desc-${index}`}
                      type="text"
                      className="input text-sm"
                      placeholder="e.g., UI Design mockups"
                      value={milestone.description}
                      onChange={(e) => updateMilestone(index, "description", e.target.value)}
                      required
                      maxLength={200}
                    />
                  </div>
                  <div>
                    <label htmlFor={`amount-${index}`} className="label text-xs">
                      Amount (USDC)
                    </label>
                    <div className="relative">
                      <input
                        id={`amount-${index}`}
                        type="number"
                        className="input text-sm pr-14"
                        placeholder="500"
                        value={milestone.amount}
                        onChange={(e) => updateMilestone(index, "amount", e.target.value)}
                        required
                        min="0.01"
                        step="0.01"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">
                        USDC
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="mt-5 flex items-center justify-between pt-4 border-t border-gray-700/60">
            <div className="text-sm text-gray-400">
              {milestones.length} milestone{milestones.length !== 1 ? "s" : ""} · Total escrow
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-white">{totalUsdc.toFixed(2)}</span>
              <span className="text-sm text-gray-500 ml-1">USDC</span>
            </div>
          </div>
        </div>

        {/* Token info banner */}
        <div className="rounded-xl bg-indigo-950/40 border border-indigo-900/60 px-4 py-3 flex items-start gap-3 text-sm">
          <span className="text-indigo-400 mt-0.5 shrink-0">ℹ</span>
          <div className="text-indigo-300">
            <strong>Stellar Testnet USDC</strong> — Funds are locked in a non-custodial
            Soroban smart contract. Two Freighter approvals will be required.
            {USDC_TOKEN_ID && (
              <span className="block font-mono text-xs text-indigo-400/70 mt-0.5 break-all">
                SAC: {USDC_TOKEN_ID.slice(0, 16)}…
              </span>
            )}
          </div>
        </div>

        {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

        <button
          type="submit"
          disabled={createJob.isPending}
          className="btn-primary w-full py-3.5 text-base"
        >
          {createJob.isPending ? (
            <>
              <Spinner size="sm" />
              {step === "creating" && "Step 1/2: Creating job…"}
              {step === "funding" && "Step 2/2: Funding escrow…"}
              {step === "idle" && "Processing…"}
            </>
          ) : (
            `Create & Fund Escrow · ${totalUsdc.toFixed(2)} USDC`
          )}
        </button>

        <p className="text-xs text-gray-600 text-center pb-4">
          Two wallet approvals required — create job, then deposit{" "}
          <strong className="text-gray-500">{totalUsdc.toFixed(2)} USDC</strong> into escrow.
        </p>
      </form>
    </div>
  );
}
