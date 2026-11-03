import crypto from "node:crypto";
import { after, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SECTIONS } from "@/lib/sections";
import { searchConfigured, searchWeb, type SearchResult } from "@/lib/search";
import { extractProfiles } from "@/lib/footprint";
import { analyzeClient } from "@/lib/ai";
import type { Analysis } from "@/lib/analysis";

/**
 * WhatsApp bot (Meta WhatsApp Cloud API).
 *
 * Send "Ahmed Hassan - Emaar" from the number saved in Basma settings and the
 * bot replies with an AI client brief and a link to the saved client file.
 *
 * Env vars:
 *   WHATSAPP_TOKEN            permanent access token from the Meta app
 *   WHATSAPP_PHONE_NUMBER_ID  the bot's phone number id
 *   WHATSAPP_VERIFY_TOKEN     any string; must match the webhook settings in Meta
 *   WHATSAPP_APP_SECRET       app secret, used to verify Meta's signature
 *   SUPABASE_SERVICE_ROLE_KEY needed to find the user and save the report
 */

export const maxDuration = 300;

const GRAPH = "https://graph.facebook.com/v21.0";

const SITE_URL = process.env.BASMA_SITE_URL ?? "https://basma-jade.vercel.app";

async function send(to: string, body: string) {
  await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: body.slice(0, 4000), preview_url: true } }),
  });
}

/** "Ahmed Hassan - Emaar" / "Ahmed Hassan / Emaar" / two lines → person + company. */
function parse(text: string) {
  const parts = text
    .trim()
    .split(/\s[-–—|/]\s|\n|،|,/)
    .map((x) => x.trim())
    .filter(Boolean);
  return { person: parts[0] ?? "", company: parts.slice(1).join(" ") };
}

const LEVEL = { red: "⛔", yellow: "⚠️", green: "✅" } as const;

function format(person: string, company: string, a: Analysis | null, profiles: number, link: string | null) {
  const lines = [`*${person}*${company ? ` · ${company}` : ""}`, ""];
  if (a) {
    lines.push(a.summary, "");
    if (a.identity_note) lines.push(`⚠️ ${a.identity_note}`, "");
    if (a.affiliations?.length) {
      lines.push("*🏛️ الشركات:*");
      for (const f of a.affiliations.slice(0, 6)) lines.push(`• ${f.company} (${f.role})`);
      lines.push("");
    }
    if (a.signals.length) {
      lines.push("*🚦 المؤشرات:*");
      for (const s of a.signals.slice(0, 6)) lines.push(`${LEVEL[s.level]} ${s.text}`);
      lines.push("");
    }
    if (a.questions.length) {
      lines.push("*❓ اسأله:*");
      for (const q of a.questions.slice(0, 4)) lines.push(`• ${q}`);
      lines.push("");
    }
  } else {
    lines.push("مقدرتش أعمل التحليل دلوقتي، بس النتايج اتحفظت.", "");
  }
  lines.push(`🫆 ${profiles} حساب ظهر في النتايج`);
  if (link) lines.push(`📂 الملف كامل: ${link}`);
  return lines.join("\n");
}

async function handle(from: string, text: string) {
  const sb = createAdminClient();
  if (!sb) return send(from, "البوت لسه مش متظبط (ناقص مفتاح Supabase).");

  const { data: owner } = await sb.from("basma_settings").select("user_id").eq("whatsapp_number", from).maybeSingle();
  if (!owner) {
    return send(from, "الرقم ده مش متسجل في بصمة. ادخل الإعدادات في الموقع وحط رقم الواتساب بتاعك.");
  }

  const { person, company } = parse(text);
  if (!person || person.length < 3) {
    return send(from, "ابعت اسم العميل وشركته كده:\nAhmed Hassan - Emaar");
  }
  if (!searchConfigured()) return send(from, "خدمة البحث مش متوصلة في الموقع.");

  await send(from, `🔎 بدوّر على ${person}${company ? ` (${company})` : ""}… هبعتلك التقرير خلال دقيقة.`);

  const active = SECTIONS.filter((s) => s.query(person, company));
  const results: Record<string, SearchResult[]> = {};
  await Promise.all(
    active.map(async (s) => {
      try {
        results[s.id] = await searchWeb(s.query(person, company)!, s.type);
      } catch {
        results[s.id] = [];
      }
    }),
  );

  const profiles = extractProfiles(Object.values(results).flatMap((l) => l.map((r) => r.link)));
  let analysis: Analysis | null = null;
  try {
    analysis = await analyzeClient({
      person,
      company,
      profiles,
      sections: active.filter((s) => results[s.id]?.length).map((s) => ({ title: s.title, results: results[s.id] })),
    });
  } catch {
    analysis = null;
  }

  const { data: saved } = await sb
    .from("basma_reports")
    .insert({ user_id: owner.user_id, person, company, results, profiles, analysis: analysis ? JSON.stringify(analysis) : null })
    .select("id")
    .single();

  await send(from, format(person, company, analysis, profiles.length, saved ? `${SITE_URL}/reports/${saved.id}` : null));
}

/** Meta calls this once when you save the webhook URL. */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const raw = await request.text();

  const secret = process.env.WHATSAPP_APP_SECRET;
  const sig = request.headers.get("x-hub-signature-256") ?? "";
  if (!secret) return new Response("not configured", { status: 503 });
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return new Response("bad signature", { status: 401 });
  }

  let payload: {
    entry?: { changes?: { value?: { messages?: { from: string; type: string; text?: { body: string } }[] } }[] }[];
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("ok");
  }

  const messages = payload.entry?.flatMap((e) => e.changes?.flatMap((c) => c.value?.messages ?? []) ?? []) ?? [];
  for (const m of messages) {
    if (m.type === "text" && m.text?.body) {
      // Answer Meta right away; do the slow search + AI work afterwards.
      after(() => handle(m.from, m.text!.body).catch(() => send(m.from, "حصلت مشكلة. جرب تاني بعد شوية.")));
    }
  }
  return new Response("ok");
}
