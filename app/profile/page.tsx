"use client";

export const dynamic = 'force-dynamic';

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
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
        <div className="text-5xl mb-4">🔗</div>
        <h1 className="text-2xl font-bold mb-2">Connect your wallet</h1>
        <p className="text-gray-400 mb-6 max-w-sm">
          Connect your Freighter wallet to view your profile.
        </p>
        <button onClick={connect} className="btn-primary">
          Connect Wallet
        </button>
      </div>
    );
  }

  const avgRating =
    profile && profile.feedbackReceived.length > 0
      ? profile.feedbackReceived.reduce((s, f) => s + f.rating, 0) /
        profile.feedbackReceived.length
      : null;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">My Profile</h1>

      {saveSuccess && (
        <div className="mb-4">
          <SuccessAlert message="Profile updated!" onDismiss={() => setSaveSuccess(false)} />
        </div>
      )}

      {/* Profile card */}
      <div className="card mb-6">
        {profileLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="h-12 w-12 rounded-full bg-indigo-800 flex items-center justify-center text-xl font-bold text-indigo-200">
                    {(profile?.displayName || address || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    {editing ? (
                      <input
                        type="text"
                        className="input text-sm w-48"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Display name"
                        maxLength={50}
                      />
                    ) : (
                      <div className="font-semibold text-white">
                        {profile?.displayName || "Anonymous"}
                      </div>
                    )}
                    <div className="font-mono text-sm text-gray-400 mt-0.5">
                      {address ? truncateAddress(address) : ""}
                    </div>
                  </div>
                </div>

                {editing ? (
                  <textarea
                    className="input mt-3 resize-none text-sm"
                    rows={2}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Short bio…"
                    maxLength={300}
                  />
                ) : (
                  profile?.bio && (
                    <p className="mt-3 text-sm text-gray-400">{profile.bio}</p>
                  )
                )}
              </div>

              <div className="flex gap-2">
                {editing ? (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={saveLoading}
                      className="btn-primary text-sm"
                    >
                      {saveLoading ? <><Spinner size="sm" /> Saving…</> : "Save"}
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditing(true)}
                    className="btn-secondary text-sm"
                  >
                    Edit Profile
                  </button>
                )}
              </div>
            </div>

            {saveError && (
              <div className="mt-3">
                <ErrorAlert message={saveError} onDismiss={() => setSaveError(null)} />
              </div>
            )}

            {/* Rating */}
            {avgRating !== null && (
              <div className="mt-4 flex items-center gap-2 text-sm">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className={star <= Math.round(avgRating) ? "text-amber-400" : "text-gray-600"}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <span className="text-white font-medium">{avgRating.toFixed(1)}</span>
                <span className="text-gray-500">
                  ({profile!.feedbackReceived.length} review
                  {profile!.feedbackReceived.length !== 1 ? "s" : ""})
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Testnet USDC Faucet */}
      <div className="mb-6">
        <UsdcFaucet />
      </div>

      {/* Job history */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Job History</h2>
        {jobsLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : !jobs || jobs.length === 0 ? (
          <div className="card text-center py-8 border-dashed">
            <p className="text-gray-500">No jobs yet.</p>
            <Link href="/jobs/new" className="btn-primary text-sm mt-3 inline-flex">
              Post First Job
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <Link
                key={job.id.toString()}
                href={`/jobs/${job.id}`}
                className="card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-indigo-700/50 transition-colors"
              >
                <div>
                  <span className="font-mono text-sm text-gray-400">
                    Job #{job.id.toString()}
                  </span>
                  <div className="text-sm text-gray-300 mt-0.5">
                    {job.client === address
                      ? `Freelancer: ${truncateAddress(job.freelancer)}`
                      : `Client: ${truncateAddress(job.client)}`}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-white font-medium text-sm">
                    {stroopsToUsdc(job.total_amount)} USDC
                  </span>
                  <JobStatusBadge status={job.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Feedback received */}
      {profile && profile.feedbackReceived.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Feedback Received</h2>
          <div className="space-y-3">
            {profile.feedbackReceived.map((f, i) => (
              <div key={i} className="card">
                <div className="flex items-center gap-2 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className={`text-lg ${star <= f.rating ? "text-amber-400" : "text-gray-600"}`}
                    >
                      ★
                    </span>
                  ))}
                  <span className="text-xs text-gray-500 ml-1">
                    from {truncateAddress(f.giverAddress)}
                  </span>
                </div>
                {f.comment && (
                  <p className="text-sm text-gray-300">{f.comment}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
