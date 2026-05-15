"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/features/auth/auth-provider";

import { AppShell } from "./app-shell";
import { usePortfolioScope } from "./portfolio-scope-provider";

const PUBLIC_ROUTES = new Set(["/login"]);
const PORTFOLIO_OPTIONAL_ROUTES = new Set(["/portfolios", "/profile", "/users", "/audit"]);

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
  const {
    activePortfolioId,
    hasAccessiblePortfolios,
    isLoading: isPortfolioScopeLoading,
    requiresPortfolioSelection,
  } = usePortfolioScope();

  const isPublicRoute = PUBLIC_ROUTES.has(pathname);
  const routeRequiresPortfolioSelection = !PORTFOLIO_OPTIONAL_ROUTES.has(pathname);

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    if (!isAuthenticated && !isPublicRoute) {
      router.replace("/login");
      return;
    }

    if (isAuthenticated && isPublicRoute) {
      router.replace(activePortfolioId ? "/dashboard" : "/portfolios");
      return;
    }

    if (
      isAuthenticated &&
      !isPublicRoute &&
      routeRequiresPortfolioSelection &&
      !isPortfolioScopeLoading &&
      (!hasAccessiblePortfolios || requiresPortfolioSelection)
    ) {
      router.replace("/portfolios");
    }
  }, [
    activePortfolioId,
    hasAccessiblePortfolios,
    isAuthenticated,
    isInitialized,
    isPortfolioScopeLoading,
    isPublicRoute,
    requiresPortfolioSelection,
    routeRequiresPortfolioSelection,
    router,
  ]);

  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (!isInitialized) {
    return <FullScreenState label="Loading session..." />;
  }

  if (!isAuthenticated) {
    return <FullScreenState label="Redirecting to login..." />;
  }

  if (routeRequiresPortfolioSelection && isPortfolioScopeLoading) {
    return <FullScreenState label="Loading portfolios..." />;
  }

  if (routeRequiresPortfolioSelection && (!hasAccessiblePortfolios || requiresPortfolioSelection)) {
    return <FullScreenState label="Redirecting to portfolio selection..." />;
  }

  return <AppShell>{children}</AppShell>;
}
