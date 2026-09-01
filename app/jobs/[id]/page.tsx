"use client";

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
  type JobStatus,
  type MilestoneStatus,
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

  useEffect(() => {
    if (job?.status === "Completed" && (isClient || isFreelancer)) {
      setShowFeedback(true);
    }
  }, [job?.status, isClient, isFreelancer]);

  const handleSuccess = (msg: string, txHash?: string) => {
    setSuccessMsg(txHash ? `${msg} · Tx: ${txHash.slice(0, 10)}…` : msg);
    refetch();
    setTimeout(() => setSuccessMsg(null), 8000);
  };

  const handleError = (err: unknown) => {
    console.error("[BorderPay] raw error:", err instanceof Error ? err.message : String(err));
    setActionError(parseContractError(err));
  };

  const handleFund = async () => {
    if (!job || !jobId) return;
    setActionError(null);
    try {
      const { txHash } = await fundJob.mutateAsync({ jobId, amount: job.total_amount });
      handleSuccess("Job funded — escrow is active!", txHash);
    } catch (err) { handleError(err); }
  };

  const handleSubmit = async (index: number) => {
    if (!jobId) return;
    setActionError(null);
    try {
      const { txHash } = await submitMilestone.mutateAsync({ jobId, milestoneIndex: index });
      handleSuccess(`Milestone ${index + 1} submitted for review.`, txHash);
    } catch (err) { handleError(err); }
  };

  const handleApprove = async (index: number) => {
    if (!jobId) return;
    setActionError(null);
    try {
      const { txHash } = await approveMilestone.mutateAsync({ jobId, milestoneIndex: index });
      handleSuccess(`Milestone ${index + 1} approved — funds released!`, txHash);
    } catch (err) { handleError(err); }
  };

  const handleReject = async (index: number) => {
    if (!jobId) return;
    if (!rejectReason.trim()) { setActionError("Please provide a reason for the dispute."); return; }
    setActionError(null);
    try {
      const { txHash } = await rejectMilestone.mutateAsync({ jobId, milestoneIndex: index, reason: rejectReason });
      handleSuccess(`Milestone ${index + 1} disputed.`, txHash);
      setRejectReason("");
      setRejectingIndex(null);
    } catch (err) { handleError(err); }
  };

  const handleRefund = async () => {
    if (!jobId) return;
    setActionError(null);
    try {
      const { refundAmount, txHash } = await refundJob.mutateAsync({ jobId });
      handleSuccess(`Refund of ${stroopsToUsdc(refundAmount)} USDC returned to your wallet.`, txHash);
    } catch (err) { handleError(err); }
  };

  const anyLoading =
    fundJob.isPending || submitMilestone.isPending ||
    approveMilestone.isPending || rejectMilestone.isPending || refundJob.isPending;

  // ── Loading / error states ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-700 flex items-center justify-center text-3xl mx-auto mb-5">
          🔍
        </div>
        <h1 className="text-xl font-bold mb-2">Job not found</h1>
        <p className="text-gray-400 mb-6 text-sm">
          This job ID doesn&apos;t exist on-chain, or the contract isn&apos;t configured.
        </p>
        <Link href="/dashboard" className="btn-secondary">← Back to Dashboard</Link>
      </div>
    );
  }

  const releasedCount = job.milestones.filter((m) => m.status === "Released").length;
  const releasedValue = job.milestones
    .filter((m) => m.status === "Released")
    .reduce((sum, m) => sum + m.amount, BigInt(0));
  const pct = job.milestones.length > 0 ? (releasedCount / job.milestones.length) * 100 : 0;
  const isCompleted = job.status === "Completed";
  const isCancelled = job.status === "Cancelled";

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Back */}
      <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
        ← Dashboard
      </Link>

      {/* ── Header card ──────────────────────────────────────────────── */}
      <div className="mt-5 card relative overflow-hidden mb-6">
        {/* Accent bar */}
        <div
          className={`absolute top-0 left-0 right-0 h-1 ${
            isCompleted
              ? "bg-gradient-to-r from-emerald-600 to-emerald-400"
              : isCancelled
              ? "bg-gradient-to-r from-red-700 to-red-500"
              : job.status === "Funded" || job.status === "InProgress"
              ? "bg-gradient-to-r from-indigo-600 to-indigo-400"
              : "bg-gray-700"
          }`}
        />
        <div className="pt-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">Job #{job.id.toString()}</h1>
              <JobStatusBadge status={job.status} />
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 uppercase tracking-wide font-medium w-20 shrink-0">Client</span>
                <span className="font-mono text-gray-300">{truncateAddress(job.client)}</span>
                {isClient && (
                  <span className="text-xs bg-indigo-950 border border-indigo-800 text-indigo-400 px-1.5 py-0.5 rounded-full">you</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 uppercase tracking-wide font-medium w-20 shrink-0">Freelancer</span>
                <span className="font-mono text-gray-300">{truncateAddress(job.freelancer)}</span>
                {isFreelancer && (
                  <span className="text-xs bg-indigo-950 border border-indigo-800 text-indigo-400 px-1.5 py-0.5 rounded-full">you</span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 shrink-0">
            {isClient && job.status === "Created" && (
              <button onClick={handleFund} disabled={anyLoading} className="btn-primary">
                {fundJob.isPending ? (
                  <><Spinner size="sm" /> Depositing…</>
                ) : (
                  `Deposit ${stroopsToUsdc(job.total_amount)} USDC`
                )}
              </button>
            )}
            {isClient && (job.status === "Funded" || job.status === "InProgress") && (
              <button onClick={handleRefund} disabled={anyLoading} className="btn-danger text-sm">
                {refundJob.isPending ? <><Spinner size="sm" /> Refunding…</> : "Cancel & Refund"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Alerts ───────────────────────────────────────────────────── */}
      <div className="space-y-3 mb-6">
        {actionError && <ErrorAlert message={actionError} onDismiss={() => setActionError(null)} />}
        {successMsg && <SuccessAlert message={successMsg} onDismiss={() => setSuccessMsg(null)} />}
        {!address && (
          <div className="rounded-xl bg-amber-950/30 border border-amber-800/60 px-4 py-3 text-sm text-amber-300 flex items-start gap-2">
            <span className="mt-0.5">⚠</span>
            <span>Connect your wallet to interact with this job.</span>
          </div>
        )}
        {isClient && job.status === "InProgress" && (
          <div className="rounded-xl bg-amber-950/30 border border-amber-800/60 px-4 py-3 text-sm text-amber-300 flex items-start gap-2">
            <span className="mt-0.5">⚠</span>
            <span>
              Before approving, ensure the freelancer has a USDC trustline.
              Ask them to visit <strong>/profile</strong> → <strong>Get Test USDC</strong>.
            </span>
          </div>
        )}
        {address && !isClient && !isFreelancer && (
          <div className="rounded-xl bg-gray-800/60 border border-gray-700 px-4 py-3 text-sm text-gray-400">
            Viewing as guest.{" "}
            <span className="font-mono text-xs text-gray-500">{truncateAddress(address)}</span>
          </div>
        )}
        {address && isClient && !isFreelancer && (
          <div className="rounded-xl bg-blue-950/30 border border-blue-800/50 px-4 py-3 text-sm text-blue-300 flex items-start gap-2">
            <span className="mt-0.5">💡</span>
            <span>
              To submit milestones, switch Freighter to the freelancer account:{" "}
              <span className="font-mono text-xs text-blue-400 break-all">{job.freelancer}</span>
            </span>
          </div>
        )}
      </div>

      {/* ── Stats row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="stat-card">
          <span className="text-xs text-gray-500">Total Value</span>
          <span className="text-lg font-bold text-white">{stroopsToUsdc(job.total_amount)}</span>
          <span className="text-xs text-gray-600">USDC</span>
        </div>
        <div className="stat-card">
          <span className="text-xs text-gray-500">Released</span>
          <span className="text-lg font-bold text-emerald-400">{stroopsToUsdc(releasedValue)}</span>
          <span className="text-xs text-gray-600">USDC</span>
        </div>
        <div className="stat-card">
          <span className="text-xs text-gray-500">Milestones</span>
          <span className="text-lg font-bold text-white">
            {releasedCount}
            <span className="text-gray-600 text-sm font-normal">/{job.milestones.length}</span>
          </span>
          <span className="text-xs text-gray-600">released</span>
        </div>
        <div className="stat-card">
          <span className="text-xs text-gray-500">Status</span>
          <span className="mt-1"><JobStatusBadge status={job.status} /></span>
        </div>
      </div>

      {/* ── Progress bar ──────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>Escrow progress</span>
          <span>{Math.round(pct)}% released</span>
        </div>
        <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              isCompleted ? "bg-gradient-to-r from-emerald-600 to-emerald-400" : "bg-gradient-to-r from-indigo-600 to-indigo-400"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* ── Milestones ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4">
        <div className="h-7 w-7 rounded-lg bg-indigo-950 border border-indigo-800 flex items-center justify-center text-sm">🎯</div>
        <h2 className="text-lg font-semibold">Milestones</h2>
      </div>
      <div className="space-y-3 mb-10">
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
            onStartReject={() => { setRejectingIndex(milestone.index); setActionError(null); }}
            onConfirmReject={() => handleReject(milestone.index)}
            onCancelReject={() => { setRejectingIndex(null); setRejectReason(""); }}
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

      {/* ── Proof of interactions ─────────────────────────────────────── */}
      {(isCompleted || isCancelled) && txHistory.length > 0 && (
        <div className="mb-10 rounded-2xl border border-emerald-800/60 bg-emerald-950/20 p-5">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-7 h-7 rounded-lg bg-emerald-950 border border-emerald-800 flex items-center justify-center text-sm">✅</span>
            <h2 className="text-base font-semibold text-emerald-300">
              Job {job.status} — On-chain Proof
            </h2>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="grid grid-cols-3 gap-3 text-xs text-gray-600 font-medium uppercase tracking-wide pb-2 border-b border-emerald-900/40">
              <span>Action</span>
              <span>Wallet</span>
              <span>Transaction</span>
            </div>
            {txHistory.map((tx) => (
              <div
                key={tx.id}
                className="grid grid-cols-3 gap-3 items-center py-2 border-b border-emerald-900/20"
              >
                <span className="text-emerald-300 font-medium capitalize text-xs">
                  {tx.action.replace(/_/g, " ")}
                </span>
                <span className="font-mono text-xs text-gray-500">
                  {tx.actorAddress.slice(0, 6)}…{tx.actorAddress.slice(-4)}
                </span>
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${tx.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-indigo-400 hover:text-indigo-300 hover:underline"
                >
                  {tx.txHash.slice(0, 8)}… ↗
                </a>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-emerald-900/40 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-gray-600 mb-0.5">Client</p>
              <p className="font-mono text-gray-400 break-all">{job.client}</p>
            </div>
            <div>
              <p className="text-gray-600 mb-0.5">Freelancer</p>
              <p className="font-mono text-gray-400 break-all">{job.freelancer}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-600">
            Contract:{" "}
            <span className="font-mono">{process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID}</span>
          </p>
        </div>
      )}

      {/* ── Transaction history ───────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-7 w-7 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-sm">🔗</div>
          <h2 className="text-lg font-semibold">Transaction History</h2>
        </div>
        {txHistory.length === 0 ? (
          <div className="card text-center py-8 border-dashed border-gray-700">
            <p className="text-sm text-gray-500">No transactions recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/60">
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">Action</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">Tx Hash</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">Signed by</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">Time</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
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

// ─── MilestoneCard ────────────────────────────────────────────────────────────

interface MilestoneCardProps {
  milestone: Milestone;
  isClient: boolean;
  isFreelancer: boolean;
  jobStatus: JobStatus;
  anyLoading: boolean;
  rejectingIndex: number | null;
  rejectReason: string;
  onSubmit: () => void;
  onApprove: () => void;
  onStartReject: () => void;
  onConfirmReject: () => void;
  onCancelReject: () => void;
  onRejectReasonChange: (v: string) => void;
  submitPending: boolean;
  approvePending: boolean;
  rejectPending: boolean;
}

const MILESTONE_LEFT_COLORS: Record<MilestoneStatus, string> = {
  Pending:   "bg-gray-600",
  Submitted: "bg-blue-500",
  Approved:  "bg-indigo-500",
  Released:  "bg-emerald-500",
  Refunded:  "bg-amber-500",
  Disputed:  "bg-red-500",
};

function MilestoneCard({
  milestone, isClient, isFreelancer, jobStatus, anyLoading,
  rejectingIndex, rejectReason,
  onSubmit, onApprove, onStartReject, onConfirmReject, onCancelReject,
  onRejectReasonChange, submitPending, approvePending, rejectPending,
}: MilestoneCardProps) {
  const isJobActive = jobStatus === "Funded" || jobStatus === "InProgress";
  const isRejecting = rejectingIndex === milestone.index;

  return (
    <div className={`card relative overflow-hidden transition-colors ${
      milestone.status === "Released" ? "border-emerald-900/40 bg-emerald-950/10" :
      milestone.status === "Disputed" ? "border-red-900/40 bg-red-950/10" :
      milestone.status === "Submitted" ? "border-blue-900/40" : ""
    }`}>
      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${MILESTONE_LEFT_COLORS[milestone.status]}`} />

      <div className="pl-3">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <span className="w-7 h-7 shrink-0 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-bold text-gray-400">
              {milestone.index + 1}
            </span>
            <p className="font-medium text-white text-sm truncate">{milestone.description}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-bold text-base text-white">
              {stroopsToUsdc(milestone.amount)}
              <span className="text-xs text-gray-500 font-normal ml-1">USDC</span>
            </span>
            <MilestoneStatusBadge status={milestone.status} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {/* Freelancer: submit */}
          {isFreelancer && isJobActive && milestone.status === "Pending" && (
            <button
              onClick={onSubmit}
              disabled={anyLoading}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              {submitPending ? <><Spinner size="sm" /> Submitting…</> : "Submit for Review"}
            </button>
          )}

          {/* Client: approve + dispute */}
          {isClient && milestone.status === "Submitted" && (
            <>
              <button
                onClick={onApprove}
                disabled={anyLoading}
                className="btn-success text-xs py-1.5 px-3"
              >
                {approvePending ? <><Spinner size="sm" /> Releasing…</> : "✓ Approve & Release"}
              </button>
              {!isRejecting && (
                <button
                  onClick={onStartReject}
                  disabled={anyLoading}
                  className="btn-danger text-xs py-1.5 px-3"
                >
                  Dispute
                </button>
              )}
            </>
          )}
        </div>

        {/* Dispute inline form */}
        {isRejecting && (
          <div className="mt-3 rounded-xl bg-red-950/30 border border-red-900/50 p-3">
            <p className="text-xs text-red-300 font-medium mb-2">Dispute reason</p>
            <textarea
              className="input text-sm resize-none bg-red-950/30 border-red-900/50 text-red-100 placeholder-red-800"
              rows={2}
              placeholder="Describe the issue with this milestone's deliverable…"
              value={rejectReason}
              onChange={(e) => onRejectReasonChange(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={onConfirmReject}
                disabled={anyLoading || !rejectReason.trim()}
                className="btn-danger text-xs py-1.5 px-3"
              >
                {rejectPending ? <><Spinner size="sm" /> Disputing…</> : "Confirm Dispute"}
              </button>
              <button onClick={onCancelReject} className="btn-secondary text-xs py-1.5 px-3">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Released indicator */}
        {milestone.status === "Released" && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
            <span>✓</span>
            <span>{stroopsToUsdc(milestone.amount)} USDC released to freelancer</span>
          </div>
        )}
        {milestone.status === "Disputed" && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
            <span>⚠</span>
            <span>Funds locked — dispute in progress</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── StatCard ────────────────────────────────────────────────────────────────
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="font-semibold text-white text-sm">{value}</span>
    </div>
  );
}

// ─── Action label + colour map ────────────────────────────────────────────────
const ACTION_LABELS: Record<string, { label: string; colour: string }> = {
  create_job:        { label: "Create Job",        colour: "text-indigo-400 bg-indigo-950/50 border-indigo-800" },
  fund_job:          { label: "Fund Escrow",        colour: "text-emerald-400 bg-emerald-950/50 border-emerald-800" },
  submit_milestone:  { label: "Submit Milestone",   colour: "text-blue-400 bg-blue-950/50 border-blue-800" },
  approve_milestone: { label: "Approve & Release",  colour: "text-green-400 bg-green-950/50 border-green-800" },
  reject_milestone:  { label: "Dispute Milestone",  colour: "text-amber-400 bg-amber-950/50 border-amber-800" },
  refund:            { label: "Refund",             colour: "text-red-400 bg-red-950/50 border-red-800" },
};

function TxRow({ tx }: { tx: TxRecord }) {
  const meta = ACTION_LABELS[tx.action] ?? {
    label: tx.action,
    colour: "text-gray-400 bg-gray-800/50 border-gray-700",
  };
  const timeStr = new Date(tx.createdAt).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <tr className="hover:bg-gray-900/30 transition-colors">
      <td className="px-4 py-3">
        <span className={`inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-semibold ${meta.colour}`}>
          {meta.label}
        </span>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-gray-300">
        {tx.txHash.slice(0, 8)}…{tx.txHash.slice(-6)}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-gray-500">
        {tx.actorAddress.slice(0, 6)}…{tx.actorAddress.slice(-4)}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{timeStr}</td>
      <td className="px-4 py-3 text-right">
        <a
          href={`https://stellar.expert/explorer/testnet/tx/${tx.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline"
        >
          Explorer ↗
        </a>
      </td>
    </tr>
  );
}
