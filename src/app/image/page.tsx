"use client";

import { useState } from "react";
import { Hero } from "@/components/Nav";

type Engine = { name: string; home: string; byUrl: (u: string) => string; note: string };

const ENGINES: Engine[] = [
  {
    name: "Google Lens",
    home: "https://lens.google.com/",
    byUrl: (u) => `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(u)}`,
    note: "الأشمل، وبيطلع صفحات ومواقع فيها نفس الصورة.",
  },
  {
    name: "Yandex Images",
    home: "https://yandex.com/images/",
    byUrl: (u) =>
      `https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(u)}`,
    note: "قوي في إيجاد نسخ معدلة أو مقصوصة من نفس الصورة.",
  },
  {
    name: "Bing Visual Search",
    home: "https://www.bing.com/visualsearch",
    byUrl: (u) =>
      `https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:${encodeURIComponent(u)}`,
    note: "بديل كويس لو Google ما لقاش حاجة.",
  },
  {
    name: "TinEye",
    home: "https://tineye.com/",
    byUrl: (u) => `https://tineye.com/search?url=${encodeURIComponent(u)}`,
    note: "بيدور على نفس الصورة بالظبط وبيرتب النتايج بالأقدم، فيبان مين نشرها الأول.",
  },
];

export default function ImageSearch() {
  const [mode, setMode] = useState<"url" | "file">("file");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");

  function pick(f: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : "");
  }

  const validUrl = /^https?:\/\/\S+$/i.test(url.trim());
  const shown = mode === "url" ? (validUrl ? url.trim() : "") : preview;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <Hero
        title="البحث بالصورة"
        subtitle="اعرف الصورة دي منشورة فين على الإنترنت، في أنهي مواقع وحسابات، ومين نشرها الأول."
      />

      <div className="mb-4 flex justify-center gap-2">
        {(
          [
            ["file", "صورة من جهازك"],
            ["url", "لينك صورة"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            data-active={mode === key}
            className="chip"
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "url" ? (
        <input
          dir="ltr"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/photo.jpg"
          className="field"
        />
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 card border-2 border-dashed border-border-strong px-4 py-12 text-muted transition hover:border-accent">
          <span className="text-3xl">⬆️</span>
          <span>{file ? file.name : "اختار صورة أو اسحبها هنا"}</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
        </label>
      )}

      {shown && (
        <div className="mt-6 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown} alt="" className="max-h-64 rounded-xl border border-border" />
        </div>
      )}

      {mode === "file" && file && (
        <p className="mt-4 rounded-xl border border-unknown/30 bg-unknown/10 p-3 text-sm text-unknown">
          الصورة مش بتترفع على أي سيرفر عندنا. افتح محرك البحث من الزرار، واسحب الصورة جواه أو
          استخدم زرار الرفع اللي فيه.
        </p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {ENGINES.map((e) => {
          const href = mode === "url" && validUrl ? e.byUrl(url.trim()) : e.home;
          const ready = mode === "url" ? validUrl : !!file;
          return (
            <a
              key={e.name}
              href={ready ? href : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!ready}
              className={`card p-4 transition ${
                ready ? "hover:border-accent" : "pointer-events-none opacity-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold" dir="ltr">
                  {e.name}
                </span>
                <span className="text-accent">↗</span>
              </div>
              <p className="mt-1 text-sm text-muted">{e.note}</p>
            </a>
          );
        })}
      </div>

      <footer className="mt-12 space-y-2 text-center text-xs leading-relaxed text-muted">
        <p>
          البحث ده بيلاقي الأماكن اللي فيها <strong>نفس الصورة</strong>، مش بيتعرف على وش
          الشخص. لو صورتك ظهرت في حساب مش بتاعك، بلّغ المنصة عن انتحال شخصية.
        </p>
      </footer>
    </main>
  );
}
