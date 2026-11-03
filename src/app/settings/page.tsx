"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Settings = { company_name: string; prepared_by: string; logo_data_url: string | null; whatsapp_number: string | null };

/** Shrinks an uploaded image to fit 320px and returns it as a PNG data URL. */
function shrink(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 320 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export default function SettingsPage() {
  const [s, setS] = useState<Settings>({ company_name: "", prepared_by: "", logo_data_url: null, whatsapp_number: "" });
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
      const name = (data.user?.user_metadata?.full_name as string) ?? "";
      sb.from("basma_settings")
        .select("company_name, prepared_by, logo_data_url, whatsapp_number")
        .maybeSingle()
        .then(({ data: row }) => {
          setS(row ? (row as Settings) : { company_name: "", prepared_by: name, logo_data_url: null, whatsapp_number: "" });
          setLoaded(true);
        });
    });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const { data } = await createClient().auth.getUser();
    const { error } = await createClient()
      .from("basma_settings")
      .upsert({ user_id: data.user!.id, ...s, whatsapp_number: s.whatsapp_number?.replace(/[^\d]/g, "") || null, updated_at: new Date().toISOString() });
    setMsg(error ? "الحفظ مكملش. جرب تاني." : "اتحفظ ✓");
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-8 sm:py-12">
      <h1 className="text-3xl font-bold">الإعدادات</h1>
      <p className="mt-1 text-sm text-muted">{email}</p>

      {!loaded ? (
        <div className="card loading-dot mt-6 h-64" />
      ) : (
        <form onSubmit={save} className="card mt-6 space-y-4 p-5">
          <h2 className="font-semibold">🏷️ شكل التقرير</h2>
          <label className="block text-sm text-muted">
            اسم شركتك (هيظهر فوق التقرير)
            <input value={s.company_name} onChange={(e) => setS({ ...s, company_name: e.target.value })} className="field mt-1 text-text" />
          </label>
          <label className="block text-sm text-muted">
            اسم اللي عامل التقرير
            <input value={s.prepared_by} onChange={(e) => setS({ ...s, prepared_by: e.target.value })} className="field mt-1 text-text" />
          </label>
          <div className="text-sm text-muted">
            اللوجو
            <div className="mt-1 flex items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-border bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {s.logo_data_url ? <img src={s.logo_data_url} alt="" className="max-h-full max-w-full" /> : <span className="text-xs text-gray-400">مفيش</span>}
              </div>
              <label className="chip cursor-pointer">
                ارفع لوجو
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setS({ ...s, logo_data_url: await shrink(f) });
                  }}
                />
              </label>
              {s.logo_data_url && <button type="button" onClick={() => setS({ ...s, logo_data_url: null })} className="text-xs text-muted hover:text-red-400">شيله</button>}
            </div>
          </div>

          <h2 className="border-t border-border pt-4 font-semibold">💬 واتساب</h2>
          <label className="block text-sm text-muted">
            رقم الواتساب بتاعك (بكود الدولة، مثلًا 971501234567). بس الرقم ده هيقدر يبعت للبوت.
            <input value={s.whatsapp_number ?? ""} onChange={(e) => setS({ ...s, whatsapp_number: e.target.value })} dir="ltr" inputMode="tel" placeholder="9715xxxxxxxx" className="field mt-1 text-text" />
          </label>

          <div className="flex items-center gap-3">
            <button className="btn-primary">احفظ</button>
            {msg && <span className="text-sm text-found">{msg}</span>}
          </div>
        </form>
      )}
    </main>
  );
}
