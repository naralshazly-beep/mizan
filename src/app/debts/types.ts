export type Debt = {
  id: string;
  direction: "owed_by_me" | "owed_to_me";
  person_name: string;
  currency: string;
  amount: number;
  rate_to_base: number;
  amount_base: number;
  due_date: string | null;
  status: "unpaid" | "paid";
};
