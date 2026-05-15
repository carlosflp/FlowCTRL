"use client";

import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "@/features/auth/auth-provider";
import { fetchPortfolios } from "@/lib/api/entities";
import type { Portfolio } from "@/types/domain";

const ACTIVE_PORTFOLIO_STORAGE_KEY = "flowctrl.activePortfolioId";

type PortfolioScopeContextValue = {
  portfolios: Portfolio[];
  activePortfolioId: string | null;
  activePortfolio: Portfolio | null;
  isLoading: boolean;
  hasAccessiblePortfolios: boolean;
  requiresPortfolioSelection: boolean;
  selectPortfolio: (portfolioId: string) => void;
  clearPortfolioSelection: () => void;
  refreshPortfolios: () => Promise<unknown>;
};

const PortfolioScopeContext = createContext<PortfolioScopeContextValue | null>(null);

export function PortfolioScopeProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitialized, user } = useAuth();
  const [activePortfolioId, setActivePortfolioId] = useState<string | null>(null);
  const [hasLoadedStoredSelection, setHasLoadedStoredSelection] = useState(false);

  const portfoliosQuery = useQuery({
    queryKey: ["portfolio-scope", "available", user?.id ?? "anonymous"],
    queryFn: fetchPortfolios,
    enabled: isInitialized && isAuthenticated,
  });

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    if (!isAuthenticated) {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(ACTIVE_PORTFOLIO_STORAGE_KEY);
      }
      setActivePortfolioId(null);
      setHasLoadedStoredSelection(true);
      return;
    }

    if (typeof window === "undefined") {
      setHasLoadedStoredSelection(true);
      return;
    }

    const storedPortfolioId = window.localStorage.getItem(ACTIVE_PORTFOLIO_STORAGE_KEY);
    setActivePortfolioId(storedPortfolioId || null);
    setHasLoadedStoredSelection(true);
  }, [isAuthenticated, isInitialized]);

  useEffect(() => {
    if (!isAuthenticated || !hasLoadedStoredSelection || !portfoliosQuery.data) {
      return;
    }

    if (!activePortfolioId) {
      return;
    }

    const isSelectionStillAccessible = portfoliosQuery.data.some(
      (portfolio) => portfolio.id === activePortfolioId,
    );

    if (isSelectionStillAccessible) {
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ACTIVE_PORTFOLIO_STORAGE_KEY);
    }
    setActivePortfolioId(null);
  }, [activePortfolioId, hasLoadedStoredSelection, isAuthenticated, portfoliosQuery.data]);

  const selectPortfolio = useCallback((portfolioId: string) => {
    setActivePortfolioId(portfolioId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACTIVE_PORTFOLIO_STORAGE_KEY, portfolioId);
    }
  }, []);

  const clearPortfolioSelection = useCallback(() => {
    setActivePortfolioId(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ACTIVE_PORTFOLIO_STORAGE_KEY);
    }
  }, []);

  const activePortfolio = useMemo(
    () =>
      portfoliosQuery.data?.find((portfolio) => portfolio.id === activePortfolioId) ?? null,
    [activePortfolioId, portfoliosQuery.data],
  );

  const value = useMemo<PortfolioScopeContextValue>(
    () => ({
      portfolios: portfoliosQuery.data ?? [],
      activePortfolioId,
      activePortfolio,
      isLoading:
        isAuthenticated && (!hasLoadedStoredSelection || portfoliosQuery.isLoading),
      hasAccessiblePortfolios: (portfoliosQuery.data?.length ?? 0) > 0,
      requiresPortfolioSelection:
        isAuthenticated &&
        hasLoadedStoredSelection &&
        !portfoliosQuery.isLoading &&
        (portfoliosQuery.data?.length ?? 0) > 0 &&
        !activePortfolioId,
      selectPortfolio,
      clearPortfolioSelection,
      refreshPortfolios: portfoliosQuery.refetch,
    }),
    [
      activePortfolio,
      activePortfolioId,
      clearPortfolioSelection,
      hasLoadedStoredSelection,
      isAuthenticated,
      portfoliosQuery.data,
      portfoliosQuery.isLoading,
      portfoliosQuery.refetch,
      selectPortfolio,
    ],
  );

  return (
    <PortfolioScopeContext.Provider value={value}>
      {children}
    </PortfolioScopeContext.Provider>
  );
}

export function usePortfolioScope(): PortfolioScopeContextValue {
  const context = useContext(PortfolioScopeContext);
  if (!context) {
    throw new Error("usePortfolioScope must be used within PortfolioScopeProvider.");
  }
  return context;
}
