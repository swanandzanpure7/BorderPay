"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { ESCROW_CONTRACT_ID, RPC_URL } from "@/lib/stellar";

interface StatusData {
  timestamp: string;
  network: string;
  contractId: string;
  jobs?: {
    total: number;
    byStatus: Array<{ status: string; count: number }>;
  };
  feedback?: {
    count: number;
    avgRating: number | null;
  };
  recentTransactions?: Array<{
    txHash: string;
    action: string;
    actorAddress: string;
    createdAt: string;
  }>;
  error?: string;
}

interface FeedbackStats {
  count: number;
  avgRating: number;
  distribution: Array<{ star: number; count: number }>;
  sampleComments: Array<{ rating: number; comment: string; createdAt: string }>;
}

export default function StatusPage() {
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [feedbackData, setFeedbackData] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/status").then((r) => r.json()),
      fetch("/api/feedback").then((r) => r.json()),
    ])
      .then(([status, feedback]) => {
        setStatusData(status);
        setFeedbackData(feedback);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Platform Status</h1>
        <span className="flex items-center gap-1.5 text-sm text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Live
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <div className="space-y-6">
          {/* Contract info */}
          <div className="card">
            <h2 className="font-semibold mb-4 text-lg">Contract & Network</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <InfoRow label="Network" value={statusData?.network || "testnet"} />
              <InfoRow
                label="Contract ID"
                value={ESCROW_CONTRACT_ID || "Not configured"}
                mono
                truncate
              />
              <InfoRow label="RPC URL" value={RPC_URL} mono truncate />
              <InfoRow
                label="Last checked"
                value={
                  statusData?.timestamp
                    ? new Date(statusData.timestamp).toLocaleTimeString()
                    : "—"
                }
              />
            </div>
            {statusData?.error && (
              <div className="mt-4 text-sm text-amber-400 bg-amber-900/20 rounded-lg px-3 py-2">
                ⚠ {statusData.error}
              </div>
            )}
          </div>

          {/* Job stats */}
          {statusData?.jobs && (
            <div className="card">
              <h2 className="font-semibold mb-4 text-lg">Job Statistics</h2>
              <div className="text-4xl font-bold text-indigo-400 mb-4">
                {statusData.jobs.total}
                <span className="text-xl font-normal text-gray-400 ml-2">total jobs</span>
              </div>
              {statusData.jobs.byStatus.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {statusData.jobs.byStatus.map((s) => (
                    <div key={s.status} className="bg-gray-800/50 rounded-lg px-3 py-2">
                      <div className="text-lg font-bold text-white">{s.count}</div>
                      <div className="text-xs text-gray-400">{s.status}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Feedback summary — required by spec */}
          <div className="card">
            <h2 className="font-semibold mb-4 text-lg">User Feedback Summary</h2>
            {!feedbackData || feedbackData.count === 0 ? (
              <p className="text-gray-500 text-sm">No feedback submitted yet.</p>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-6">
                  <div className="text-center">
                    <div className="text-5xl font-bold text-amber-400">
                      {feedbackData.avgRating.toFixed(1)}
                    </div>
                    <div className="flex justify-center mt-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={`text-xl ${
                            star <= Math.round(feedbackData.avgRating)
                              ? "text-amber-400"
                              : "text-gray-600"
                          }`}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {feedbackData.count} review{feedbackData.count !== 1 ? "s" : ""}
                    </div>
                  </div>

                  {/* Distribution */}
                  <div className="flex-1 space-y-1.5">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const entry = feedbackData.distribution.find((d) => d.star === star);
                      const pct =
                        feedbackData.count > 0
                          ? ((entry?.count || 0) / feedbackData.count) * 100
                          : 0;
                      return (
                        <div key={star} className="flex items-center gap-2 text-xs">
                          <span className="w-4 text-right text-gray-400">{star}★</span>
                          <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-400 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-6 text-gray-400">{entry?.count || 0}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Sample comments */}
                {feedbackData.sampleComments.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Comments</h3>
                    <div className="space-y-2">
                      {feedbackData.sampleComments.map((c, i) => (
                        <div key={i} className="bg-gray-800/40 rounded-lg px-3 py-2.5">
                          <div className="flex items-center gap-1 mb-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                className={`text-sm ${
                                  star <= c.rating ? "text-amber-400" : "text-gray-600"
                                }`}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                          <p className="text-sm text-gray-300">{c.comment}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Recent transactions */}
          {statusData?.recentTransactions && statusData.recentTransactions.length > 0 && (
            <div className="card">
              <h2 className="font-semibold mb-4 text-lg">Recent On-Chain Activity</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-800">
                      <th className="pb-2 pr-4">Action</th>
                      <th className="pb-2 pr-4">Actor</th>
                      <th className="pb-2">Tx Hash</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {statusData.recentTransactions.map((tx) => (
                      <tr key={tx.txHash} className="text-gray-300">
                        <td className="py-2 pr-4 font-mono text-xs">{tx.action}</td>
                        <td className="py-2 pr-4 font-mono text-xs">
                          {tx.actorAddress.slice(0, 8)}…
                        </td>
                        <td className="py-2">
                          <a
                            href={`https://stellar.expert/explorer/testnet/tx/${tx.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs text-indigo-400 hover:underline"
                          >
                            {tx.txHash.slice(0, 10)}…
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
  truncate,
}: {
  label: string;
  value: string;
  mono?: boolean;
  truncate?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div
        className={`${mono ? "font-mono" : ""} ${
          truncate ? "truncate max-w-xs" : ""
        } text-white`}
        title={truncate ? value : undefined}
      >
        {value}
      </div>
    </div>
  );
}
