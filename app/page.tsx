import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 py-24 sm:py-32 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/50 via-gray-950 to-gray-950 pointer-events-none" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-950 border border-indigo-800 px-4 py-1.5 text-sm text-indigo-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
            </span>
            Live on Stellar Testnet
          </div>
          <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white">
            Cross-border payments,{" "}
            <span className="text-indigo-400">milestone by milestone</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto">
            BorderPay puts freelancer pay in a tamper-proof Soroban escrow on Stellar.
            Clients release funds per milestone — no banks, no delays, no surprises.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/jobs/new" className="btn-primary text-base px-6 py-3 w-full sm:w-auto">
              Post a Job
            </Link>
            <Link href="/dashboard" className="btn-secondary text-base px-6 py-3 w-full sm:w-auto">
              View Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-16 sm:px-6 lg:px-8 border-t border-gray-800">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div key={i} className="card flex flex-col gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-950 border border-indigo-800 text-indigo-300 font-bold text-lg">
                  {i + 1}
                </div>
                <h3 className="font-semibold text-white">{step.title}</h3>
                <p className="text-sm text-gray-400">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Stellar */}
      <section className="px-4 py-16 sm:px-6 lg:px-8 border-t border-gray-800 bg-gray-900/30">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4">Why Stellar?</h2>
          <p className="text-center text-gray-400 mb-10 max-w-2xl mx-auto">
            Stellar was built for cross-border payments — 5-second finality, sub-cent fees,
            and native stablecoin support make it the ideal base layer for a global payments platform.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="card text-center">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-400">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-20 sm:px-6 lg:px-8 border-t border-gray-800 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold mb-4">
          Ready to get paid on time, every time?
        </h2>
        <p className="text-gray-400 mb-8 max-w-xl mx-auto">
          Connect your Freighter wallet and create your first job in under 2 minutes.
        </p>
        <Link href="/dashboard" className="btn-primary text-base px-8 py-3">
          Get Started →
        </Link>
      </section>
    </div>
  );
}

const steps = [
  {
    title: "Client creates a job",
    description: "Define milestones with amounts and descriptions. The contract is deployed on Stellar.",
  },
  {
    title: "Client deposits USDC",
    description: "The full job value is locked into the Soroban escrow contract — non-custodial.",
  },
  {
    title: "Freelancer submits work",
    description: "Per milestone, the freelancer submits for review on-chain.",
  },
  {
    title: "Client approves → payment released",
    description: "Approval instantly releases milestone funds to the freelancer's wallet.",
  },
];

const features = [
  {
    icon: "⚡",
    title: "5-second finality",
    description: "Transactions settle in seconds, not days. No waiting on correspondent banks.",
  },
  {
    icon: "💸",
    title: "Near-zero fees",
    description: "Stellar transaction fees are fractions of a cent — keep more of what you earn.",
  },
  {
    icon: "🔒",
    title: "Non-custodial escrow",
    description: "Funds are held by a Soroban smart contract — nobody controls your money except the contract rules.",
  },
];
