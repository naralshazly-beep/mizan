"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Interaction = {
  id: string;
  report_id: string;
  kind: "meeting" | "call" | "message" | "offer" | "note";
  title: string;
  body: string;
  amount: number | null;
  currency: string | null;
  happened_at: string;
  follow_up_at: string | null;
  follow_up_done: boolean;
};

export const KINDS: Record<Interaction["kind"], { label: string; icon: string }> = {
  meeting: { label: "اجتماع", icon: "🤝" },
  call: { label: "مكالمة", icon: "📞" },
  message: { label: "رسالة", icon: "💬" },
  offer: { label: "عرض سعر", icon: "💰" },
  note: { label: "ملاحظة", icon: "📝" },
};

const today = () => new Date().toISOString().slice(0, 10);

export function fmtMoney(n: number, cur?: string | null) {
  return `${n.toLocaleString("en-US")} ${cur || ""}`.trim();
}

export default function Interactions({ reportId }: { reportId: string }) {
  const [items, setItems] = useState<Interaction[] | null>(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Interaction["kind"]>("meeting");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("AED");
  const [date, setDate] = useState(today());
  const [followUp, setFollowUp] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    createClient()
      .from("basma_interactions")
      .select("*")
      .eq("report_id", reportId)
      .order("happened_at", { ascending: false })
      .then(({ data }) => setItems((data as Interaction[]) ?? []));
  }, [reportId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() && !body.trim()) return;
    setSaving(true);
    const row = {
      report_id: reportId,
      kind,
      title: title.trim() || KINDS[kind].label,
      body: body.trim(),
      amount: kind === "offer" && amount ? Number(amount) : null,
      currency: kind === "offer" && amount ? currency : null,
      happened_at: new Date(date).toISOString(),
      follow_up_at: followUp || null,
    };
    const { data } = await createClient().from("basma_interactions").insert(row).select("*").single();
    setSaving(false);
    if (data) {
      setItems((prev) => [data as Interaction, ...(prev ?? [])].sort((a, b) => b.happened_at.localeCompare(a.happened_at)));
      setTitle("");
      setBody("");
      setAmount("");
      setFollowUp("");
      setOpen(false);
    }
  }

  async function toggleDone(it: Interaction) {
    setItems((prev) => (prev ?? []).map((x) => (x.id === it.id ? { ...x, follow_up_done: !x.follow_up_done } : x)));
    await createClient().from("basma_interactions").update({ follow_up_done: !it.follow_up_done }).eq("id", it.id);
  }

  async function remove(id: string) {
    if (!confirm("تمسح ده؟")) return;
    setItems((prev) => (prev ?? []).filter((x) => x.id !== id));
    await createClient().from("basma_interactions").delete().eq("id", id);
  }

  const offers = (items ?? []).filter((i) => i.kind === "offer" && i.amount);

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-semibold">📒 سجل التواصل</h2>
        <span className="text-xs text-muted">{items?.length ?? 0}</span>
        <button onClick={() => setOpen(!open)} className="no-print chip ms-auto" data-active={open}>
          {open ? "إلغاء" : "+ أضف"}
        </button>
      </div>

      {offers.length > 0 && (
        <p className="mb-3 rounded-lg bg-found/10 p-2 text-xs text-found">
          آخر عرض: {fmtMoney(offers[0].amount!, offers[0].currency)} · {offers.length} عرض
        </p>
      )}

      {open && (
        <form onSubmit={add} className="no-print mb-4 space-y-2 rounded-xl border border-border bg-surface-2/50 p-3">
          <div className="flex flex-wrap gap-1">
            {(Object.keys(KINDS) as Interaction["kind"][]).map((k) => (
              <button type="button" key={k} onClick={() => setKind(k)} data-active={kind === k} className="chip !px-2.5 !py-1 !text-xs">
                {KINDS[k].icon} {KINDS[k].label}
              </button>
            ))}
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="العنوان (مثلًا: اجتماع أول في المكتب)" className="field !py-2 text-sm" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="حصل إيه؟ اتفقتوا على إيه؟" className="field !py-2 text-sm" />
          {kind === "offer" && (
            <div className="flex gap-2">
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="المبلغ" className="field !py-2 text-sm" dir="ltr" />
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="field !w-28 !py-2 text-sm">
                {["AED", "EGP", "SAR", "USD", "EUR"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs text-muted">
            <label>
              التاريخ
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field mt-1 !py-2 text-sm" />
            </label>
            <label>
              فكّرني أتابع يوم
              <input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} className="field mt-1 !py-2 text-sm" />
            </label>
          </div>
          <button disabled={saving} className="btn-primary w-full !py-2">{saving ? "بيحفظ…" : "احفظ"}</button>
        </form>
      )}

      {items === null && <div className="loading-dot h-16 rounded-lg bg-surface-2" />}
      {items?.length === 0 && !open && <p className="text-sm text-muted">لسه مفيش تواصل متسجل. سجّل أول اجتماع أو مكالمة.</p>}

      <ol className="relative space-y-3 border-s border-border ps-4">
        {(items ?? []).map((it) => {
          const due = it.follow_up_at && !it.follow_up_done;
          const late = due && it.follow_up_at! < today();
          return (
            <li key={it.id} className="relative">
              <span className="absolute -start-[1.4rem] top-0.5 text-sm">{KINDS[it.kind].icon}</span>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{it.title}</div>
                  <div className="text-xs text-muted">
                    {KINDS[it.kind].label} · {new Date(it.happened_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}
                    {it.amount ? ` · ${fmtMoney(it.amount, it.currency)}` : ""}
                  </div>
                  {it.body && <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{it.body}</p>}
                  {it.follow_up_at && (
                    <button onClick={() => toggleDone(it)} className={`no-print mt-1 rounded-full px-2 py-0.5 text-xs ${it.follow_up_done ? "bg-surface-2 text-muted line-through" : late ? "bg-red-500/15 text-red-400" : "bg-unknown/15 text-unknown"}`}>
                      ⏰ متابعة {new Date(it.follow_up_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}
                      {it.follow_up_done ? " ✓" : late ? " (متأخرة)" : ""}
                    </button>
                  )}
                </div>
                <button onClick={() => remove(it.id)} className="no-print text-xs text-muted opacity-50 hover:text-red-400 hover:opacity-100">✕</button>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
