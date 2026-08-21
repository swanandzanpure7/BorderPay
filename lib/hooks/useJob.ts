/**
 * lib/hooks/useJob.ts
 * React Query hooks for fetching job data from the chain.
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getJob,
  listJobsByAddress,
  createJob,
  fundJob,
  submitMilestone,
  approveMilestone,
  rejectMilestone,
  refundJob,
  parseContractError,
  type MilestoneInput,
  type Job,
} from "@/lib/stellar";
import { useWallet } from "./useWallet";
import { useCallback } from "react";
import { trackEvent } from "@/lib/analytics";

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const jobKeys = {
  all: ["jobs"] as const,
  byId: (id: bigint) => ["jobs", id.toString()] as const,
  byAddress: (addr: string) => ["jobs", "byAddress", addr] as const,
  txHistory: (id: bigint) => ["jobs", id.toString(), "txHistory"] as const,
};

// ─── Helper: record tx hash off-chain ────────────────────────────────────────

async function recordTx(
  onChainJobId: string,
  txHash: string,
  action: string,
  actorAddress: string,
  extra?: Record<string, unknown>
) {
  try {
    await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        onChainJobId,
        txHash,
        action,
        actorAddress,
        txMetadata: extra || null,
      }),
    });
  } catch { /* non-fatal */ }
}

// ─── Read Hooks ──────────────────────────────────────────────────────────────

export function useJob(jobId: bigint | null) {
  return useQuery({
    queryKey: jobId ? jobKeys.byId(jobId) : ["jobs", "null"],
    queryFn: () => getJob(jobId!),
    enabled: jobId !== null,
    staleTime: 15_000,
    retry: 2,
  });
}

export function useJobsByAddress(address: string | null) {
  return useQuery({
    queryKey: address ? jobKeys.byAddress(address) : ["jobs", "empty"],
    queryFn: async () => {
      const ids = await listJobsByAddress(address!);
      const jobs = await Promise.all(ids.map((id) => getJob(id)));
      return jobs;
    },
    enabled: !!address,
    staleTime: 30_000,
    retry: 2,
  });
}

export interface TxRecord {
  id: string;
  txHash: string;
  action: string;
  actorAddress: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
}

export function useTxHistory(jobId: bigint | null) {
  return useQuery({
    queryKey: jobId ? jobKeys.txHistory(jobId) : ["jobs", "txHistory", "null"],
    queryFn: async (): Promise<TxRecord[]> => {
      const res = await fetch(`/api/jobs/${jobId!.toString()}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.txHistory || [];
    },
    enabled: jobId !== null,
    staleTime: 10_000,
    retry: 1,
  });
}

// ─── Write Hooks ─────────────────────────────────────────────────────────────

export function useCreateJob() {
  const { address, sign, signAuth } = useWallet();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      freelancer,
      token,
      milestones,
      onStep,
    }: {
      freelancer: string;
      token: string;
      milestones: MilestoneInput[];
      onStep?: (step: "creating" | "funding" | "done") => void;
    }) => {
      if (!address || !sign) throw new Error("Wallet not connected");

      onStep?.("creating");
      const result = await createJob(address, sign, freelancer, token, milestones, signAuth);

      // Sync off-chain metadata (best-effort)
      try {
        await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            onChainJobId: result.jobId.toString(),
            contractId: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID,
            title: `Job #${result.jobId}`,
            clientAddress: address,
            freelancerAddress: freelancer,
            tokenAddress: token,
            totalAmountStroops: milestones.reduce((sum, m) => sum + m.amount, BigInt(0)).toString(),
            milestones: milestones.map((m, i) => ({
              index: i,
              description: m.description,
              amount: m.amount.toString(),
            })),
            createTxHash: result.txHash,
          }),
        });
      } catch { /* Non-fatal */ }

      // Automatically fund the escrow right after creation
      onStep?.("funding");
      const totalAmount = milestones.reduce((sum, m) => sum + m.amount, BigInt(0));
      const fundResult = await fundJob(address, sign, result.jobId, totalAmount, signAuth);

      // Update fund tx hash off-chain (best-effort)
      try {
        await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            onChainJobId: result.jobId.toString(),
            fundTxHash: fundResult.txHash,
          }),
        });
      } catch { /* Non-fatal */ }

      onStep?.("done");
      return { ...result, fundTxHash: fundResult.txHash };
    },
    onSuccess: (data) => {
      trackEvent("job_created", { jobId: data.jobId.toString() });
      trackEvent("job_funded", { jobId: data.jobId.toString() });
      qc.invalidateQueries({ queryKey: ["jobs", "byAddress"] });
    },
    onError: (err) => {
      console.error("createJob error:", parseContractError(err));
    },
  });
}

