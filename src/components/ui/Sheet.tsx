"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = panel.querySelector<HTMLElement>(
      "input, textarea, select, button:not([aria-label='Close'])",
    );
    focusable?.focus();
  }, [open]);

  return (
    <div
      aria-hidden={!open}
      className={`fixed inset-0 z-40 transition-opacity duration-200 ease-out ${
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-modal bg-surface shadow-sheet transition-transform duration-200 ease-out sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-modal ${
          open ? "translate-y-0 sm:scale-100" : "translate-y-full sm:scale-95"
        }`}
      >
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="h-1 w-10 rounded-pill bg-border" />
        </div>
        <div className="px-6 pb-2 pt-4 sm:pt-6">
          <h2 id={titleId} className="text-header font-semibold text-text">
            {title}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto px-6">{children}</div>
        {footer && <div className="flex gap-3 border-t border-border px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
