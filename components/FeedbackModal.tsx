"use client";

import { useState } from "react";
import { ErrorAlert, SuccessAlert } from "./ui/ErrorAlert";
import { Spinner } from "./ui/Spinner";

interface Props {
  jobId: string;
  giverAddress: string;
  receiverAddress: string;
  onClose: () => void;
}

export function FeedbackModal({ jobId, giverAddress, receiverAddress, onClose }: Props) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError("Please select a rating.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, giverAddress, receiverAddress, rating, comment }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to submit feedback.");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit feedback.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-title"
    >
      <div className="card w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-200 text-xl"
          aria-label="Close feedback modal"
        >
          ✕
        </button>

        {submitted ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">🎉</div>
            <h2 className="text-xl font-bold mb-2">Thanks for your feedback!</h2>
            <p className="text-gray-400 text-sm mb-4">Your rating has been recorded.</p>
            <button onClick={onClose} className="btn-primary">
              Close
            </button>
          </div>
        ) : (
          <>
            <h2 id="feedback-title" className="text-xl font-bold mb-1">
              How did it go?
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              Rate your experience for Job #{jobId}
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Star rating */}
              <div>
                <label className="label">Rating</label>
                <div className="flex gap-1" role="radiogroup" aria-label="Rating stars">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className={`text-3xl transition-transform hover:scale-110 ${
                        star <= rating ? "text-amber-400" : "text-gray-600"
                      }`}
                      aria-label={`${star} star${star > 1 ? "s" : ""}`}
                      aria-pressed={star <= rating}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment */}
              <div>
                <label htmlFor="feedback-comment" className="label">
                  Comment <span className="text-gray-500 font-normal">(optional)</span>
                </label>
                <textarea
                  id="feedback-comment"
                  className="input resize-none"
                  rows={3}
                  placeholder="Share your experience…"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={500}
                />
                <p className="text-xs text-gray-600 mt-1 text-right">
                  {comment.length}/500
                </p>
              </div>

              {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting || rating === 0}
                  className="btn-primary flex-1"
                >
                  {submitting ? (
                    <><Spinner size="sm" /> Submitting…</>
                  ) : (
                    "Submit Feedback"
                  )}
                </button>
                <button type="button" onClick={onClose} className="btn-secondary">
                  Skip
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
