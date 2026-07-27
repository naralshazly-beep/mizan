import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-bg px-5 py-16">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-card bg-surface p-6 shadow-card">
        <div className="flex flex-col gap-1">
          <h1 className="text-title font-bold text-text">{APP_NAME}</h1>
          <p className="text-body text-text-muted">{APP_TAGLINE}</p>
        </div>

        <div className="flex flex-col gap-2 rounded-control border border-border bg-bg p-4">
          <span className="text-caption text-text-muted">Net profit/loss (this month)</span>
          <span className="text-big-number font-bold text-positive">$0.00</span>
        </div>

        <button
          type="button"
          className="rounded-control bg-accent px-4 py-3 text-body font-semibold text-white transition-colors duration-150 ease-out hover:bg-accent-hover"
        >
          Add your first transaction
        </button>
      </div>
    </main>
  );
}
