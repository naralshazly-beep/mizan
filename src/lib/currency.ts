export const CURRENCIES = ["USD", "AED", "EGP"] as const;
export type Currency = (typeof CURRENCIES)[number];

export function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: currency === "USD" ? "symbol" : "code",
  }).format(amount);
}
