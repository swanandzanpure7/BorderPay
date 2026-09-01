import type { JobStatus, MilestoneStatus } from "@/lib/stellar";

const jobStyles: Record<JobStatus, { dot: string; badge: string }> = {
  Created:    { dot: "bg-gray-400",    badge: "bg-gray-800 text-gray-300 border-gray-700" },
  Funded:     { dot: "bg-blue-400",    badge: "bg-blue-950/60 text-blue-300 border-blue-800" },
  InProgress: { dot: "bg-amber-400",   badge: "bg-amber-950/60 text-amber-300 border-amber-800" },
  Completed:  { dot: "bg-emerald-400", badge: "bg-emerald-950/60 text-emerald-300 border-emerald-800" },
  Cancelled:  { dot: "bg-red-500",     badge: "bg-red-950/60 text-red-300 border-red-800" },
};

const milestoneStyles: Record<MilestoneStatus, { dot: string; badge: string }> = {
  Pending:   { dot: "bg-gray-400",    badge: "bg-gray-800 text-gray-300 border-gray-700" },
  Submitted: { dot: "bg-blue-400",    badge: "bg-blue-950/60 text-blue-300 border-blue-800" },
  Approved:  { dot: "bg-indigo-400",  badge: "bg-indigo-950/60 text-indigo-300 border-indigo-800" },
  Released:  { dot: "bg-emerald-400", badge: "bg-emerald-950/60 text-emerald-300 border-emerald-800" },
  Refunded:  { dot: "bg-amber-400",   badge: "bg-amber-950/60 text-amber-300 border-amber-800" },
  Disputed:  { dot: "bg-red-500",     badge: "bg-red-950/60 text-red-300 border-red-800" },
};

const jobLabels: Record<JobStatus, string> = {
  Created: "Created",
  Funded: "Funded",
  InProgress: "In Progress",
  Completed: "Completed",
  Cancelled: "Cancelled",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const s = jobStyles[status];
  return (
    <span className={`status-badge ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot} ${status === "InProgress" ? "animate-pulse" : ""}`} />
      {jobLabels[status]}
    </span>
  );
}

export function MilestoneStatusBadge({ status }: { status: MilestoneStatus }) {
  const s = milestoneStyles[status];
  return (
    <span className={`status-badge ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
      {status}
    </span>
  );
}
