import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import { ANALYSIS_SCHEMA, type Analysis } from "@/lib/analysis";

/**
 * POST /api/analyze — turns the name-search results into a short Arabic client
 * brief for a business meeting. Needs ANTHROPIC_API_KEY in the environment.
 * Auth is enforced by the proxy (only signed-in users reach /api/*).
 */

export const maxDuration = 120;

type Body = {
  person: string;
  company: string;
  sections: { title: string; results: { title: string; link: string; snippet: string; date?: string }[] }[];
  profiles: { platform: string; handle: string; url: string }[];
};

const SYSTEM = `أنت محلل أبحاث بتجهّز رجل أعمال لاجتماع صفقة مع عميل.
هيوصلك اسم العميل وشركته، ونتايج بحث عامة عنهم من جوجل، والحسابات اللي ظهرت في النتايج.

اكتب ملخص بالعامية المصرية، واضح ومختصر:
- اعتمد على النتايج اللي قدامك بس. متألفش أي معلومة ومتخمنش أرقام أو تواريخ مش موجودة.
- لو النتايج شكلها عن أكتر من شخص بنفس الاسم، قول ده بوضوح في identity_note وقلل confidence.
- المؤشرات الحمرا تبقى بس لحاجات ظاهرة في النتايج (قضايا، نصب، شكاوى، إفلاس). لو مفيش، متخترعش.
- النقط والأسئلة تكون عملية تنفع في اجتماع بيزنس.
- في affiliations حط كل شركة ظهر إن الشخص مؤسسها أو مالكها أو شريك أو مدير أو مساهم فيها، ومعاها لينك المصدر من النتايج بالظبط. متحطش شركة ملهاش مصدر.
- في business_scale لخّص حجم شغله التجاري من النتايج (عدد الشركات، المشاريع، الإيرادات، التمويل). متخمنش أرقام.
- ما تكتبش أي حاجة عن حياته الشخصية أو عيلته أو عنوان بيته أو أملاكه الشخصية (عقارات، عربيات، فلوس في البنك)، حتى لو ظهرت في النتايج. ركز على الشغل والشركات والسمعة المهنية.`;

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.person && !body.company) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const material = [
    `العميل: ${body.person || "غير محدد"}`,
    `الشركة: ${body.company || "غير محددة"}`,
    "",
    "الحسابات اللي ظهرت:",
    ...(body.profiles ?? []).slice(0, 40).map((p) => `- ${p.platform}: ${p.handle} (${p.url})`),
    "",
    ...(body.sections ?? []).flatMap((s) => [
      `## ${s.title}`,
      ...s.results
        .slice(0, 8)
        .map((r) => `- ${r.title}${r.date ? ` [${r.date}]` : ""}\n  ${r.link}\n  ${r.snippet}`),
      "",
    ]),
  ].join("\n");

  const client = new Anthropic();

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: ANALYSIS_SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: material }],
    });

    if (response.stop_reason === "refusal") {
      return Response.json({ error: "refused" }, { status: 422 });
    }
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") {
      return Response.json({ error: "empty" }, { status: 502 });
    }
    const analysis = JSON.parse(text.text) as Analysis;
    return Response.json({ analysis });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "bad_key" }, { status: 503 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      return Response.json({ error: "provider_error", detail: err.message }, { status: 502 });
    }
    return Response.json({ error: "provider_error" }, { status: 502 });
  }
}
