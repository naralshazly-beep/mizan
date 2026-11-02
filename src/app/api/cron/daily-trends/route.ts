import { generateDailyTrends } from "@/lib/trends/generate";

// Research with web search takes a few minutes; 300s is the Hobby-plan max.
export const maxDuration = 300;

/**
 * Called once a day by Vercel Cron (see vercel.json). Vercel sends
 * `Authorization: Bearer $CRON_SECRET` automatically when CRON_SECRET is set.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await generateDailyTrends();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("daily-trends failed", error);
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
