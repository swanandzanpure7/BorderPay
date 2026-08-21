import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BorderPay — Global Freelance Payments on Stellar",
  description: "Milestone-based escrow for global freelancers. Powered by Soroban smart contracts on Stellar.",
  keywords: ["Stellar", "Soroban", "escrow", "freelance", "USDC", "blockchain", "payments"],
  openGraph: {
    title: "BorderPay",
    description: "Trustless milestone-based escrow for global freelancers on Stellar.",
    type: "website",
    url: "https://borderpay-azure.vercel.app",
  },
  description:
    "Fund cross-border freelance work with milestone-based escrow on the Stellar blockchain. Secure, fast, and non-custodial.",
  openGraph: {
    title: "BorderPay",
    description: "Milestone escrow for global freelancers on Stellar",
    type: "website",
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
          <footer className="border-t border-gray-800 py-6 text-center text-sm text-gray-500">
            BorderPay © 2026 · Built on{" "}
            <a
              href="https://stellar.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:underline"
            >
              Stellar
            </a>{" "}
            Testnet
          </footer>
        </Providers>
      </body>
    </html>
  );
}