export function useFundJob() {
  const { address, sign, signAuth } = useWallet();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, amount }: { jobId: bigint; amount: bigint }) => {
      if (!address || !sign) throw new Error("Wallet not connected");
      const result = await fundJob(address, sign, jobId, amount, signAuth);
      await recordTx(jobId.toString(), result.txHash, "fund_job", address, { amount: amount.toString() });
      return result;
    },
    onSuccess: (_data, { jobId }) => {
      trackEvent("job_funded", { jobId: jobId.toString() });
      qc.invalidateQueries({ queryKey: jobKeys.byId(jobId) });
      qc.invalidateQueries({ queryKey: jobKeys.txHistory(jobId) });
    },
    onError: (err) => {
      console.error("fundJob error:", parseContractError(err));
    },
  });
}

export function useSubmitMilestone() {
  const { address, sign, signAuth } = useWallet();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, milestoneIndex }: { jobId: bigint; milestoneIndex: number }) => {
      if (!address || !sign) throw new Error("Wallet not connected");
      const result = await submitMilestone(address, sign, jobId, milestoneIndex, signAuth);
      await recordTx(jobId.toString(), result.txHash, "submit_milestone", address, { milestoneIndex });
      return result;
    },
    onSuccess: (_data, { jobId }) => {
      trackEvent("milestone_submitted", { jobId: jobId.toString() });
      qc.invalidateQueries({ queryKey: jobKeys.byId(jobId) });
      qc.invalidateQueries({ queryKey: jobKeys.txHistory(jobId) });
    },
  });
}

export function useApproveMilestone() {
  const { address, sign, signAuth } = useWallet();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, milestoneIndex }: { jobId: bigint; milestoneIndex: number }) => {
      if (!address || !sign) throw new Error("Wallet not connected");
      const result = await approveMilestone(address, sign, jobId, milestoneIndex, signAuth);
      await recordTx(jobId.toString(), result.txHash, "approve_milestone", address, { milestoneIndex });
      return result;
    },
    onSuccess: (_data, { jobId, milestoneIndex }) => {
      trackEvent("milestone_approved", { jobId: jobId.toString(), milestoneIndex });
      qc.invalidateQueries({ queryKey: jobKeys.byId(jobId) });
      qc.invalidateQueries({ queryKey: jobKeys.txHistory(jobId) });
    },
  });
}

export function useRejectMilestone() {
  const { address, sign, signAuth } = useWallet();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, milestoneIndex, reason }: { jobId: bigint; milestoneIndex: number; reason: string }) => {
      if (!address || !sign) throw new Error("Wallet not connected");
      const result = await rejectMilestone(address, sign, jobId, milestoneIndex, reason, signAuth);
      await recordTx(jobId.toString(), result.txHash, "reject_milestone", address, { milestoneIndex, reason });
      return result;
    },
    onSuccess: (_data, { jobId }) => {
      trackEvent("milestone_rejected", { jobId: jobId.toString() });
      qc.invalidateQueries({ queryKey: jobKeys.byId(jobId) });
      qc.invalidateQueries({ queryKey: jobKeys.txHistory(jobId) });
    },
  });
}

export function useRefundJob() {
  const { address, sign } = useWallet();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId }: { jobId: bigint }) => {
      if (!address || !sign) throw new Error("Wallet not connected");
      const result = await refundJob(address, sign, jobId);
      await recordTx(jobId.toString(), result.txHash, "refund", address);
      return result;
    },
    onSuccess: (_data, { jobId }) => {
      trackEvent("job_refunded", { jobId: jobId.toString() });
      qc.invalidateQueries({ queryKey: jobKeys.byId(jobId) });
      qc.invalidateQueries({ queryKey: jobKeys.txHistory(jobId) });
      qc.invalidateQueries({ queryKey: ["jobs", "byAddress"] });
    },
  });
}
