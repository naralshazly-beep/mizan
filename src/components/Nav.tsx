"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "اليوزرنيم" },
  { href: "/name", label: "الاسم والشركة" },
  { href: "/image", label: "الصورة" },
];

export function Logo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#818cf8" />
        </linearGradient>
      </defs>
      <g stroke="url(#lg)" strokeWidth="1.6" strokeLinecap="round">
        <path d="M6.5 6.5a7.5 7.5 0 0 1 11.6 1.2" />
        <path d="M4.6 10.4a7.5 7.5 0 0 0-.1 3.8" />
        <path d="M8 18.4A7.4 7.4 0 0 1 6.9 12a5.1 5.1 0 0 1 10.2 0c0 1.6-.2 3.1-.7 4.6" />
        <path d="M12 12c0 3-.6 5.6-2 7.9" />
        <path d="M9.4 12a2.6 2.6 0 0 1 5.2 0c0 2.7-.5 5.3-1.6 7.6" />
        <path d="M19.4 11.2c.1.9.1 1.8 0 2.7" />
      </g>
    </svg>
  );
}

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="sticky top-0 z-20 border-b border-border bg-bg/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <Logo />
          <span className="text-lg">بصمة</span>
        </Link>
        <div className="ms-auto flex gap-1 rounded-full border border-border bg-surface-solid/60 p-1 text-sm">
          {TABS.map((t) => {
            const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`rounded-full px-3 py-1.5 transition sm:px-4 ${
                  active ? "bg-accent/15 text-accent" : "text-muted hover:text-text"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export function Hero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="mb-8 text-center">
      <h1 className="bg-gradient-to-l from-accent to-accent-2 bg-clip-text text-3xl font-bold text-transparent sm:text-5xl">
        {title}
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-muted">{subtitle}</p>
    </header>
  );
}
