import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BorderPay — Global Freelance Payments on Stellar",
  description:
    "Milestone-based escrow for global freelancers. Secure, instant USDC payments powered by Soroban smart contracts on Stellar.",
  keywords: ["Stellar", "Soroban", "escrow", "freelance", "USDC", "blockchain", "payments", "crypto"],
  openGraph: {
    title: "BorderPay — Global Freelance Payments on Stellar",
    description: "Trustless milestone-based escrow for global freelancers on Stellar.",
    type: "website",
    url: "https://borderpay-azure.vercel.app",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-gray-950 text-gray-100 min-h-screen`}>
        <Providers>
          <Header />
          <main className="min-h-[calc(100vh-4rem)]">{children}</main>

          {/* Footer */}
          <footer className="border-t border-gray-800 bg-gray-950">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                {/* Brand */}
                <div>
                  <div className="flex items-center gap-2 font-bold text-lg mb-2">
                    <span className="text-indigo-400">⬡</span>
                    <span>BorderPay</span>
                  </div>
                  <p className="text-sm text-gray-500 max-w-xs">
                    Milestone-based escrow for global freelancers, powered by
                    Soroban smart contracts on Stellar.
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Running on Stellar Testnet
                  </div>
                </div>

                {/* Links */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Product
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-500">
                    <li><a href="/dashboard" className="hover:text-gray-300 transition-colors">Dashboard</a></li>
                    <li><a href="/jobs/new" className="hover:text-gray-300 transition-colors">Post a Job</a></li>
                    <li><a href="/profile" className="hover:text-gray-300 transition-colors">My Profile</a></li>
                    <li><a href="/status" className="hover:text-gray-300 transition-colors">Network Status</a></li>
                  </ul>
                </div>

                {/* Tech */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Built With
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-500">
                    <li>
                      <a href="https://stellar.org" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">
                        Stellar Network ↗
                      </a>
                    </li>
                    <li>
                      <a href="https://soroban.stellar.org" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">
                        Soroban Smart Contracts ↗
                      </a>
                    </li>
                    <li>
                      <a
                        href={`https://stellar.expert/explorer/testnet/contract/${process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || ""}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-gray-300 transition-colors"
                      >
                        View Contract ↗
                      </a>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600">
                <span>BorderPay © 2026 — Built for the Rise In Stellar Hackathon</span>
                <span>
                  Contract:{" "}
                  <span className="font-mono text-gray-500">
                    {process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID
                      ? `${process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID.slice(0, 10)}…`
                      : "Testnet"}
                  </span>
                </span>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
