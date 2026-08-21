/**
 * lib/analytics.ts
 * PostHog analytics event tracking wrapper.
 */

import posthog from "posthog-js";

let initialized = false;

export function initAnalytics() {
  if (typeof window === "undefined" || initialized) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";
  if (!key) return;
  posthog.init(key, {
    api_host: host,
    capture_pageview: false, // handle manually
    loaded: (ph) => {
      if (process.env.NODE_ENV === "development") {
        ph.debug();
      }
    },
  });
  initialized = true;
}

export function trackEvent(
  event: string,
  properties?: Record<string, unknown>
) {
  if (typeof window === "undefined") return;
  try {
    posthog.capture(event, properties);
  } catch {
    // Never let analytics crash the app
  }
}

export function trackPageView(url: string) {
  if (typeof window === "undefined") return;
  try {
    posthog.capture("$pageview", { $current_url: url });
  } catch { /* ignore */ }
}

export function identifyUser(address: string) {
  if (typeof window === "undefined") return;
  try {
    posthog.identify(address, { wallet_address: address });
    trackEvent("wallet_connected", { address });
  } catch { /* ignore */ }
}
