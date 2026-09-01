"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/lib/hooks/useWallet";
import { truncateAddress } from "@/lib/stellar";
import { identifyUser } from "@/lib/analytics";
import { useEffect, useState } from "react";

export function Header() {
  const {
    address, isConnected, isLoading, error,
    connect, disconnect, freighterInstalled, isOnTestnet,
  } = useWallet();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (address) identifyUser(address);
  }, [address]);

  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/jobs/new",  label: "Post Job" },
    { href: "/status",    label: "Status" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-gray-800/80 bg-gray-950/95 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-lg shrink-0 group">
            <span className="text-indigo-400 text-xl group-hover:scale-110 transition-transform duration-150">⬡</span>
            <span className="text-white">BorderPay</span>
            <span className="hidden sm:inline-block text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded-full font-normal">
              Testnet
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {navLinks.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                    active
                      ? "text-white bg-gray-800"
                      : "text-gray-400 hover:text-gray-100 hover:bg-gray-800/50"
                  }`}
                >
                  {label}
                  {active && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-indigo-500 rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Wrong network */}
            {isConnected && !isOnTestnet && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-red-400 bg-red-950/50 border border-red-800 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                Wrong network
              </span>
            )}

            {isConnected && address ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/profile"
                  className="hidden sm:flex items-center gap-2 rounded-xl bg-gray-800 border border-gray-700 px-3 py-2 text-sm hover:bg-gray-700 hover:border-gray-600 transition-all duration-150"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" aria-hidden />
                  <span className="font-mono text-gray-200">{truncateAddress(address)}</span>
                </Link>
                <button
                  onClick={disconnect}
                  className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-gray-800/50"
                  aria-label="Disconnect wallet"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={connect}
                disabled={isLoading}
                className="btn-primary text-sm py-2"
                aria-label="Connect Freighter wallet"
              >
                {isLoading ? (
                  <><HeaderSpinner />Connecting…</>
                ) : (
                  "Connect Wallet"
                )}
              </button>
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle navigation"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="pb-3" role="alert">
            <div className="flex items-center gap-2 rounded-xl bg-red-950/50 border border-red-800 px-3 py-2.5 text-sm text-red-300">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="flex-1">{error}</span>
              {freighterInstalled === false && (
                <a href="https://freighter.app" target="_blank" rel="noopener noreferrer" className="underline text-xs shrink-0">
                  Install Freighter →
                </a>
              )}
            </div>
          </div>
        )}

        {/* Mobile menu */}
        {menuOpen && (
          <nav className="md:hidden pb-4 flex flex-col gap-1 border-t border-gray-800 pt-3 mt-1">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  pathname === href
                    ? "bg-gray-800 text-white"
                    : "text-gray-400 hover:text-gray-100 hover:bg-gray-800/50"
                }`}
              >
                {label}
              </Link>
            ))}
            {isConnected && address && (
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="px-3 py-2.5 rounded-xl text-sm font-mono text-gray-400 hover:text-white hover:bg-gray-800/50 flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                {truncateAddress(address)}
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}

function HeaderSpinner() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
