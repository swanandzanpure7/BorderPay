"use client";

import Link from "next/link";
import { useWallet } from "@/lib/hooks/useWallet";
import { useJobsByAddress } from "@/lib/hooks/useJob";
import { stroopsToUsdc, truncateAddress } from "@/lib/stellar";
import { JobStatusBadge } from "@/components/ui/StatusBadge";
import { Spinner } from "@/components/ui/Spinner";
import type { Job } from "@/lib/stellar";

export default function DashboardPage() {
  const { address, isConnected, connect, isLoading: walletLoading } = useWallet();
  const { data: jobs, isLoading, error, refetch } = useJobsByAddress(address);

  if (!isConnected) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-950 border border-indigo-800 flex items-center justify-center text-3xl mb-5">
          🔗
        </div>
        <h1 className="text-2xl font-bold mb-2">Connect your wallet</h1>
        <p className="text-gray-400 mb-7 max-w-sm text-sm">
          Connect your Freighter wallet to view your jobs and manage milestones.
        </p>
        <button onClick={connect} disabled={walletLoading} className="btn-primary px-7">
          {walletLoading ? <><Spinner size="sm" /> Connecting…</> : "Connect Wallet"}
        </button>
      </div>
    );
  }

  const clientJobs = jobs?.filter((j) => j.client === address) ?? [];
  const freelancerJobs =
    jobs?.filter((j) => j.freelancer === address && j.client !== address) ?? [];

  const totalValue = jobs?.reduce((s, j) => s + j.total_amount, BigInt(0)) ?? BigInt(0);
  const completedCount = jobs?.filter((j) => j.status === "Completed").length ?? 0;
  const activeCount =
    jobs?.filter((j) => j.status === "Funded" || j.status === "InProgress").length ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-500 mt-1 font-mono text-sm">
            {address ? truncateAddress(address) : ""}
          </p>
        </div>
        <Link href="/jobs/new" className="btn-primary self-start sm:self-auto">
          + Post New Job
        </Link>
      </div>

      {/* Summary stats */}
      {!isLoading && jobs && jobs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="stat-card">
            <span className="text-xs text-gray-500">Total jobs</span>
            <span className="text-2xl font-bold text-white">{jobs.length}</span>
          </div>
          <div className="stat-card">
            <span className="text-xs text-gray-500">Total value</span>
            <span className="text-2xl font-bold text-indigo-400">
              {stroopsToUsdc(totalValue)}
              <span className="text-sm font-normal text-gray-500 ml-1">USDC</span>
            </span>
          </div>
          <div className="stat-card">
            <span className="text-xs text-gray-500">Active</span>
            <span className="text-2xl font-bold text-amber-400">{activeCount}</span>
          </div>
          <div className="stat-card">
            <span className="text-xs text-gray-500">Completed</span>
            <span className="text-2xl font-bold text-emerald-400">{completedCount}</span>
          </div>
        </div>
      )}

      {error && !isLoading && (
        <div className="mb-6 rounded-2xl bg-amber-950/30 border border-amber-800/60 px-4 py-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-amber-300">Could not load jobs from Stellar</p>
            <p className="text-xs text-amber-400/70 mt-1">
              The Stellar testnet RPC may be slow. Your jobs are still on-chain.
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="btn-secondary text-xs py-1.5 px-3 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="space-y-10">
          {/* Client Jobs */}
          <section>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-8 w-8 rounded-lg bg-indigo-950 border border-indigo-800 flex items-center justify-center text-sm">
                📋
              </div>
              <h2 className="text-lg font-semibold">
                Jobs You Posted
                <span className="ml-2 text-sm text-gray-500 font-normal">
                  ({clientJobs.length})
                </span>
              </h2>
            </div>
            {clientJobs.length === 0 ? (
              <EmptyState
                icon="📝"
                title="No jobs posted yet"
                description="Create your first job and fund it with USDC to get started."
                action={
                  <Link href="/jobs/new" className="btn-primary text-sm">
                    Post a Job
                  </Link>
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {clientJobs.map((job) => (
                  <JobCard key={job.id.toString()} job={job} role="client" />
                ))}
              </div>
            )}
          </section>

          {/* Freelancer Jobs */}
          <section>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-8 w-8 rounded-lg bg-emerald-950 border border-emerald-800 flex items-center justify-center text-sm">
                💼
              </div>
              <h2 className="text-lg font-semibold">
                Jobs You&apos;re Working On
                <span className="ml-2 text-sm text-gray-500 font-normal">
                  ({freelancerJobs.length})
                </span>
              </h2>
            </div>
            {freelancerJobs.length === 0 ? (
              <EmptyState
                icon="🔍"
                title="No active contracts"
                description="When a client assigns you to a job it will appear here."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {freelancerJobs.map((job) => (
                  <JobCard key={job.id.toString()} job={job} role="freelancer" />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function JobCard({ job, role }: { job: Job; role: "client" | "freelancer" }) {
  const releasedCount = job.milestones.filter((m) => m.status === "Released").length;
  const total = job.milestones.length;
  const pct = total > 0 ? (releasedCount / total) * 100 : 0;

  const isCompleted = job.status === "Completed";
  const isActive = job.status === "Funded" || job.status === "InProgress";

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="card-hover group relative overflow-hidden"
    >
      {/* Subtle top-border accent */}
      <div
        className={`absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl ${
          isCompleted
            ? "bg-gradient-to-r from-emerald-600 to-emerald-400"
            : isActive
            ? "bg-gradient-to-r from-indigo-600 to-indigo-400"
            : "bg-gray-700"
        }`}
      />

      <div className="flex items-start justify-between gap-2 mb-3 mt-1">
        <span className="text-xs text-gray-500 font-mono">Job #{job.id.toString()}</span>
        <JobStatusBadge status={job.status} />
      </div>

      <div className="text-sm text-gray-400 mb-4">
        {role === "client" ? (
          <span>
            Freelancer:{" "}
            <span className="font-mono text-gray-300">{truncateAddress(job.freelancer)}</span>
          </span>
        ) : (
          <span>
            Client:{" "}
            <span className="font-mono text-gray-300">{truncateAddress(job.client)}</span>
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-sm mb-3">
        <span className="font-bold text-white text-base">
          {stroopsToUsdc(job.total_amount)}{" "}
          <span className="text-xs text-gray-500 font-normal">USDC</span>
        </span>
        <span className="text-gray-500 text-xs">
          {releasedCount}/{total} released
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isCompleted ? "bg-emerald-500" : "bg-indigo-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-3 text-xs text-gray-600 group-hover:text-indigo-400 transition-colors text-right">
        View details →
      </div>
    </Link>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center text-center py-12 border-dashed border-gray-700">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="font-semibold text-white mb-1">{title}</h3>
      <p className="text-sm text-gray-500 mb-5 max-w-xs">{description}</p>
      {action}
    </div>
  );
}
