"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BriefcaseBusiness,
  ClipboardList,
  DollarSign,
  FileSpreadsheet,
  LayoutGrid,
  LogOut,
  PieChart,
  Wallet,
} from "lucide-react";

import { useAuth } from "@/features/auth/auth-provider";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/portfolios", label: "Carteiras", icon: BriefcaseBusiness },
  { href: "/assets", label: "Ativos", icon: BarChart3 },
  { href: "/operations", label: "Operacoes", icon: ClipboardList },
  { href: "/cashflow", label: "Caixa", icon: Wallet },
  { href: "/pricing", label: "Precos", icon: DollarSign },
  { href: "/positions", label: "Posicoes", icon: PieChart },
  { href: "/reports", label: "Relatorios", icon: FileSpreadsheet },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { logout, user } = useAuth();

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
          </div>

          <nav className="flex-1 px-4 py-5">
            <ul className="space-y-1">
              {navigation.map((item) => {
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
            <button
              type="button"
              onClick={logout}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink transition hover:bg-[#f0efeb]"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="border-b border-border bg-surface px-5 py-4 lg:hidden">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">FlowCTRL</div>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </header>
          <main className="flex-1 px-5 py-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
