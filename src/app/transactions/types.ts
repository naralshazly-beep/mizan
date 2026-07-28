export type Transaction = {
  id: string;
  date: string;
  type: "income" | "expense";
  category: string;
  description: string;
  currency: string;
  amount: number;
  rate_to_base: number;
  amount_base: number;
};
