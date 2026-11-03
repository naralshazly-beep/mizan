export type ReportStatus = "new" | "in_progress" | "won" | "lost";

export const STATUS: Record<ReportStatus, { label: string; cls: string }> = {
  new: { label: "جديد", cls: "bg-accent/15 text-accent" },
  in_progress: { label: "شغالين عليه", cls: "bg-unknown/15 text-unknown" },
  won: { label: "اتقفلت ✓", cls: "bg-found/15 text-found" },
  lost: { label: "مكملتش", cls: "bg-missing/20 text-muted" },
};

/** Titles for the saved result groups (same ids as the /name page sections). */
export const SECTION_TITLES: Record<string, { title: string; icon: string }> = {
  person: { title: "عن الشخص", icon: "👤" },
  linkedin: { title: "لينكدإن", icon: "💼" },
  social: { title: "السوشيال ميديا", icon: "📱" },
  company: { title: "عن الشركة", icon: "🏢" },
  registry: { title: "السجل التجاري والتراخيص", icon: "📜" },
  news: { title: "الأخبار", icon: "📰" },
  reputation: { title: "السمعة والشكاوى", icon: "⚠️" },
  roles: { title: "الشركات والمناصب", icon: "🏛️" },
  officers: { title: "سجلات الشركات", icon: "🗄️" },
  shareholding: { title: "إفصاحات المساهمين", icon: "📈" },
  company_size: { title: "حجم الشركة ونشاطها", icon: "📊" },
};
