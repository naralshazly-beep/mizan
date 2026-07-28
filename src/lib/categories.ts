export const CATEGORIES = [
  "Ads",
  "Inventory",
  "Shipping",
  "Fees",
  "Software",
  "Personal",
  "Sales",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];
