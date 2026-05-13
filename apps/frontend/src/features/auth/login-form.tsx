"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { getApiErrorMessage, useAuth } from "@/features/auth/auth-provider";

const loginSchema = z.object({
  email: z.string().min(3),
  password: z.string().min(8),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const { login } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 py-10">
      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="flex flex-col justify-center">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            FlowCTRL
          </div>
          <h1 className="max-w-xl text-4xl font-semibold text-ink">Access the internal asset platform</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted">
            Operational control for portfolios, assets, transactions, audit trails and reporting
            workflows in a single local platform.
          </p>
        </section>

        <section className="rounded-lg border border-border bg-surface p-8 shadow-panel">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-lg bg-accentSoft p-2 text-accent">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-semibold text-ink">Sign in</div>
              <div className="text-sm text-muted">Restricted access for internal users.</div>
            </div>
          </div>

          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(async (values) => {
              setErrorMessage(null);
              try {
                await login(values.email, values.password);
              } catch (error) {
                setErrorMessage(getApiErrorMessage(error));
              }
            })}
          >
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink" htmlFor="email">
                Email
              </label>
              <input
                {...form.register("email")}
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@flowctrl.local"
                className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none transition focus:border-accent"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-ink" htmlFor="password">
                Password
              </label>
              <input
                {...form.register("password")}
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none transition focus:border-accent"
              />
            </div>

            {errorMessage ? (
              <div className="rounded-lg border border-[#fecaca] bg-[#fff1f2] px-3 py-2 text-sm text-[#b91c1c]">
                {errorMessage}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:bg-[#115e59] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {form.formState.isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              <span>{form.formState.isSubmitting ? "Signing in..." : "Sign in"}</span>
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
