"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/lib/hooks/useWallet";
import { useJobsByAddress } from "@/lib/hooks/useJob";
import { truncateAddress, stroopsToUsdc } from "@/lib/stellar";
import { JobStatusBadge } from "@/components/ui/StatusBadge";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorAlert, SuccessAlert } from "@/components/ui/ErrorAlert";
import { UsdcFaucet } from "@/components/UsdcFaucet";
import Link from "next/link";

interface UserProfile {
  walletAddress: string;
  displayName?: string;
  bio?: string;
  feedbackReceived: Array<{
    rating: number;
    comment?: string;
    giverAddress: string;
    createdAt: string;
  }>;
}

export default function ProfilePage() {
  const { address, isConnected, connect } = useWallet();
  const { data: jobs, isLoading: jobsLoading } = useJobsByAddress(address);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!address) return;
    setProfileLoading(true);
    fetch(`/api/users?address=${address}`)
      .then((r) => r.json())
      .then((data) => {
        setProfile(data);
        setDisplayName(data.displayName || "");
        setBio(data.bio || "");
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, [address]);

  const handleSave = async () => {
    if (!address) return;
    setSaveLoading(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address, displayName, bio }),
      });
      if (!res.ok) throw new Error("Failed to save profile.");
      const data = await res.json();
      setProfile((prev) => (prev ? { ...prev, ...data } : data));
      setSaveSuccess(true);
      setEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaveLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-950 border border-indigo-800 flex items-center justify-center text-3xl mb-5">
          🔗
        </div>
        <h1 className="text-2xl font-bold mb-2">Connect your wallet</h1>
        <p className="text-gray-400 mb-7 max-w-sm text-sm">
          Connect your Freighter wallet to view your profile.
        </p>
        <button onClick={connect} className="btn-primary px-7">Connect Wallet</button>
      </div>
    );
  }

  const avgRating =
    profile && profile.feedbackReceived.length > 0
      ? profile.feedbackReceived.reduce((s, f) => s + f.rating, 0) /
        profile.feedbackReceived.length
      : null;

  const completedJobs = jobs?.filter((j) => j.status === "Completed").length ?? 0;
  const totalValue = jobs?.reduce((s, j) => s + j.total_amount, BigInt(0)) ?? BigInt(0);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">My Profile</h1>

      {saveSuccess && (
        <div className="mb-5">
          <SuccessAlert message="Profile updated!" onDismiss={() => setSaveSuccess(false)} />
        </div>
      )}

      {/* ── Profile card ──────────────────────────────────────────────── */}
      <div className="card mb-6 relative overflow-hidden">
        {/* Accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-600 to-purple-500" />

        {profileLoading ? (
          <div className="flex justify-center py-8 mt-2"><Spinner /></div>
        ) : (
          <div className="mt-2">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-700 to-purple-700 flex items-center justify-center text-2xl font-bold text-white shrink-0 shadow-[0_0_20px_rgba(99,102,241,0.3)]">
                  {(profile?.displayName || address || "?")[0].toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  {editing ? (
                    <input
                      type="text"
                      className="input text-sm w-full max-w-xs"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Display name"
                      maxLength={50}
                    />
                  ) : (
                    <div className="font-bold text-white text-lg">
                      {profile?.displayName || "Anonymous"}
                    </div>
                  )}
                  <div className="font-mono text-sm text-gray-500 mt-0.5 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {address ? truncateAddress(address) : ""}
                  </div>

                  {editing ? (
                    <textarea
                      className="input mt-3 resize-none text-sm max-w-sm"
                      rows={2}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Short bio…"
                      maxLength={300}
                    />
                  ) : (
                    profile?.bio && (
                      <p className="mt-2 text-sm text-gray-400 max-w-sm">{profile.bio}</p>
                    )
                  )}

                  {/* Rating */}
                  {avgRating !== null && (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span key={star} className={star <= Math.round(avgRating) ? "text-amber-400" : "text-gray-700"}>
                            ★
                          </span>
                        ))}
                      </div>
                      <span className="text-white font-semibold text-sm">{avgRating.toFixed(1)}</span>
                      <span className="text-gray-500 text-xs">
                        ({profile!.feedbackReceived.length} review{profile!.feedbackReceived.length !== 1 ? "s" : ""})
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Edit controls */}
              <div className="flex gap-2 shrink-0">
                {editing ? (
                  <>
                    <button onClick={handleSave} disabled={saveLoading} className="btn-primary text-sm">
                      {saveLoading ? <><Spinner size="sm" /> Saving…</> : "Save"}
                    </button>
                    <button onClick={() => setEditing(false)} className="btn-secondary text-sm">Cancel</button>
                  </>
                ) : (
                  <button onClick={() => setEditing(true)} className="btn-secondary text-sm">
                    Edit Profile
                  </button>
                )}
              </div>
            </div>

            {saveError && (
              <div className="mt-4">
                <ErrorAlert message={saveError} onDismiss={() => setSaveError(null)} />
              </div>
            )}

            {/* Quick stats */}
            {jobs && jobs.length > 0 && (
              <div className="mt-5 pt-5 border-t border-gray-800 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{jobs.length}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Total jobs</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-400">{completedJobs}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-400">
                    {stroopsToUsdc(totalValue)}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">USDC total</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── USDC Faucet ───────────────────────────────────────────────── */}
      <div className="mb-8">
        <UsdcFaucet />
      </div>

      {/* ── Job history ───────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-7 w-7 rounded-lg bg-indigo-950 border border-indigo-800 flex items-center justify-center text-sm">📋</div>
          <h2 className="text-lg font-semibold">Job History</h2>
        </div>
        {jobsLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : !jobs || jobs.length === 0 ? (
          <div className="card text-center py-10 border-dashed border-gray-700">
            <p className="text-gray-500 text-sm">No jobs yet.</p>
            <Link href="/jobs/new" className="btn-primary text-sm mt-4 inline-flex">
              Post First Job
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <Link
                key={job.id.toString()}
                href={`/jobs/${job.id}`}
                className="card-hover flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div>
                  <span className="font-mono text-sm text-gray-500">Job #{job.id.toString()}</span>
                  <div className="text-sm text-gray-300 mt-0.5">
                    {job.client === address
                      ? `Freelancer: ${truncateAddress(job.freelancer)}`
                      : `Client: ${truncateAddress(job.client)}`}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white text-sm">
                    {stroopsToUsdc(job.total_amount)}{" "}
                    <span className="text-gray-500 font-normal text-xs">USDC</span>
                  </span>
                  <JobStatusBadge status={job.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Feedback received ─────────────────────────────────────────── */}
      {profile && profile.feedbackReceived.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-7 w-7 rounded-lg bg-amber-950 border border-amber-800 flex items-center justify-center text-sm">⭐</div>
            <h2 className="text-lg font-semibold">Feedback Received</h2>
          </div>
          <div className="space-y-3">
            {profile.feedbackReceived.map((f, i) => (
              <div key={i} className="card">
                <div className="flex items-center gap-2 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span key={star} className={`text-lg ${star <= f.rating ? "text-amber-400" : "text-gray-700"}`}>
                      ★
                    </span>
                  ))}
                  <span className="text-xs text-gray-500 ml-1">
                    from{" "}
                    <span className="font-mono">{truncateAddress(f.giverAddress)}</span>
                  </span>
                </div>
                {f.comment && <p className="text-sm text-gray-300">{f.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
