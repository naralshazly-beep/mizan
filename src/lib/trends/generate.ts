import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { ITEMS_PER_DAY, TARGET_AUDIENCE, TREND_CATEGORIES, TRENDS_MODEL } from "./config";

const ReportSchema = z.object({
  overview: z.string(),
  items: z.array(
    z.object({
      category: z.string(),
      title: z.string(),
      summary: z.string(),
      why_trending: z.string(),
      analysis: z.string(),
      audience_interest: z.number(),
      sentiment: z.enum(["positive", "negative", "mixed", "neutral"]),
      content_angle: z.string(),
      hook: z.string(),
      slides: z.array(z.object({ title: z.string(), body: z.string() })),
      hashtags: z.array(z.string()),
      sources: z.array(z.object({ title: z.string(), url: z.string() })),
    }),
  ),
});

type Report = z.infer<typeof ReportSchema>;

const MAX_CONTINUATIONS = 5;

/** Today's date (YYYY-MM-DD) in the report's time zone. */
export function todayInReportZone(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.TRENDS_TIMEZONE || "Asia/Dubai",
  }).format(new Date());
}

/**
 * Step 1 — research. Claude searches the web for what people are talking
 * about today and writes detailed notes (with source URLs).
 */
async function research(client: Anthropic, date: string): Promise<string> {
  const prompt = `التاريخ اليوم: ${date}.

أنت محلل ترندات ومحرر محتوى. ابحث في الويب عن أهم ما يتفاعل معه الناس ويبحثون عنه في آخر 24-48 ساعة، في هذه المجالات:
${TREND_CATEGORIES.map((c) => `- ${c}`).join("\n")}

الجمهور المستهدف: ${TARGET_AUDIENCE}.

المطلوب: اختر أقوى ${ITEMS_PER_DAY} موضوعًا من حيث حجم التفاعل والبحث والأهمية (وزّعها على المجالات قدر الإمكان، ولا تكرر نفس الخبر). لكل موضوع اكتب ملاحظات مفصلة:
- ماذا حدث بالضبط (أرقام، أسماء، تواريخ)
- لماذا هو ترند الآن ومن يتفاعل معه وما مزاج الجمهور
- تحليلك: ماذا يعني ولماذا يهم الجمهور المستهدف وما المتوقع بعده
- زاوية محتوى مقترحة وجملة افتتاحية (هوك) جذابة
- روابط المصادر التي اعتمدت عليها

اعتمد فقط على ما وجدته في البحث، وتحقق من الأخبار من أكثر من مصدر عندما يمكن. اكتب بالعربية.`;

  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: prompt }];
  const notes: string[] = [];

  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    const response = await client.beta.messages
      .stream({
        model: TRENDS_MODEL,
        max_tokens: 64000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "high" },
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 25 }],
        messages,
      })
      .finalMessage();

    for (const block of response.content) {
      if (block.type === "text") notes.push(block.text);
    }

    if (response.stop_reason === "refusal") {
      throw new Error("The model declined the research request.");
    }
    if (response.stop_reason !== "pause_turn") break;
    // Server-side search loop paused — resend so it resumes where it left off.
    messages.push({ role: "assistant", content: response.content });
  }

  const text = notes.join("").trim();
  if (!text) throw new Error("Research step returned no notes.");
  return text;
}

/**
 * Step 2 — structure. Turn the research notes into the JSON the app stores,
 * including ready-to-design carousel slides for each topic.
 */
async function structure(client: Anthropic, date: string, notes: string): Promise<Report> {
  const response = await client.beta.messages.parse({
    model: TRENDS_MODEL,
    max_tokens: 32000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(ReportSchema) },
    messages: [
      {
        role: "user",
        content: `هذه ملاحظات بحث ترندات يوم ${date}:

<notes>
${notes}
</notes>

حوّلها إلى تقرير منظم بالعربية:
- overview: ملخص صباحي من 3-5 جمل لأهم ما يحدث اليوم.
- items: موضوع لكل ترند (بنفس ترتيب الأهمية). category يجب أن تكون واحدة من: ${TREND_CATEGORIES.join("، ")}.
- audience_interest: رقم من 1 إلى 10 لمدى اهتمام وتفاعل الجمهور.
- slides: من 5 إلى 7 شرائح كاروسيل لإنستجرام (الأولى هوك، الأخيرة دعوة للتفاعل)، كل شريحة عنوان قصير ونص لا يتجاوز 25 كلمة.
- hashtags: 4-8 هاشتاقات بدون مسافات.
- sources: الروابط الموجودة في الملاحظات فقط، لا تخترع روابط.`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined the structuring request.");
  }
  if (!response.parsed_output) {
    throw new Error(`Could not parse report (stop_reason: ${response.stop_reason}).`);
  }
  return response.parsed_output;
}

/**
 * Generates and stores the report for `date` (default: today).
 * Replaces an existing report for the same date.
 */
export async function generateDailyTrends(date = todayInReportZone()) {
  const client = new Anthropic();
  const notes = await research(client, date);
  const report = await structure(client, date, notes);

  const supabase = createAdminClient();

  await supabase.from("trend_reports").delete().eq("report_date", date);

  const { data: inserted, error: reportError } = await supabase
    .from("trend_reports")
    .insert({ report_date: date, overview: report.overview, model: TRENDS_MODEL })
    .select("id")
    .single();
  if (reportError || !inserted) {
    throw new Error(`Failed to save report: ${reportError?.message}`);
  }

  const rows = report.items.map((item, index) => ({
    report_id: inserted.id,
    position: index,
    category: item.category,
    title: item.title,
    summary: item.summary,
    why_trending: item.why_trending,
    analysis: item.analysis,
    audience_interest: Math.min(10, Math.max(1, Math.round(item.audience_interest))),
    sentiment: item.sentiment,
    content_angle: item.content_angle,
    hook: item.hook,
    slides: item.slides,
    hashtags: item.hashtags.map((h) => h.replace(/^#/, "")),
    sources: item.sources.filter((s) => /^https?:\/\//.test(s.url)),
  }));

  const { error: itemsError } = await supabase.from("trend_items").insert(rows);
  if (itemsError) throw new Error(`Failed to save items: ${itemsError.message}`);

  return { date, items: rows.length };
}
