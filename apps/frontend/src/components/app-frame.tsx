"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/features/auth/auth-provider";

import { AppShell } from "./app-shell";

const PUBLIC_ROUTES = new Set(["/login"]);

function FullScreenState({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="text-sm font-medium text-muted">{label}</div>
    </div>
  );
}

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isInitialized } = useAuth();

  const isPublicRoute = PUBLIC_ROUTES.has(pathname);

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    if (!isAuthenticated && !isPublicRoute) {
      router.replace("/login");
      return;
    }

    if (isAuthenticated && isPublicRoute) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isInitialized, isPublicRoute, router]);

  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (!isInitialized) {
    return <FullScreenState label="Loading session..." />;
  }

  if (!isAuthenticated) {
    return <FullScreenState label="Redirecting to login..." />;
  }

  return <AppShell>{children}</AppShell>;
}
