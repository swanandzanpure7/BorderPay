"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { create } from "zustand";
import { NETWORK_PASSPHRASE } from "@/lib/stellar";

// ─── Zustand store ────────────────────────────────────────────────────────────
// ALL state lives here — shared across every component that calls useWallet().
// This prevents the "each component has its own isInstalled check" race condition.

interface WalletState {
  address: string | null;
  networkPassphrase: string | null;
  isConnected: boolean;
  isLoading: boolean;
  isRestoring: boolean;      // true while the auto-restore is in progress
  freighterInstalled: boolean | null; // null = not yet checked
  error: string | null;
  setAddress: (a: string | null) => void;
  setNetworkPassphrase: (n: string | null) => void;
  setIsConnected: (v: boolean) => void;
  setIsLoading: (v: boolean) => void;
  setIsRestoring: (v: boolean) => void;
  setFreighterInstalled: (v: boolean | null) => void;
  setError: (e: string | null) => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  address: null,
  networkPassphrase: null,
  isConnected: false,
  isLoading: false,
  isRestoring: false,   // start false — show UI immediately, no skeleton
  freighterInstalled: null,
  error: null,
  setAddress: (a) => set({ address: a }),
  setNetworkPassphrase: (n) => set({ networkPassphrase: n }),
  setIsConnected: (v) => set({ isConnected: v }),
  setIsLoading: (v) => set({ isLoading: v }),
  setIsRestoring: (v) => set({ isRestoring: v }),
  setFreighterInstalled: (v) => set({ freighterInstalled: v }),
  setError: (e) => set({ error: e }),
}));

