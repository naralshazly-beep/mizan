export const TREND_STATUSES = ["review", "approved", "scheduled", "published", "rejected"] as const;
export type TrendStatus = (typeof TREND_STATUSES)[number];

export const STATUS_LABELS: Record<TrendStatus, string> = {
  review: "للمراجعة",
  approved: "معتمد",
  scheduled: "مجدول",
  published: "منشور",
  rejected: "مرفوض",
};

export type TrendSlide = { title: string; body: string };
export type TrendSource = { title: string; url: string };

export type TrendItem = {
  id: string;
  position: number;
  category: string;
  title: string;
  summary: string;
  why_trending: string;
  analysis: string;
  audience_interest: number;
  sentiment: "positive" | "negative" | "mixed" | "neutral";
  content_angle: string;
  hook: string;
  slides: TrendSlide[];
  hashtags: string[];
  sources: TrendSource[];
  status: TrendStatus;
};

export type TrendReport = {
  id: string;
  report_date: string;
  overview: string;
  created_at: string;
};
