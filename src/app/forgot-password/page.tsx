"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/app/login/actions";
import { INITIAL_STATE } from "@/app/login/auth-state";
import { APP_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { FormError, FormInfo } from "@/components/ui/FormMessage";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, INITIAL_STATE);

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-bg px-5 py-16">
      <Card className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-title font-bold text-text">Reset your password</h1>
          <p className="text-body text-text-muted">
            Enter the email you use for {APP_NAME} and we&apos;ll send you a reset link.
          </p>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          <Input id="email" name="email" type="email" label="Email" required autoComplete="email" />
          {state.error && <FormError>{state.error}</FormError>}
          {state.info && <FormInfo>{state.info}</FormInfo>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </form>

        <Link href="/login" className="text-center text-caption text-text-muted hover:text-text">
          Back to log in
        </Link>
      </Card>
    </main>
  );
}
