"use client";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Link from "next/link";
import { useWallet } from "@/lib/hooks/useWallet";
import { useJobsByAddress } from "@/lib/hooks/useJob";
import { stroopsToUsdc, truncateAddress } from "@/lib/stellar";
import { JobStatusBadge } from "@/components/ui/StatusBadge";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import type { Job } from "@/lib/stellar";

export default function DashboardPage() {
  const { address, isConnected, connect, isLoading: walletLoading } = useWallet();
  const { data: jobs, isLoading, error, refetch } = useJobsByAddress(address);

  if (!isConnected) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
        <div className="text-5xl mb-4">🔗</div>
        <h1 className="text-2xl font-bold mb-2">Connect your wallet</h1>
        <p className="text-gray-400 mb-6 max-w-sm">
          Connect your Freighter wallet to view your jobs and manage milestones.
        </p>
        <button
          onClick={connect}
          disabled={walletLoading}
          className="btn-primary"
        >
          {walletLoading ? <><Spinner size="sm" /> Connecting…</> : "Connect Wallet"}
        </button>
      </div>
    );
  }

  const clientJobs = jobs?.filter((j) => j.client === address) ?? [];
  const freelancerJobs = jobs?.filter((j) => j.freelancer === address && j.client !== address) ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">
            {address ? truncateAddress(address) : ""}
          </p>
        </div>
        <Link href="/jobs/new" className="btn-primary self-start sm:self-auto">
          + Post New Job
        </Link>
      </div>

      {error && (
        <div className="mb-6">
          <ErrorAlert
            message="Failed to load jobs from chain. Check your connection."
            onDismiss={() => refetch()}
          />
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Client Jobs */}
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="text-indigo-400">📋</span> Jobs You Posted
              <span className="text-sm text-gray-500 font-normal">({clientJobs.length})</span>
            </h2>
            {clientJobs.length === 0 ? (
              <EmptyState
                icon="📝"
                title="No jobs posted yet"
                description="Create your first job and fund it with USDC to get started."
                action={<Link href="/jobs/new" className="btn-primary text-sm">Post a Job</Link>}
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
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="text-emerald-400">💼</span> Jobs You're Working On
              <span className="text-sm text-gray-500 font-normal">({freelancerJobs.length})</span>
            </h2>
            {freelancerJobs.length === 0 ? (
              <EmptyState
                icon="🔍"
                title="No active contracts"
                description="When a client assigns you to a job, it will appear here."
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

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="card hover:border-indigo-700/50 transition-colors block"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-xs text-gray-500 font-mono">Job #{job.id.toString()}</span>
        <JobStatusBadge status={job.status} />
      </div>
      <div className="text-sm text-gray-400 mb-3">
        {role === "client" ? (
          <span>Freelancer: <span className="font-mono">{truncateAddress(job.freelancer)}</span></span>
        ) : (
          <span>Client: <span className="font-mono">{truncateAddress(job.client)}</span></span>
        )}
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-white font-medium">{stroopsToUsdc(job.total_amount)} USDC</span>
        <span className="text-gray-500">{releasedCount}/{total} milestones</span>
      </div>
      {/* Progress bar */}
      <div className="mt-3 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all"
          style={{ width: `${total > 0 ? (releasedCount / total) * 100 : 0}%` }}
        />
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
    <div className="card flex flex-col items-center text-center py-10 border-dashed">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="font-medium text-white mb-1">{title}</h3>
      <p className="text-sm text-gray-500 mb-4 max-w-xs">{description}</p>
      {action}
    </div>
  );
}
