"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BriefcaseBusiness,
  ClipboardList,
  DollarSign,
  FileSpreadsheet,
  History,
  LayoutGrid,
  LogOut,
  PieChart,
  ShieldCheck,
  Upload,
  UserRound,
  Wallet,
} from "lucide-react";

import { useAuth } from "@/features/auth/auth-provider";
import { cn } from "@/lib/utils";

import { usePortfolioScope } from "./portfolio-scope-provider";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/portfolios", label: "Carteiras", icon: BriefcaseBusiness },
  { href: "/assets", label: "Ativos", icon: BarChart3 },
  { href: "/operations", label: "Operacoes", icon: ClipboardList },
  { href: "/cashflow", label: "Caixa", icon: Wallet },
  { href: "/pricing", label: "Precos", icon: DollarSign },
  { href: "/positions", label: "Posicoes", icon: PieChart },
  { href: "/reports", label: "Relatorios", icon: FileSpreadsheet },
  { href: "/imports", label: "Importacoes", icon: Upload },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const { activePortfolio, hasAccessiblePortfolios } = usePortfolioScope();
  const isProfileRoute = pathname === "/profile";
  const navigationItems =
    user?.role === "admin"
      ? [
          ...navigation,
          { href: "/audit", label: "Auditoria", icon: History },
          { href: "/users", label: "Usuarios", icon: ShieldCheck },
        ]
      : navigation;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto flex min-h-screen max-w-[1680px]">
        <aside className="hidden w-72 shrink-0 border-r border-border bg-surface lg:flex lg:flex-col">
          <div className="border-b border-border px-7 py-6">
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">FlowCTRL</div>
            <div className="mt-2 text-2xl font-semibold text-ink">Asset Platform</div>
            <p className="mt-2 max-w-xs text-sm leading-6 text-muted">
              Operational control for portfolios, assets, cash events, pricing and reporting workflows.
            </p>

            <div className="mt-5 rounded-xl border border-border bg-[#f7f7f4] px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                Carteira ativa
              </div>
              <div className="mt-2 text-sm font-semibold text-ink">
                {activePortfolio?.name ?? "Nenhuma carteira selecionada"}
              </div>
              <div className="mt-1 text-xs leading-5 text-muted">
                {activePortfolio
                  ? `${activePortfolio.base_currency}${activePortfolio.benchmark ? ` | ${activePortfolio.benchmark}` : ""}`
                  : hasAccessiblePortfolios
                    ? "Escolha uma carteira para filtrar o restante da plataforma."
                    : "Nenhuma carteira disponivel para este usuario no momento."}
              </div>
              <Link
                href="/portfolios"
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-ink transition hover:bg-[#f0efeb]"
              >
                <BriefcaseBusiness className="h-4 w-4" />
                <span>{activePortfolio ? "Trocar carteira" : "Escolher carteira"}</span>
              </Link>
            </div>
          </div>

          <nav className="flex-1 px-4 py-5">
            <ul className="space-y-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                        active
                          ? "bg-accent text-white shadow-panel"
                          : "text-muted hover:bg-[#f0efeb] hover:text-ink",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="border-t border-border px-7 py-5 text-sm text-muted">
            <div className="font-medium text-ink">{user?.full_name}</div>
            <div className="mt-1 lowercase">{user?.role}</div>
            <Link
              href="/profile"
              className={cn(
                "mt-4 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
                isProfileRoute
                  ? "border-accent bg-accentSoft text-accent"
                  : "border-border text-ink hover:bg-[#f0efeb]",
              )}
            >
              <UserRound className="h-4 w-4" />
              <span>Minha conta</span>
            </Link>
            <button
              type="button"
              onClick={logout}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink transition hover:bg-[#f0efeb]"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="border-b border-border bg-surface px-5 py-4 lg:hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">FlowCTRL</div>
                <div className="text-xs text-muted">
                  {activePortfolio?.name ?? "Selecione uma carteira"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/portfolios"
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink"
                >
                  <BriefcaseBusiness className="h-4 w-4" />
                  <span>Carteiras</span>
                </Link>
                <Link
                  href="/profile"
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium",
                    isProfileRoute
                      ? "border-accent bg-accentSoft text-accent"
                      : "border-border text-ink",
                  )}
                >
                  <UserRound className="h-4 w-4" />
                  <span>Conta</span>
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </header>
          <main className="flex-1 px-5 py-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
