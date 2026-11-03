import Anthropic from "@anthropic-ai/sdk";
import { ANALYSIS_SCHEMA, type Analysis } from "@/lib/analysis";

export type AnalyzeInput = {
  person: string;
  company: string;
  sections: { title: string; results: { title: string; link: string; snippet: string; date?: string }[] }[];
  profiles: { platform: string; handle: string; url: string }[];
};

export class AnalyzeError extends Error {
  constructor(public code: "not_configured" | "refused" | "empty" | "bad_key" | "rate_limited" | "provider_error") {
    super(code);
  }
}

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

/** Sends the public search results to Claude and returns the structured client brief. */
export async function analyzeClient(body: AnalyzeInput): Promise<Analysis> {
  if (!process.env.ANTHROPIC_API_KEY) throw new AnalyzeError("not_configured");

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
    if (response.stop_reason === "refusal") throw new AnalyzeError("refused");
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") throw new AnalyzeError("empty");
    return JSON.parse(text.text) as Analysis;
  } catch (err) {
    if (err instanceof AnalyzeError) throw err;
    if (err instanceof Anthropic.AuthenticationError) throw new AnalyzeError("bad_key");
    if (err instanceof Anthropic.RateLimitError) throw new AnalyzeError("rate_limited");
    throw new AnalyzeError("provider_error");
  }
}
