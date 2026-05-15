import Link from "next/link";

export const metadata = {
  title: "Page Not Found | ShipLocal",
  description: "The page you're looking for doesn't exist.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-[var(--color-surface)] text-[var(--color-content)]">
      <section className="text-center max-w-md w-full">
        <h1 className="text-6xl font-bold mb-4">404</h1>
        <p className="text-lg text-[var(--color-content-secondary)] mb-8">
          Page not found
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-content)] text-[var(--color-content-inverted)] text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-opacity"
        >
          Go Home
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </section>
    </main>
  );
}
