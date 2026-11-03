"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string | null; info?: string | null };

const AR: Record<string, string> = {
  "Invalid login credentials": "الإيميل أو كلمة السر غلط.",
  "Email not confirmed": "لازم تأكد إيميلك الأول. افتح الإيميل اللي وصلك ودوس على اللينك.",
  "User already registered": "الإيميل ده عنده حساب بالفعل. سجل دخول.",
};
const tr = (m: string) => AR[m] ?? m;

export async function login(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "اكتب الإيميل وكلمة السر." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: tr(error.message) };
  redirect("/dashboard");
}

export async function signup(_: AuthState, formData: FormData): Promise<AuthState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!fullName || !email || !password) return { error: "اكتب اسمك والإيميل وكلمة السر." };
  if (password.length < 8) return { error: "كلمة السر لازم تكون 8 حروف على الأقل." };

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName }, emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { error: tr(error.message) };
  if (data.session) redirect("/dashboard");
  return { error: null, info: "اتبعتلك إيميل تأكيد. افتحه ودوس على اللينك، وبعدها سجل دخول." };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
