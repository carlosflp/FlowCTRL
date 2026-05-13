"use client";

import { AuthProvider } from "@/features/auth/auth-provider";
import { QueryProvider } from "@/lib/query-provider";

import { AppFrame } from "./app-frame";

export function RootProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <AppFrame>{children}</AppFrame>
      </AuthProvider>
    </QueryProvider>
  );
}
