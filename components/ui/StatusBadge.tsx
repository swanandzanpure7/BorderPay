import type { JobStatus, MilestoneStatus } from "@/lib/stellar";

const jobColors: Record<JobStatus, string> = {
  Created: "bg-gray-700 text-gray-300",
  Funded: "bg-blue-900/50 text-blue-300",
  InProgress: "bg-amber-900/50 text-amber-300",
  Completed: "bg-emerald-900/50 text-emerald-300",
  Cancelled: "bg-red-900/50 text-red-300",
};

const milestoneColors: Record<MilestoneStatus, string> = {
  Pending: "bg-gray-700 text-gray-300",
  Submitted: "bg-blue-900/50 text-blue-300",
  Approved: "bg-indigo-900/50 text-indigo-300",
  Released: "bg-emerald-900/50 text-emerald-300",
  Refunded: "bg-amber-900/50 text-amber-300",
  Disputed: "bg-red-900/50 text-red-300",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={`status-badge ${jobColors[status]}`}>{status}</span>
  );
}

export function MilestoneStatusBadge({ status }: { status: MilestoneStatus }) {
  return (
    <span className={`status-badge ${milestoneColors[status]}`}>{status}</span>
  );
}
