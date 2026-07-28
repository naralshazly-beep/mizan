"use client";

import { useActionState } from "react";
import { updatePassword } from "@/app/login/actions";
import { INITIAL_STATE } from "@/app/login/auth-state";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { FormError } from "@/components/ui/FormMessage";

export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(updatePassword, INITIAL_STATE);

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-bg px-5 py-16">
      <Card className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-title font-bold text-text">Set a new password</h1>
          <p className="text-body text-text-muted">Choose a new password for your account.</p>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          <Input
            id="password"
            name="password"
            type="password"
            label="New password"
            required
            autoComplete="new-password"
          />
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            label="Confirm new password"
            required
            autoComplete="new-password"
          />
          {state.error && <FormError>{state.error}</FormError>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Saving…" : "Save password"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
