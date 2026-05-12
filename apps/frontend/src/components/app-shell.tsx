"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BriefcaseBusiness, ClipboardList, FileSpreadsheet, LayoutGrid } from "lucide-react";

import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/portfolios", label: "Carteiras", icon: BriefcaseBusiness },
  { href: "/assets", label: "Ativos", icon: BarChart3 },
  { href: "/operations", label: "Operações", icon: ClipboardList },
  { href: "/reports", label: "Relatórios", icon: FileSpreadsheet },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto flex min-h-screen max-w-[1680px]">
        <aside className="hidden w-72 shrink-0 border-r border-border bg-surface lg:flex lg:flex-col">
          <div className="border-b border-border px-7 py-6">
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">FlowCTRL</div>
            <div className="mt-2 text-2xl font-semibold text-ink">Asset Platform</div>
            <p className="mt-2 max-w-xs text-sm leading-6 text-muted">
              Base operacional para controle de carteiras, ativos, operações e relatórios internos.
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
            Ambiente local com Next.js, FastAPI, PostgreSQL, Redis e MinIO.
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="border-b border-border bg-surface px-5 py-4 lg:hidden">
            <div className="text-lg font-semibold">FlowCTRL</div>
          </header>
          <main className="flex-1 px-5 py-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

