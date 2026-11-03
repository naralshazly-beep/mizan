/**
 * The searches the name page runs (and the WhatsApp bot reuses). Each section
 * builds a search query and a matching "open in Google" link from the
 * person (p) and company (c) names.
 */

export type Section = {
  id: string;
  title: string;
  icon: string;
  type: "web" | "news";
  query: (p: string, c: string) => string | null;
  google: (p: string, c: string) => string | null;
};

const quoted = (s: string) => (s ? `"${s}"` : "");
const both = (p: string, c: string) => [quoted(p), quoted(c)].filter(Boolean).join(" ");
const g = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

export const SECTIONS: Section[] = [
  {
    id: "person", title: "عن الشخص", icon: "👤", type: "web",
    query: (p, c) => (p ? both(p, c) : null),
    google: (p, c) => (p ? g(both(p, c)) : null),
  },
  {
    id: "linkedin", title: "لينكدإن", icon: "💼", type: "web",
    query: (p, c) => (p ? `site:linkedin.com/in ${both(p, c)}` : null),
    google: (p, c) => (p ? g(`site:linkedin.com/in ${both(p, c)}`) : null),
  },
  {
    id: "social", title: "السوشيال ميديا", icon: "📱", type: "web",
    query: (p, c) =>
      p ? `${both(p, c)} (site:instagram.com OR site:facebook.com OR site:x.com OR site:tiktok.com)` : null,
    google: (p, c) =>
      p ? g(`${both(p, c)} (site:instagram.com OR site:facebook.com OR site:x.com OR site:tiktok.com)`) : null,
  },
  {
    id: "company", title: "عن الشركة", icon: "🏢", type: "web",
    query: (_, c) => (c ? quoted(c) : null),
    google: (_, c) => (c ? g(quoted(c)) : null),
  },
  {
    id: "registry", title: "السجل التجاري والتراخيص", icon: "📜", type: "web",
    query: (_, c) =>
      c ? `${quoted(c)} (trade license OR "commercial registration" OR LLC OR سجل تجاري OR رخصة)` : null,
    google: (_, c) =>
      c ? g(`${quoted(c)} (trade license OR "commercial registration" OR LLC OR سجل تجاري OR رخصة)`) : null,
  },
  {
    id: "news", title: "الأخبار", icon: "📰", type: "news",
    query: (p, c) => (p || c ? both(p, c) : null),
    google: (p, c) => (p || c ? `https://news.google.com/search?q=${encodeURIComponent(both(p, c))}` : null),
  },
  {
    id: "reputation", title: "السمعة والشكاوى", icon: "⚠️", type: "web",
    query: (p, c) =>
      p || c ? `${both(p, c)} (scam OR fraud OR lawsuit OR complaint OR نصب OR احتيال OR قضية OR شكوى)` : null,
    google: (p, c) =>
      p || c ? g(`${both(p, c)} (scam OR fraud OR lawsuit OR complaint OR نصب OR احتيال OR قضية OR شكوى)`) : null,
  },
  {
    id: "roles", title: "الشركات والمناصب", icon: "🏛️", type: "web",
    query: (p) => (p ? `${quoted(p)} (founder OR owner OR "managing director" OR CEO OR chairman OR partner OR director OR مؤسس OR مالك OR "رئيس مجلس" OR شريك OR "المدير العام")` : null),
    google: (p) => (p ? g(`${quoted(p)} (founder OR owner OR "managing director" OR CEO OR chairman OR partner OR director OR مؤسس OR مالك OR "رئيس مجلس" OR شريك)`) : null),
  },
  {
    id: "officers", title: "سجلات الشركات", icon: "🗄️", type: "web",
    query: (p) => (p ? `${quoted(p)} (site:opencorporates.com OR site:zawya.com OR site:crunchbase.com OR site:dnb.com OR site:bloomberg.com/profile)` : null),
    google: (p) => (p ? g(`${quoted(p)} (site:opencorporates.com OR site:zawya.com OR site:crunchbase.com OR site:dnb.com)`) : null),
  },
  {
    id: "shareholding", title: "إفصاحات المساهمين", icon: "📈", type: "web",
    query: (p, c) =>
      p ? `${quoted(p)} ${c ? quoted(c) : ""} (shareholder OR "major shareholders" OR stake OR مساهم OR حصة OR "كبار المساهمين")` : null,
    google: (p, c) =>
      p ? g(`${quoted(p)} ${c ? quoted(c) : ""} (shareholder OR "major shareholders" OR stake OR مساهم OR حصة)`) : null,
  },
  {
    id: "company_size", title: "حجم الشركة ونشاطها", icon: "📊", type: "web",
    query: (_, c) =>
      c ? `${quoted(c)} (revenue OR employees OR projects OR funding OR valuation OR إيرادات OR موظفين OR مشاريع OR تمويل)` : null,
    google: (_, c) =>
      c ? g(`${quoted(c)} (revenue OR employees OR projects OR funding OR إيرادات OR موظفين OR مشاريع)`) : null,
  },
];
