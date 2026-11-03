"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Alert = { id: string; title: string; link: string; source: string | null; published: string | null; seen: boolean };

export default function WatchPanel({ reportId, watch: initial, lastChecked }: { reportId: string; watch: boolean; lastChecked: string | null }) {
  const [watch, setWatch] = useState(initial);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState("");
  const [checkedAt, setCheckedAt] = useState(lastChecked);

  function load() {
    createClient()
      .from("basma_alerts")
      .select("id, title, link, source, published, seen")
      .eq("report_id", reportId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setAlerts((data as Alert[]) ?? []));
  }

  useEffect(load, [reportId]);

  async function toggle() {
    const next = !watch;
    setWatch(next);
    await createClient().from("basma_reports").update({ watch: next }).eq("id", reportId);
  }

  async function checkNow() {
    setChecking(true);
    setMsg("");
    const res = await fetch("/api/watch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: reportId }) });
    const data = await res.json().catch(() => ({}));
    setChecking(false);
    if (res.ok) {
      setMsg(data.added ? `لقينا ${data.added} خبر جديد` : "مفيش أخبار جديدة");
      setCheckedAt(new Date().toISOString());
      load();
    } else setMsg("الفحص مكملش. جرب تاني.");
  }

  async function seen(id: string) {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, seen: true } : a)));
    await createClient().from("basma_alerts").update({ seen: true }).eq("id", id);
  }

  return (
    <section className="no-print card p-4">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold">🔔 متابعة الأخبار</h2>
        <button
          onClick={toggle}
          role="switch"
          aria-checked={watch}
          className={`ms-auto flex h-6 w-11 items-center rounded-full p-0.5 transition ${watch ? "bg-accent" : "bg-surface-2"}`}
        >
          <span className={`h-5 w-5 rounded-full bg-white transition ${watch ? "-translate-x-5" : ""}`} />
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">
        {watch ? "بصمة هتدور كل يوم على أخبار جديدة عن العميل ده وتنبهك في صفحة العملاء." : "شغّلها عشان توصلك أي أخبار جديدة عن العميل ده كل يوم."}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <button onClick={checkNow} disabled={checking} className="chip">{checking ? "بيدور…" : "دوّر دلوقتي"}</button>
        <span className="text-xs text-muted">
          {msg || (checkedAt ? `آخر فحص ${new Date(checkedAt).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}` : "")}
        </span>
      </div>
      {alerts.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-border pt-3">
          {alerts.map((a) => (
            <li key={a.id} className="text-sm">
              <a href={a.link} target="_blank" rel="noopener noreferrer" onClick={() => seen(a.id)} className={`hover:underline ${a.seen ? "text-muted" : ""}`}>
                {!a.seen && <span className="me-1 inline-block h-2 w-2 rounded-full bg-accent" />}
                {a.title}
              </a>
              <div className="text-xs text-muted">{[a.source, a.published].filter(Boolean).join(" · ")}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
