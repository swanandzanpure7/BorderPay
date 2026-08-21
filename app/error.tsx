"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="text-5xl mb-4">⚠️</div>
      <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
      <p className="text-gray-400 mb-2 max-w-sm">
        An unexpected error occurred. It has been reported automatically.
      </p>
      {error.digest && (
        <p className="text-xs text-gray-600 mb-6 font-mono">Error ID: {error.digest}</p>
      )}
      <button onClick={reset} className="btn-primary">
        Try Again
      </button>
    </div>
  );
}
