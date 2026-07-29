// Small, hand-built decorative illustrations for empty states. Deliberately
// simple geometric glyphs (no external image assets) so they render crisply
// at any size. Colors are applied per-element with theme utility classes
// (not a single currentColor wrapper) so each icon can mix accent/positive/
// negative/muted tones for a "trading dashboard" feel.

// Candlestick chart with an up/down arrow pair and a small donut (category
// analysis) accent tucked in the corner — reads as a trading/analytics
// dashboard rather than a plain bar chart.
export function ChartIllustration() {
  return (
    <svg viewBox="0 0 48 48" className="h-14 w-14" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* chart baseline */}
      <line x1="4" y1="40" x2="34" y2="40" strokeWidth="1" className="stroke-border" />

      {/* candlestick 1 — a dip */}
      <line x1="10" y1="23" x2="10" y2="40" strokeWidth="1.5" className="stroke-text-muted" />
      <rect x="7" y="26" width="6" height="12" rx="1.5" opacity="0.55" className="fill-text-muted" />

      {/* candlestick 2 — recovering */}
      <line x1="22" y1="15" x2="22" y2="40" strokeWidth="1.5" className="stroke-accent" />
      <rect x="19" y="18" width="6" height="20" rx="1.5" className="fill-accent" />

      {/* candlestick 3 — strong close */}
      <line x1="31" y1="7" x2="31" y2="40" strokeWidth="1.5" className="stroke-accent" />
      <rect x="28" y="10" width="6" height="28" rx="1.5" className="fill-accent" />

      {/* small up arrow — overall trend */}
      <path d="M42 6 L38 12 L46 12 Z" className="fill-accent" />

      {/* small down arrow — a past dip */}
      <path d="M6 14 L2 8 L10 8 Z" opacity="0.6" className="fill-text-muted" />

      {/* donut accent — category analysis, bottom-right */}
      <g transform="rotate(-90 41 41)">
        <circle
          cx="41"
          cy="41"
          r="5"
          fill="none"
          strokeWidth="3"
          strokeDasharray="14 17.4"
          strokeDashoffset="0"
          className="stroke-accent"
        />
        <circle
          cx="41"
          cy="41"
          r="5"
          fill="none"
          strokeWidth="3"
          strokeDasharray="9 22.4"
          strokeDashoffset="-14"
          className="stroke-positive"
        />
        <circle
          cx="41"
          cy="41"
          r="5"
          fill="none"
          strokeWidth="3"
          strokeDasharray="5 26.4"
          strokeDashoffset="-23"
          className="stroke-negative"
        />
        <circle
          cx="41"
          cy="41"
          r="5"
          fill="none"
          strokeWidth="3"
          strokeDasharray="3.4 28"
          strokeDashoffset="-28"
          className="stroke-text-muted"
        />
      </g>
    </svg>
  );
}

// Two opposing arrows joined by a baseline — income up (green), expense down
// (red) — mirroring the same color convention CurrencyText uses everywhere
// else in the app, so it reads instantly as "money moving in and out."
export function TransactionFlowIllustration() {
  return (
    <svg viewBox="0 0 48 48" className="h-14 w-14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="10" y1="36" x2="38" y2="36" strokeWidth="1" className="stroke-border" />
      <path
        d="M14 32 L14 12 M8 18 L14 12 L20 18"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-positive"
      />
      <path
        d="M34 16 L34 36 M28 30 L34 36 L40 30"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-negative"
      />
    </svg>
  );
}

// A balance scale — "Mizan" is Arabic for scale/balance, so this ties the
// Debts page (what you owe vs. what's owed to you) back to the app's name.
// The two pans are tinted red/green to echo "I owe" vs "owed to me."
export function ScaleIllustration() {
  return (
    <svg viewBox="0 0 48 48" className="h-14 w-14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="24" y1="7" x2="24" y2="14" strokeWidth="1.5" strokeLinecap="round" className="stroke-accent" />
      <line x1="9" y1="14" x2="39" y2="14" strokeWidth="1.5" strokeLinecap="round" className="stroke-accent" />
      <line x1="24" y1="14" x2="24" y2="35" strokeWidth="1.5" className="stroke-accent" />
      <path
        d="M9 14l-5.5 12a5.5 5.5 0 0 0 11 0L9 14z"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.8"
        className="fill-negative/15 stroke-negative"
      />
      <path
        d="M39 14l-5.5 12a5.5 5.5 0 0 0 11 0L39 14z"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.8"
        className="fill-positive/15 stroke-positive"
      />
      <rect x="15" y="35" width="18" height="4" rx="1.5" className="fill-accent" />
    </svg>
  );
}
