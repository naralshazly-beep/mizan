/**
 * What the daily job looks at. Edit these to change the niche/region of
 * the morning report — no other code needs to change.
 */
export const TREND_CATEGORIES = [
  "الذكاء الاصطناعي والتقنية",
  "الاقتصاد والمال والأسواق",
  "الأعمال وريادة الأعمال",
  "السوشيال ميديا والترندات الفيروسية",
  "أخبار الخليج ومصر والعالم العربي",
  "الرياضة",
  "الترفيه والمشاهير",
  "الصحة ونمط الحياة",
] as const;

/** Audience the content ideas are written for. */
export const TARGET_AUDIENCE =
  "جمهور عربي على إنستجرام وتيك توك وإكس (الخليج ومصر)، مهتم بالتقنية والمال والأعمال والترندات";

/** How many trend items to produce per day. */
export const ITEMS_PER_DAY = 10;

export const TRENDS_MODEL = "claude-opus-5-5";
