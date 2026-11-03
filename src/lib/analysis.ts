/** Shape of the AI client brief, shared by the API route and the UI. */
export type Analysis = {
  summary: string;
  person: string;
  company: string;
  signals: { level: "red" | "yellow" | "green"; text: string }[];
  talking_points: string[];
  questions: string[];
  confidence: "high" | "medium" | "low";
  identity_note: string;
};

export const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "person", "company", "signals", "talking_points", "questions", "confidence", "identity_note"],
  properties: {
    summary: { type: "string", description: "ملخص من 2-3 جمل: مين الشخص ده وإيه علاقته بالشركة" },
    person: { type: "string", description: "اللي اتعرف عن الشخص: الوظيفة، الخبرة، المدينة، النشاط العام" },
    company: { type: "string", description: "اللي اتعرف عن الشركة: نشاطها، حجمها، سنة التأسيس، السوق" },
    signals: {
      type: "array",
      description: "مؤشرات مهمة للصفقة. red = خطر (نصب، قضايا، شكاوى)، yellow = محتاج تتأكد، green = مؤشر ثقة",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["level", "text"],
        properties: {
          level: { type: "string", enum: ["red", "yellow", "green"] },
          text: { type: "string" },
        },
      },
    },
    talking_points: { type: "array", items: { type: "string" }, description: "نقط تفتح بيها الكلام أو تبني عليها ثقة" },
    questions: { type: "array", items: { type: "string" }, description: "أسئلة تسألها للعميل في الاجتماع عشان تتأكد من حاجات مش واضحة" },
    confidence: { type: "string", enum: ["high", "medium", "low"], description: "قد إيه النتايج فعلًا عن نفس الشخص" },
    identity_note: { type: "string", description: "لو النتايج ممكن تكون عن أكتر من شخص بنفس الاسم، وضح ده" },
  },
} as const;