// Track whether the global restore has run — only once per page load
let restoreRan = false;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWallet() {
  const store = useWalletStore();

  // Auto-restore session on first mount — runs once globally
  useEffect(() => {
    if (restoreRan) return;
    restoreRan = true;

    const restore = async () => {
      store.setIsRestoring(true);
      try {
        const {
          isConnected,
          isAllowed,
          getAddress,
          getNetworkDetails,
        } = await import("@stellar/freighter-api");

        // Check if extension is present (no delay needed — chrome messaging is fast)
        const connResult = await isConnected();
        const installed = !connResult.error && !!connResult.isConnected;
        store.setFreighterInstalled(installed);

        if (!installed) return;

        // Only auto-restore if user previously allowed the site
        const allowResult = await isAllowed();
        if (!allowResult.isAllowed) return;

        const addrResult = await getAddress();
        if (addrResult.error || !addrResult.address) return;

        store.setAddress(addrResult.address);
        store.setIsConnected(true);

        const netResult = await getNetworkDetails();
        if (!netResult.error) {
          store.setNetworkPassphrase(netResult.networkPassphrase);
          if (netResult.networkPassphrase !== NETWORK_PASSPHRASE) {
            store.setError("Wrong network — switch Freighter to Stellar Testnet.");
          }
        } else {
          store.setNetworkPassphrase(NETWORK_PASSPHRASE);
        }
      } catch {
        // Silent — extension may not be installed
        store.setFreighterInstalled(false);
      } finally {
        store.setIsRestoring(false);
      }
    };

    restore();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const connect = useCallback(async () => {
    store.setIsLoading(true);
    store.setError(null);

    try {
      const {
        setAllowed,
        getAddress,
        getNetworkDetails,
      } = await import("@stellar/freighter-api");

      const allowResult = await setAllowed();
      if (allowResult.error) {
        const msg = String(allowResult.error);
        if (
          msg.includes("not installed") ||
          msg.includes("not found") ||
          msg.includes("FreighterApiNode") ||
          msg.includes("code:-1") ||
          msg.includes("Node environment")
        ) {
          store.setFreighterInstalled(false);
          store.setError("Freighter not found. Install it from freighter.app and refresh.");
        } else {
          store.setError("Connection rejected. Please approve in the Freighter popup.");
        }
        return;
      }

      store.setFreighterInstalled(true);

      if (!allowResult.isAllowed) {
        // Some versions don't set isAllowed — try getAddress anyway
        const testAddr = await getAddress();
        if (testAddr.error || !testAddr.address) {
          store.setFreighterInstalled(false);
          store.setError("Could not connect to Freighter. Make sure it's installed and unlocked.");
          return;
        }
        store.setAddress(testAddr.address);
        store.setIsConnected(true);
        const net2 = await getNetworkDetails();
        if (!net2.error) {
          store.setNetworkPassphrase(net2.networkPassphrase);
          if (net2.networkPassphrase !== NETWORK_PASSPHRASE) {
            store.setError("Wrong network — switch Freighter to Stellar Testnet.");
          }
        } else {
          store.setNetworkPassphrase(NETWORK_PASSPHRASE);
        }
        return;
      }

      const addrResult = await getAddress();
      if (addrResult.error || !addrResult.address) {
        store.setError("Could not get wallet address from Freighter.");
        return;
      }
      store.setAddress(addrResult.address);
      store.setIsConnected(true);

      const netResult = await getNetworkDetails();
      if (!netResult.error) {
        store.setNetworkPassphrase(netResult.networkPassphrase);
        if (netResult.networkPassphrase !== NETWORK_PASSPHRASE) {
          store.setError("Wrong network — switch Freighter to Stellar Testnet.");
        }
      } else {
        store.setNetworkPassphrase(NETWORK_PASSPHRASE);
      }
    } catch (e) {
      store.setError(e instanceof Error ? e.message : "Failed to connect. Please try again.");
    } finally {
      store.setIsLoading(false);
    }
  }, [store]);

  const disconnect = useCallback(() => {
    store.setAddress(null);
    store.setNetworkPassphrase(null);
    store.setIsConnected(false);
    store.setError(null);
  }, [store]);

  const sign = useCallback(
    async (xdrStr: string, opts?: { networkPassphrase?: string }) => {
      const passphrase = opts?.networkPassphrase || NETWORK_PASSPHRASE;
      const { signTransaction } = await import("@stellar/freighter-api");
      const result = await signTransaction(xdrStr, {
        networkPassphrase: passphrase,
        address: store.address || undefined,
      });
      if (result.signedTxXdr && result.signedTxXdr.trim() !== "") {
        return result.signedTxXdr;
      }
      if (result.error) {
        const errMsg = typeof result.error === "string"
          ? result.error
          : String((result.error as any)?.message || result.error);
        const lower = errMsg.toLowerCase();
        if (lower.includes("reject") || lower.includes("cancel") || lower.includes("denied")) {
          throw new Error("Transaction rejected in wallet.");
        }
        throw new Error(errMsg);
      }
      throw new Error("Signing cancelled.");
    },
    [store.address]
  );

  const signAuth = useCallback(
    async (authEntryXdr: string, opts?: { networkPassphrase?: string; address?: string }) => {
      const passphrase = opts?.networkPassphrase || NETWORK_PASSPHRASE;
      const { signAuthEntry } = await import("@stellar/freighter-api");
      const result = await signAuthEntry(authEntryXdr, {
        networkPassphrase: passphrase,
        address: opts?.address || store.address || undefined,
      });
      if (result.error) {
        const errMsg = typeof result.error === "string"
          ? result.error
          : String((result.error as any)?.message || result.error);
        throw new Error(errMsg);
      }
      if (!result.signedAuthEntry) throw new Error("Auth entry signing returned null.");
      if (Buffer.isBuffer(result.signedAuthEntry)) {
        return (result.signedAuthEntry as Buffer).toString("base64");
      }
      if (typeof result.signedAuthEntry === "string") return result.signedAuthEntry;
      return Buffer.from(result.signedAuthEntry as unknown as Uint8Array).toString("base64");
    },
    [store.address]
  );

  return {
    address: store.address,
    network: store.networkPassphrase,
    isConnected: store.isConnected,
    isLoading: store.isLoading,
    isRestoring: store.isRestoring,
    freighterInstalled: store.freighterInstalled,
    error: store.error,
    isOnTestnet: store.networkPassphrase === NETWORK_PASSPHRASE,
    connect,
    disconnect,
    sign,
    signAuth,
  };
}
