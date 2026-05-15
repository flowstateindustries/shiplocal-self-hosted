import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative min-h-screen flex items-center justify-center px-6 bg-[var(--color-surface)] text-[var(--color-content)]">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.08),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(139,92,246,0.06),transparent_60%)]" />

      <div className="relative z-10 max-w-md w-full flex flex-col items-center text-center">
        <div className="h-16 w-16 rounded-2xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)] flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(59,130,246,0.12),0_0_40px_rgba(139,92,246,0.08)]">
          <svg
            className="h-8 w-8 text-[var(--color-content)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 12l8-8 8 8M5 10v10h14V10"
            />
          </svg>
        </div>

        <h1 className="text-3xl font-semibold tracking-tight mb-2">
          ShipLocal
        </h1>
        <p className="text-sm text-[var(--color-content-secondary)] mb-8 max-w-sm">
          Self-hosted App Store metadata localization.
        </p>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-content)] text-[var(--color-content-inverted)] text-sm font-medium transition-opacity duration-150 hover:opacity-90 active:scale-[0.98]"
        >
          Open Dashboard
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        <p className="mt-8 text-xs text-[var(--color-content-muted)]">
          Running locally · No account required
        </p>
      </div>
    </main>
  );
}
