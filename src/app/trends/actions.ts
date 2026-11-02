"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateDailyTrends } from "@/lib/trends/generate";
import { TREND_STATUSES, type TrendStatus } from "@/lib/trends/types";

export async function setTrendStatus(itemId: string, status: TrendStatus) {
  if (!TREND_STATUSES.includes(status)) {
    return { error: "Invalid status." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("trend_items")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", itemId);
  if (error) return { error: error.message };
  revalidatePath("/trends");
  return { ok: true };
}

export async function generateNow(): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  try {
    await generateDailyTrends();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Generation failed." };
  }
  revalidatePath("/trends");
  return { ok: true };
}
