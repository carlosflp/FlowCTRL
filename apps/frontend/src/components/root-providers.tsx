"use client";

import { AuthProvider } from "@/features/auth/auth-provider";
import { QueryProvider } from "@/lib/query-provider";

import { AppFrame } from "./app-frame";
import { PortfolioScopeProvider } from "./portfolio-scope-provider";

export function RootProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <PortfolioScopeProvider>
          <AppFrame>{children}</AppFrame>
        </PortfolioScopeProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
