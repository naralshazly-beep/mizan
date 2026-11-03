"use client";

import { useActionState, useEffect, useState } from "react";
import { login, signup, type AuthState } from "./actions";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Nav";

const INITIAL: AuthState = { error: null };

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loginState, loginAction, loginPending] = useActionState(login, INITIAL);
  const [signupState, signupAction, signupPending] = useActionState(signup, INITIAL);
  const [urlError, setUrlError] = useState("");

  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get("error");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (e === "not_allowed") setUrlError("الحساب ده مش مسموحله يستخدم بصمة. كلم صاحب الموقع.");
    else if (e === "auth") setUrlError("حصلت مشكلة في تسجيل الدخول. جرب تاني.");
  }, []);

  async function google() {
    await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  const state = mode === "login" ? loginState : signupState;
  const pending = mode === "login" ? loginPending : signupPending;

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <Logo className="mx-auto h-14 w-14" />
        <h1 className="mt-3 bg-gradient-to-l from-accent to-accent-2 bg-clip-text text-4xl font-bold text-transparent">
          بصمة
        </h1>
        <p className="mt-2 text-muted">اعرف عميلك قبل ما تقعد معاه.</p>
      </div>

      <div className="card p-5 sm:p-6">
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-full border border-border bg-surface-solid p-1 text-sm">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-full py-2 transition ${mode === m ? "bg-accent/15 text-accent" : "text-muted"}`}
            >
              {m === "login" ? "تسجيل دخول" : "حساب جديد"}
            </button>
          ))}
        </div>

        <form action={mode === "login" ? loginAction : signupAction} className="space-y-3">
          {mode === "signup" && (
            <input name="fullName" placeholder="اسمك" autoComplete="name" required className="field" />
          )}
          <input name="email" type="email" dir="ltr" placeholder="email@example.com" autoComplete="email" required className="field" />
          <input
            name="password"
            type="password"
            dir="ltr"
            placeholder="••••••••"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            className="field"
          />
          {(state.error || urlError) && <p className="text-sm text-unknown">{state.error || urlError}</p>}
          {state.info && <p className="text-sm text-found">{state.info}</p>}
          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? "استنى…" : mode === "login" ? "ادخل" : "اعمل الحساب"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-border" />أو<span className="h-px flex-1 bg-border" />
        </div>

        <button onClick={google} className="flex w-full items-center justify-center gap-2 rounded-[0.9rem] border border-border-strong bg-surface-solid py-3 font-semibold transition hover:border-accent">
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
            <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" />
          </svg>
          ادخل بجوجل
        </button>
      </div>
    </main>
  );
}
