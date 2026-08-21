"use client";

export const dynamic = 'force-dynamic';

import React from "react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useWallet } from "@/lib/hooks/useWallet";
import {
  useJob,
  useFundJob,
  useSubmitMilestone,
  useApproveMilestone,
  useRejectMilestone,
  useRefundJob,
  useTxHistory,
  type TxRecord,
} from "@/lib/hooks/useJob";
import {
  stroopsToUsdc,
  truncateAddress,
  parseContractError,
  type Milestone,
} from "@/lib/stellar";
import { JobStatusBadge, MilestoneStatusBadge } from "@/components/ui/StatusBadge";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorAlert, SuccessAlert } from "@/components/ui/ErrorAlert";
import { FeedbackModal } from "@/components/FeedbackModal";
import Link from "next/link";

export default function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = React.use(params);
  const { id } = resolvedParams;
  const { address } = useWallet();

  const jobId = id ? BigInt(id) : null;
  const { data: job, isLoading, error, refetch } = useJob(jobId);
  const { data: txHistory = [] } = useTxHistory(jobId);

  const fundJob = useFundJob();
  const submitMilestone = useSubmitMilestone();
  const approveMilestone = useApproveMilestone();
  const rejectMilestone = useRejectMilestone();
  const refundJob = useRefundJob();

  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingIndex, setRejectingIndex] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const isClient = job && address === job.client;
  const isFreelancer = job && address === job.freelancer;

  // Show feedback modal when job completes
  useEffect(() => {
    if (job?.status === "Completed" && (isClient || isFreelancer)) {
      setShowFeedback(true);
    }
  }, [job?.status, isClient, isFreelancer]);

  const handleSuccess = (msg: string, txHash?: string) => {
    setSuccessMsg(
      txHash
        ? `${msg} · Tx: ${txHash.slice(0, 10)}…`
        : msg
    );
    refetch();
    setTimeout(() => setSuccessMsg(null), 8000);
  };

  const handleError = (err: unknown) => {
    const raw = err instanceof Error ? err.message : String(err);
    console.error("[BorderPay] raw error:", raw);
    setActionError(parseContractError(err));
  };

  const handleFund = async () => {
    if (!job || !jobId) return;
    setActionError(null);
    try {
      const { txHash } = await fundJob.mutateAsync({
        jobId,
        amount: job.total_amount,
      });
      handleSuccess("Job funded! Escrow is active.", txHash);
    } catch (err) {
      handleError(err);
    }
  };

  const handleSubmit = async (index: number) => {
    if (!jobId) return;
    setActionError(null);
    try {
      const { txHash } = await submitMilestone.mutateAsync({ jobId, milestoneIndex: index });
      handleSuccess(`Milestone ${index + 1} submitted for review.`, txHash);
    } catch (err) {
      handleError(err);
    }
  };

  const handleApprove = async (index: number) => {
    if (!jobId) return;
    setActionError(null);
    try {
      const { txHash } = await approveMilestone.mutateAsync({ jobId, milestoneIndex: index });
      handleSuccess(`Milestone ${index + 1} approved — funds released!`, txHash);
    } catch (err) {
      handleError(err);
    }
  };

  const handleReject = async (index: number) => {
    if (!jobId) return;
    if (!rejectReason.trim()) {
      setActionError("Please provide a reason for rejection.");
      return;
    }
    setActionError(null);
    try {
      const { txHash } = await rejectMilestone.mutateAsync({
        jobId,
        milestoneIndex: index,
        reason: rejectReason,
      });
      handleSuccess(`Milestone ${index + 1} disputed.`, txHash);
      setRejectReason("");
      setRejectingIndex(null);
    } catch (err) {
      handleError(err);
    }
  };

  const handleRefund = async () => {
    if (!jobId) return;
    setActionError(null);
    try {
      const { refundAmount, txHash } = await refundJob.mutateAsync({ jobId });
      handleSuccess(
        `Refund of ${stroopsToUsdc(refundAmount)} USDC returned to your wallet.`,
        txHash
      );
    } catch (err) {
      handleError(err);
    }
  };

  const anyLoading =
    fundJob.isPending ||
    submitMilestone.isPending ||
    approveMilestone.isPending ||
    rejectMilestone.isPending ||
    refundJob.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <h1 className="text-xl font-bold mb-2">Job not found</h1>
        <p className="text-gray-400 mb-4">
          This job ID doesn't exist on-chain, or the contract isn't configured.
        </p>
        <Link href="/dashboard" className="btn-secondary">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  const releasedValue = job.milestones
    .filter((m) => m.status === "Released")
    .reduce((sum, m) => sum + m.amount, BigInt(0));

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Back */}
      <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-300">
        ← Dashboard
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">Job #{job.id.toString()}</h1>
            <JobStatusBadge status={job.status} />
          </div>
          <div className="mt-2 flex flex-col sm:flex-row gap-2 text-sm text-gray-400">
            <span>
              Client: <span className="font-mono">{truncateAddress(job.client)}</span>
              {isClient && <span className="ml-1 text-indigo-400">(you)</span>}
            </span>
            <span className="hidden sm:inline text-gray-700">·</span>
            <span>
              Freelancer: <span className="font-mono">{truncateAddress(job.freelancer)}</span>
              {isFreelancer && <span className="ml-1 text-indigo-400">(you)</span>}
            </span>
          </div>
        </div>

        {/* Fund button — only show for Created status (on-chain source of truth) */}
        {isClient && job.status === "Created" && (
          <button
            onClick={handleFund}
            disabled={anyLoading}
            className="btn-primary self-start"
          >
            {fundJob.isPending ? (
              <><Spinner size="sm" /> Depositing…</>
            ) : (
              `Deposit ${stroopsToUsdc(job.total_amount)} USDC into Escrow`
            )}
          </button>
        )}

        {/* Refund button (client, Funded/InProgress) */}
        {isClient &&
          (job.status === "Funded" || job.status === "InProgress") && (
            <button
              onClick={handleRefund}
              disabled={anyLoading}
              className="btn-danger self-start text-sm"
            >
              {refundJob.isPending ? (
                <><Spinner size="sm" /> Refunding…</>
              ) : (
                "Cancel & Refund"
              )}
            </button>
          )}
      </div>

      {/* Alerts */}
      <div className="space-y-3 mb-6">
        {actionError && (
          <ErrorAlert message={actionError} onDismiss={() => setActionError(null)} />
        )}
        {successMsg && (
          <SuccessAlert message={successMsg} onDismiss={() => setSuccessMsg(null)} />
        )}
        {!address && (
          <div className="rounded-lg bg-amber-900/30 border border-amber-800 px-4 py-3 text-sm text-amber-300">
            Connect your wallet to interact with this job.
          </div>
        )}
        {/* Freelancer USDC trustline warning */}
        {isClient && job.status === "InProgress" && (
          <div className="rounded-lg bg-amber-900/30 border border-amber-800 px-4 py-3 text-sm text-amber-300">
            ⚠ Before approving, make sure the freelancer has a USDC trustline. Ask them to visit <strong>/profile</strong> and click <strong>"Get Test USDC"</strong>.
          </div>
        )}
        {/* Show wallet mismatch hint */}
        {address && !isClient && !isFreelancer && (
          <div className="rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-sm text-gray-400">
            You are viewing this job as a guest. Connect as the client or freelancer to take actions.
            <div className="mt-1 font-mono text-xs text-gray-500">
              Your wallet: {address}
            </div>
          </div>
        )}
        {/* Freelancer mismatch — connected as client but freelancer is different */}
        {address && isClient && !isFreelancer && (
          <div className="rounded-lg bg-blue-950/40 border border-blue-800 px-4 py-3 text-sm text-blue-300">
            💡 You are the <strong>client</strong> on this job. To submit milestones, switch Freighter to the freelancer account:
            <div className="mt-1 font-mono text-xs text-blue-400 break-all">{job?.freelancer}</div>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Value" value={`${stroopsToUsdc(job.total_amount)} USDC`} />
        <StatCard label="Released" value={`${stroopsToUsdc(releasedValue)} USDC`} />
        <StatCard
          label="Milestones"
          value={`${job.milestones.filter((m) => m.status === "Released").length}/${job.milestones.length}`}
        />
        <StatCard label="Status" value={job.status} />
      </div>

      {/* Progress bar */}
      <div className="mb-8 h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all"
          style={{
            width: `${
              job.milestones.length > 0
                ? (job.milestones.filter((m) => m.status === "Released").length /
                    job.milestones.length) *
                  100
                : 0
            }%`,
          }}
        />
      </div>

      {/* Milestones */}
      <h2 className="text-lg font-semibold mb-4">Milestones</h2>
      <div className="space-y-3">
        {job.milestones.map((milestone) => (
          <MilestoneCard
            key={milestone.index}
            milestone={milestone}
            isClient={!!isClient}
            isFreelancer={!!isFreelancer}
            jobStatus={job.status}
            anyLoading={anyLoading}
            rejectingIndex={rejectingIndex}
            rejectReason={rejectReason}
            onSubmit={() => handleSubmit(milestone.index)}
            onApprove={() => handleApprove(milestone.index)}
            onStartReject={() => {
              setRejectingIndex(milestone.index);
              setActionError(null);
            }}
            onConfirmReject={() => handleReject(milestone.index)}
            onCancelReject={() => {
              setRejectingIndex(null);
              setRejectReason("");
            }}
            onRejectReasonChange={setRejectReason}
            submitPending={submitMilestone.isPending}
            approvePending={approveMilestone.isPending}
            rejectPending={rejectMilestone.isPending}
          />
        ))}
      </div>

      {/* Feedback modal */}
      {showFeedback && job && address && (
        <FeedbackModal
          jobId={job.id.toString()}
          giverAddress={address}
          receiverAddress={isClient ? job.freelancer : job.client}
          onClose={() => setShowFeedback(false)}
        />
      )}

      {/* Completed Job Summary — shows all tx hashes when job is done */}
      {/* v4 */}
      {(job.status === "Completed" || job.status === "Cancelled") && txHistory.length > 0 && (
        <div className="mt-8 rounded-lg border border-emerald-800 bg-emerald-950/30 p-5">
          <h2 className="text-base font-semibold text-emerald-300 mb-4 flex items-center gap-2">
            <span>✅</span> Job {job.status} — Proof of Interactions
          </h2>
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-3 gap-2 text-xs text-gray-500 font-medium uppercase tracking-wide pb-2 border-b border-emerald-900">
              <span>Action</span>
              <span>Wallet</span>
              <span>Tx Hash</span>
            </div>
            {txHistory.map((tx) => (
              <div key={tx.id} className="grid grid-cols-3 gap-2 items-center py-1.5 border-b border-emerald-900/30">
                <span className="text-emerald-300 font-medium capitalize">
                  {tx.action.replace(/_/g, " ")}
                </span>
                <span className="font-mono text-xs text-gray-400 truncate">
                  {tx.actorAddress.slice(0, 8)}...{tx.actorAddress.slice(-4)}
                </span>
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${tx.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-indigo-400 hover:underline truncate"
                >
                  {tx.txHash.slice(0, 10)}... ↗
                </a>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-emerald-900 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-gray-500">Client wallet</span>
              <div className="font-mono text-gray-300 break-all mt-0.5">{job.client}</div>
            </div>
            <div>
              <span className="text-gray-500">Freelancer wallet</span>
              <div className="font-mono text-gray-300 break-all mt-0.5">{job.freelancer}</div>
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-500">
            Contract: <span className="font-mono text-gray-400">{process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID}</span>
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-gray-400">🔗</span> Transaction History
        </h2>
        {txHistory.length === 0 ? (
          <div className="card py-6 text-center border-dashed">
            <p className="text-sm text-gray-500">No transactions recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/50">
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Action</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Tx Hash</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Signed by</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Time</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {txHistory.map((tx) => (
                  <TxRow key={tx.id} tx={tx} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card py-3 px-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="font-semibold text-white text-sm">{value}</div>
    </div>
  );
}

// ─── Action label + colour map ────────────────────────────────────────────────

const ACTION_LABELS: Record<string, { label: string; colour: string }> = {
  create_job:        { label: "Create Job",         colour: "text-indigo-400 bg-indigo-950/50 border-indigo-800" },
  fund_job:          { label: "Fund Escrow",         colour: "text-emerald-400 bg-emerald-950/50 border-emerald-800" },
  submit_milestone:  { label: "Submit Milestone",    colour: "text-blue-400 bg-blue-950/50 border-blue-800" },
  approve_milestone: { label: "Approve & Release",   colour: "text-green-400 bg-green-950/50 border-green-800" },
  reject_milestone:  { label: "Dispute Milestone",   colour: "text-amber-400 bg-amber-950/50 border-amber-800" },
  refund:            { label: "Refund",              colour: "text-red-400 bg-red-950/50 border-red-800" },
};

function TxRow({ tx }: { tx: TxRecord }) {
  const meta = ACTION_LABELS[tx.action] ?? { label: tx.action, colour: "text-gray-400 bg-gray-800/50 border-gray-700" };
  const date = new Date(tx.createdAt);
  const timeStr = date.toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <tr className="hover:bg-gray-900/30 transition-colors">
      <td className="px-4 py-3">
        <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${meta.colour}`}>
          {meta.label}
        </span>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-gray-300">
        {tx.txHash.slice(0, 8)}…{tx.txHash.slice(-6)}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-gray-500">
        {tx.actorAddress.slice(0, 6)}…{tx.actorAddress.slice(-4)}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
        {timeStr}
      </td>
      <td className="px-4 py-3 text-right">
        <a
          href={`https://stellar.expert/explorer/testnet/tx/${tx.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline"
        >
          View ↗
        </a>
      </td>
    </tr>
  );
}

interface MilestoneCardProps {
  milestone: Milestone;
  isClient: boolean;
  isFreelancer: boolean;
  jobStatus: string;
  anyLoading: boolean;
  rejectingIndex: number | null;
  rejectReason: string;
  onSubmit: () => void;
  onApprove: () => void;
  onStartReject: () => void;
  onConfirmReject: () => void;
  onCancelReject: () => void;
  onRejectReasonChange: (reason: string) => void;
  submitPending: boolean;
  approvePending: boolean;
  rejectPending: boolean;
}

function MilestoneCard({
  milestone,
  isClient,
  isFreelancer,
  jobStatus,
  anyLoading,
  rejectingIndex,
  rejectReason,
  onSubmit,
  onApprove,
  onStartReject,
  onConfirmReject,
  onCancelReject,
  onRejectReasonChange,
  submitPending,
  approvePending,
  rejectPending,
}: MilestoneCardProps) {
  const isRejecting = rejectingIndex === milestone.index;

  // Job must be Funded or InProgress for any milestone actions
  const jobActive = jobStatus === "Funded" || jobStatus === "InProgress";

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-gray-300">
              #{milestone.index + 1}
            </span>
            <span className="text-white">{milestone.description}</span>
            <MilestoneStatusBadge status={milestone.status} />
          </div>
          <div className="mt-1 text-sm text-indigo-300 font-medium">
            {stroopsToUsdc(milestone.amount)} USDC
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">

          {/* Freelancer: submit for review */}
          {isFreelancer && milestone.status === "Pending" && (
            jobActive ? (
              <button
                onClick={onSubmit}
                disabled={anyLoading}
                className="btn-secondary text-sm"
              >
                {submitPending ? (
                  <><Spinner size="sm" /> Submitting…</>
                ) : (
                  "Submit for Review"
                )}
              </button>
            ) : (
              <span className="text-xs text-gray-500 self-center">
                Waiting for client to fund job
              </span>
            )
          )}

          {/* Client: approve or dispute — also allow if same wallet is both */}
          {isClient && milestone.status === "Submitted" && !isRejecting && (
            <>
              <button
                onClick={onApprove}
                disabled={anyLoading}
                className="btn-success text-sm"
              >
                {approvePending ? (
                  <><Spinner size="sm" /> Approving…</>
                ) : (
                  "✓ Approve & Release"
                )}
              </button>
              <button
                onClick={onStartReject}
                disabled={anyLoading}
                className="btn-danger text-sm"
              >
                Dispute
              </button>
            </>
          )}

          {/* Reject/dispute flow */}
          {isClient && isRejecting && (
            <div className="flex flex-col gap-2 w-full sm:w-72">
              <input
                type="text"
                className="input text-sm"
                placeholder="Reason for dispute…"
                value={rejectReason}
                onChange={(e) => onRejectReasonChange(e.target.value)}
                autoFocus
                maxLength={300}
              />
              <div className="flex gap-2">
                <button
                  onClick={onConfirmReject}
                  disabled={anyLoading || !rejectReason.trim()}
                  className="btn-danger text-sm flex-1"
                >
                  {rejectPending ? (
                    <><Spinner size="sm" /> Submitting…</>
                  ) : (
                    "Confirm Dispute"
                  )}
                </button>
                <button
                  onClick={onCancelReject}
                  className="btn-secondary text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
