"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { login, signup } from "./actions";
import { INITIAL_STATE } from "./auth-state";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { FormError, FormInfo } from "@/components/ui/FormMessage";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

type Mode = "login" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [loginState, loginAction, loginPending] = useActionState(login, INITIAL_STATE);
  const [signupState, signupAction, signupPending] = useActionState(signup, INITIAL_STATE);

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-bg px-5 py-16">
      <Card className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-title font-bold text-text">{APP_NAME}</h1>
          <p className="text-body text-text-muted">{APP_TAGLINE}</p>
        </div>

        <SegmentedControl
          options={[
            { value: "login", label: "Log in" },
            { value: "signup", label: "Sign up" },
          ]}
          value={mode}
          onChange={(value) => setMode(value as Mode)}
        />

        {mode === "login" ? (
          <form action={loginAction} className="flex flex-col gap-4">
            <Input id="email" name="email" type="email" label="Email" required autoComplete="email" />
            <Input
              id="password"
              name="password"
              type="password"
              label="Password"
              required
              autoComplete="current-password"
            />
            {loginState.error && <FormError>{loginState.error}</FormError>}
            <Button type="submit" disabled={loginPending} className="w-full">
              {loginPending ? "Logging in…" : "Log in"}
            </Button>
            <Link href="/forgot-password" className="text-center text-caption text-text-muted hover:text-text">
              Forgot password?
            </Link>
          </form>
        ) : (
          <form action={signupAction} className="flex flex-col gap-4">
            <Input id="fullName" name="fullName" type="text" label="Full name" required autoComplete="name" />
            <Input id="email" name="email" type="email" label="Email" required autoComplete="email" />
            <Input
              id="password"
              name="password"
              type="password"
              label="Password"
              required
              autoComplete="new-password"
            />
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              label="Confirm password"
              required
              autoComplete="new-password"
            />
            {signupState.error && <FormError>{signupState.error}</FormError>}
            {signupState.info && <FormInfo>{signupState.info}</FormInfo>}
            <Button type="submit" disabled={signupPending} className="w-full">
              {signupPending ? "Creating account…" : "Sign up"}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
