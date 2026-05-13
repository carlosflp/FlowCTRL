"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  ApiError,
  apiGet,
  apiPost,
  clearStoredAccessToken,
  getStoredAccessToken,
  setStoredAccessToken,
} from "@/lib/api/client";
import { authTokenSchema, userSchema } from "@/lib/api/schemas";
import type { User } from "@/types/domain";

type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const logout = useCallback(() => {
    clearStoredAccessToken();
    setUser(null);
    queryClient.clear();
    router.replace("/login");
  }, [queryClient, router]);

  const loadCurrentUser = useCallback(async (token: string) => {
    try {
      const currentUser = await apiGet("/auth/me", userSchema, { token });
      setUser(currentUser);
    } catch {
      clearStoredAccessToken();
      setUser(null);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) {
      setIsInitialized(true);
      return;
    }
    void loadCurrentUser(token);
  }, [loadCurrentUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiPost(
        "/auth/login",
        { email, password },
        authTokenSchema,
        { auth: false },
      );
      setStoredAccessToken(response.access_token);
      setUser(response.user);
      queryClient.clear();
      router.replace("/dashboard");
    },
    [queryClient, router],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isInitialized,
      login,
      logout,
    }),
    [isInitialized, login, logout, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.detail ?? "Authentication failed.";
  }
  return "Authentication failed.";
}
