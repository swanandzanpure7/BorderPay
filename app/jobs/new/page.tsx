"use client";

export const dynamic = 'force-dynamic';
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
  amount: string; // in USDC display units
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

    if (!address) {
      setError("Please connect your wallet first.");
      return;
    }

    // Validation
    if (!freelancer.trim() || freelancer.length < 56) {
      setError("Enter a valid Stellar wallet address for the freelancer. It must start with G and be 56 characters.");
      return;
    }
    if (!freelancer.startsWith("G")) {
      setError("Freelancer must be a Stellar wallet address starting with G (not a contract address).");
      return;
    }
    if (freelancer === address) {
      // Allow same address for demo — just warn
      console.log("Note: using own address as freelancer (demo mode)");
    }
    if (milestones.some((m) => !m.description.trim())) {
      setError("All milestones need a description.");
      return;
    }
    if (milestones.some((m) => !m.amount || parseFloat(m.amount) <= 0)) {
      setError("All milestones need a positive USDC amount.");
      return;
    }
    if (totalUsdc <= 0) {
      setError("Total job value must be greater than 0.");
      return;
    }

    // Check freelancer has USDC trustline before creating job
    try {
      const { Horizon } = await import("@stellar/stellar-sdk");
      const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
      const issuerPublic = process.env.NEXT_PUBLIC_USDC_ISSUER || "";
      if (issuerPublic) {
        const acc = await horizon.loadAccount(freelancer).catch(() => null);
        if (acc) {
          const hasTrustline = acc.balances.some(
            (b: any) => b.asset_code === "USDC" && b.asset_issuer === issuerPublic
          );
          if (!hasTrustline) {
            setError(
              `The freelancer wallet (${freelancer.slice(0,8)}...) has no USDC trustline. ` +
              `They need to visit /profile and click 'Get Test USDC' first, otherwise payment release will fail.`
            );
            return;
          }
        }
      }
    } catch { /* non-fatal check */ }

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
      setTimeout(() => {
        router.push(`/jobs/${result.jobId}`);
      }, 2000);
    } catch (err) {
      setStep("idle");
      setError(parseContractError(err));
    }
  };

  if (!mounted) return null;

  if (!isConnected) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
        <div className="text-5xl mb-4">🔗</div>
        <h1 className="text-2xl font-bold mb-2">Connect your wallet</h1>
        <p className="text-gray-400 mb-6 max-w-sm">
          You need to connect your Freighter wallet to post a job.
        </p>
        <button onClick={connect} className="btn-primary">
          Connect Wallet
        </button>
      </div>
    );
  }

  if (successTx) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold mb-2">Job created & funded!</h1>
        <p className="text-gray-400 mb-4">Escrow is active. Redirecting to your job page…</p>
        <a
          href={`https://stellar.expert/explorer/testnet/tx/${successTx}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-indigo-400 hover:underline"
        >
          View transaction →
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-300">
          ← Dashboard
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold mt-2">Post a New Job</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Define milestones and fund the escrow with USDC on Stellar testnet.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Freelancer address */}
        <div className="card">
          <h2 className="font-semibold mb-4">Freelancer</h2>
          <div>
            <label htmlFor="freelancer" className="label">
              Freelancer Wallet Address
            </label>
            <div className="flex gap-2 items-start">
              <input
                id="freelancer"
                type="text"
                className="input font-mono flex-1"
                placeholder="G... (56-character Stellar wallet address)"
                value={freelancer}
                onChange={(e) => setFreelancer(e.target.value.trim())}
                required
                maxLength={56}
                aria-describedby="freelancer-hint"
              />
              <button
                type="button"
                onClick={() => address && setFreelancer(address)}
                className="btn-secondary text-xs py-2 px-3 shrink-0 whitespace-nowrap"
                title="Use your own wallet as the freelancer (useful for demos)"
              >
                Use mine
              </button>
            </div>
            <p id="freelancer-hint" className="mt-1.5 text-xs text-gray-500">
              Must start with <strong className="text-gray-400">G</strong> — a Stellar wallet address.{" "}
              <span className="text-indigo-400">Tip: click "Use mine" to use your own wallet for both roles (great for demos).</span>
            </p>
          </div>
        </div>

        {/* Milestones */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Milestones</h2>
            <button
              type="button"
              onClick={addMilestone}
              className="btn-secondary text-sm py-1.5"
              disabled={milestones.length >= 20}
            >
              + Add Milestone
            </button>
          </div>

          <div className="space-y-4">
            {milestones.map((milestone, index) => (
              <div
                key={index}
                className="rounded-lg bg-gray-800/50 border border-gray-700 p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-300">
                    Milestone {index + 1}
                  </span>
                  {milestones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMilestone(index)}
                      className="text-xs text-red-500 hover:text-red-400"
                      aria-label={`Remove milestone ${index + 1}`}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor={`desc-${index}`}
                      className="label text-xs"
                    >
                      Description
                    </label>
                    <input
                      id={`desc-${index}`}
                      type="text"
                      className="input text-sm"
                      placeholder="e.g., UI Design mockups"
                      value={milestone.description}
                      onChange={(e) =>
                        updateMilestone(index, "description", e.target.value)
                      }
                      required
                      maxLength={200}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`amount-${index}`}
                      className="label text-xs"
                    >
                      Amount (USDC)
                    </label>
                    <input
                      id={`amount-${index}`}
                      type="number"
                      className="input text-sm"
                      placeholder="500"
                      value={milestone.amount}
                      onChange={(e) =>
                        updateMilestone(index, "amount", e.target.value)
                      }
                      required
                      min="0.01"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="mt-4 flex justify-between items-center pt-4 border-t border-gray-700">
            <span className="text-sm text-gray-400">Total escrow amount</span>
            <span className="text-lg font-bold text-white">
              {totalUsdc.toFixed(2)} USDC
            </span>
          </div>
        </div>

        {/* Token info */}
        <div className="rounded-lg bg-indigo-950/50 border border-indigo-900 px-4 py-3 text-sm text-indigo-300">
          <strong>Token:</strong> Stellar testnet USDC (SAC){" "}
          {USDC_TOKEN_ID && (
            <span className="font-mono text-xs opacity-70 break-all">
              {USDC_TOKEN_ID.slice(0, 10)}…
            </span>
          )}
        </div>

        {error && (
          <ErrorAlert message={error} onDismiss={() => setError(null)} />
        )}

        <button
          type="submit"
          disabled={createJob.isPending}
          className="btn-primary w-full py-3 text-base"
        >
          {createJob.isPending ? (
            <>
              <Spinner size="sm" />
              {step === "creating" && "Step 1/2: Creating job on-chain…"}
              {step === "funding" && "Step 2/2: Depositing USDC into escrow…"}
              {step === "idle" && "Creating job on-chain…"}
            </>
          ) : (
            `Create & Fund Job · ${totalUsdc.toFixed(2)} USDC`
          )}
        </button>

        <p className="text-xs text-gray-500 text-center">
          Two wallet approvals: first to create the job, then to deposit {totalUsdc.toFixed(2)} USDC into escrow.
        </p>
      </form>
    </div>
  );
}
