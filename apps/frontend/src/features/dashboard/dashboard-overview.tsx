"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BriefcaseBusiness, ClipboardList, Landmark } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { fetchAssets, fetchOperations, fetchPortfolios } from "@/lib/api/entities";

const summaryCards = [
  {
    key: "portfolios",
    label: "Carteiras",
    icon: BriefcaseBusiness,
    description: "Estratégias sob gestão com base operacional inicial.",
  },
  {
    key: "assets",
    label: "Ativos",
    icon: Landmark,
    description: "Instrumentos cadastrados para negociação e precificação.",
  },
  {
    key: "operations",
    label: "Operações",
    icon: ClipboardList,
    description: "Transações registradas com trilha básica de auditoria.",
  },
] as const;

export function DashboardOverview() {
  const portfoliosQuery = useQuery({ queryKey: ["dashboard", "portfolios"], queryFn: fetchPortfolios });
  const assetsQuery = useQuery({ queryKey: ["dashboard", "assets"], queryFn: fetchAssets });
  const operationsQuery = useQuery({ queryKey: ["dashboard", "operations"], queryFn: fetchOperations });

  const loading = portfoliosQuery.isLoading || assetsQuery.isLoading || operationsQuery.isLoading;
  const hasError = portfoliosQuery.isError || assetsQuery.isError || operationsQuery.isError;
  const recentOperations = operationsQuery.data?.slice(0, 5) ?? [];

  const metrics = {
    portfolios: portfoliosQuery.data?.length ?? 0,
    assets: assetsQuery.data?.length ?? 0,
    operations: operationsQuery.data?.length ?? 0,
  };

  return (
    <section className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Visão executiva inicial do estado operacional da plataforma, preparada para receber indicadores, posição consolidada e monitoramento de processos."
      />

      {loading ? (
        <EmptyState title="Carregando visão geral" description="Consultando dados da base operacional." />
      ) : hasError ? (
        <EmptyState
          title="Dashboard indisponível"
          description="Os serviços ainda não responderam como esperado. Suba o backend e execute as migrations antes de usar o painel."
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {summaryCards.map((card) => {
              const Icon = card.icon;

              return (
                <div key={card.key} className="rounded-lg border border-border bg-surface p-5 shadow-panel">
                  <div className="flex items-start justify-between">
                    <div className="rounded-lg bg-accentSoft p-2 text-accent">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-3xl font-semibold text-ink">{metrics[card.key]}</div>
                  </div>
                  <div className="mt-5">
                    <div className="text-base font-semibold text-ink">{card.label}</div>
                    <p className="mt-1 text-sm leading-6 text-muted">{card.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-lg border border-border bg-surface p-6 shadow-panel">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">Operações recentes</h2>
                <p className="mt-1 text-sm text-muted">Últimos registros lançados na base.</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted" />
            </div>

            {recentOperations.length === 0 ? (
              <EmptyState
                title="Sem operações registradas"
                description="Quando as primeiras operações forem cadastradas, elas aparecerão aqui para acompanhamento rápido."
              />
            ) : (
              <div className="space-y-3">
                {recentOperations.map((operation) => (
                  <div
                    key={operation.id}
                    className="flex flex-col gap-3 rounded-lg border border-border px-4 py-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="text-sm font-semibold text-ink">
                        {operation.asset.ticker} em {operation.portfolio.name}
                      </div>
                      <div className="mt-1 text-sm text-muted">
                        {operation.operation_type} | trade {operation.trade_date} | settle {operation.settlement_date}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium text-ink">{operation.net_value}</div>
                      <StatusBadge value={operation.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

