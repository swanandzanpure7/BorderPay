import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col">

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 py-24 sm:py-36 sm:px-6 lg:px-8 hero-grid">
        {/* Gradient backdrop */}
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/40 via-gray-950/80 to-gray-950 pointer-events-none" />
        {/* Glow orbs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative mx-auto max-w-4xl text-center">
          {/* Live badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-indigo-950/80 border border-indigo-800/60 px-4 py-1.5 text-sm text-indigo-300 backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Live on Stellar Testnet · 11 real users · $0 in fees
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-white leading-tight">
            Get paid for your work,{" "}
            <span className="gradient-text">milestone by milestone</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            BorderPay locks client payments in a Soroban smart contract on Stellar.
            Funds release instantly when work is approved — no banks, no disputes, no delays.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/jobs/new" className="btn-primary text-base px-7 py-3.5 w-full sm:w-auto">
              Post a Job — it&apos;s free
            </Link>
            <Link href="/dashboard" className="btn-secondary text-base px-7 py-3.5 w-full sm:w-auto">
              View Dashboard →
            </Link>
          </div>

          {/* Social proof stats */}
          <div className="mt-14 grid grid-cols-3 gap-4 max-w-lg mx-auto">
            {heroStats.map((s) => (
              <div key={s.label} className="flex flex-col items-center">
                <span className="text-2xl sm:text-3xl font-bold text-white">{s.value}</span>
                <span className="text-xs sm:text-sm text-gray-500 mt-0.5">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────── */}
      <section className="px-4 py-20 sm:px-6 lg:px-8 section-divider">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold">How it works</h2>
            <p className="text-gray-400 mt-3 max-w-xl mx-auto">
              Four steps from idea to payment — all enforced on-chain, no middlemen.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {steps.map((step, i) => (
              <div key={i} className="card-glow flex flex-col gap-4 relative overflow-hidden">
                {/* Step number watermark */}
                <span className="absolute -right-2 -top-3 text-7xl font-black text-gray-800/60 select-none leading-none">
                  {i + 1}
                </span>
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-950 border border-indigo-800 text-indigo-300 font-bold text-sm">
                  {step.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{step.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Stellar ───────────────────────────────────────────── */}
      <section className="px-4 py-20 sm:px-6 lg:px-8 section-divider bg-gray-900/20">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold">Why Stellar?</h2>
            <p className="text-gray-400 mt-3 max-w-2xl mx-auto">
              Stellar was purpose-built for cross-border value transfer — making it the
              ideal base layer for a global freelance payments platform.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.title} className="card text-center group hover:border-indigo-700/40 transition-colors">
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-200 inline-block">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Proof of concept ──────────────────────────────────────── */}
      <section className="px-4 py-20 sm:px-6 lg:px-8 section-divider">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold">Real transactions, real users</h2>
            <p className="text-gray-400 mt-3">
              Every job below is verifiable on Stellar Testnet — no mocks, no demos.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {proofJobs.map((j) => (
              <Link
                key={j.id}
                href={`/jobs/${j.id}`}
                className="card hover:border-indigo-700/50 transition-colors group"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono text-gray-500">Job #{j.id}</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border bg-emerald-900/40 text-emerald-300 border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Completed
                  </span>
                </div>
                <p className="font-medium text-white text-sm mb-1">{j.user}</p>
                <p className="text-xs text-gray-500">{j.desc}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-indigo-300">{j.amount} USDC</span>
                  <span className="text-xs text-gray-600 group-hover:text-indigo-400 transition-colors">
                    View on-chain →
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center mt-6">
            <Link href="/status" className="btn-secondary text-sm">
              View all jobs &amp; live status →
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────── */}
      <section className="px-4 py-24 sm:px-6 lg:px-8 section-divider text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-indigo-950/30 to-transparent pointer-events-none" />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Start your first job in 2 minutes
          </h2>
          <p className="text-gray-400 mb-8 text-lg">
            Connect your Freighter wallet, add milestones, deposit USDC — that&apos;s it.
            The smart contract does the rest.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/jobs/new" className="btn-primary text-base px-8 py-3.5 w-full sm:w-auto">
              Post a Job →
            </Link>
            <a
              href="https://borderpay-azure.vercel.app/status"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-base px-8 py-3.5 w-full sm:w-auto"
            >
              Live Demo ↗
            </a>
          </div>
          <p className="mt-6 text-xs text-gray-600">
            Uses Stellar Testnet · No real money involved · Get free test USDC from the faucet
          </p>
        </div>
      </section>
    </div>
  );
}

const heroStats = [
  { value: "11", label: "Real users" },
  { value: "33+", label: "On-chain txs" },
  { value: "$0.00", label: "Fees paid" },
];

const steps = [
  {
    icon: "📋",
    title: "Define milestones",
    description: "Break the project into milestones with USDC amounts and descriptions. Deploy the contract on Stellar.",
  },
  {
    icon: "🔒",
    title: "Lock USDC in escrow",
    description: "The full job value is deposited into the Soroban contract — fully non-custodial, on-chain.",
  },
  {
    icon: "📤",
    title: "Freelancer submits work",
    description: "For each milestone the freelancer marks work as submitted for client review.",
  },
  {
    icon: "💸",
    title: "Approve → funds released",
    description: "One click from the client instantly releases that milestone's USDC to the freelancer's wallet.",
  },
];

const features = [
  {
    icon: "⚡",
    title: "5-second finality",
    description: "Transactions settle in seconds, not days. No waiting on correspondent banks or SWIFT.",
  },
  {
    icon: "💸",
    title: "Near-zero fees",
    description: "Stellar fees are fractions of a cent. You keep more of every dollar you earn.",
  },
  {
    icon: "🛡️",
    title: "Non-custodial escrow",
    description: "Funds are locked in a Soroban smart contract. No third party ever touches your money.",
  },
];

const proofJobs = [
  { id: 46, user: "Mayur Vanve", desc: "3 milestones · create → submit → approve", amount: "3,500" },
  { id: 47, user: "Sneha Bhambare", desc: "Full cycle completed on-chain", amount: "2,800" },
  { id: 48, user: "Sahil Zanpure", desc: "Multi-milestone escrow released", amount: "4,000" },
  { id: 51, user: "Ayush Verma", desc: "Funded, submitted, approved", amount: "1,500" },
  { id: 53, user: "Ashutosh Nivagunne", desc: "Verified on Stellar Testnet", amount: "2,000" },
  { id: 55, user: "Sahil Jagtap", desc: "Latest completed job", amount: "3,200" },
];
