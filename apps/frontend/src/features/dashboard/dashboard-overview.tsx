"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BriefcaseBusiness,
  ClipboardList,
  DollarSign,
  Landmark,
  Wallet,
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import {
  fetchAssetPrices,
  fetchAssets,
  fetchCashflowEntries,
  fetchOperations,
  fetchPortfolios,
} from "@/lib/api/entities";

const summaryCards = [
  {
    key: "portfolios",
    label: "Carteiras",
    icon: BriefcaseBusiness,
    description: "Estrategias sob gestao com base operacional inicial.",
  },
  {
    key: "assets",
    label: "Ativos",
    icon: Landmark,
    description: "Instrumentos cadastrados para negociacao e precificacao.",
  },
  {
    key: "operations",
    label: "Operacoes",
    icon: ClipboardList,
    description: "Transacoes registradas com trilha basica de auditoria.",
  },
  {
    key: "cashflow",
    label: "Caixa",
    icon: Wallet,
    description: "Entradas, saidas e ajustes para acompanhar liquidacao.",
  },
  {
    key: "pricing",
    label: "Precos",
    icon: DollarSign,
    description: "Precos historicos para validacao e mark-to-market futuro.",
  },
] as const;

export function DashboardOverview() {
  const portfoliosQuery = useQuery({ queryKey: ["dashboard", "portfolios"], queryFn: fetchPortfolios });
  const assetsQuery = useQuery({ queryKey: ["dashboard", "assets"], queryFn: fetchAssets });
  const operationsQuery = useQuery({ queryKey: ["dashboard", "operations"], queryFn: fetchOperations });
  const cashflowQuery = useQuery({ queryKey: ["dashboard", "cashflow"], queryFn: fetchCashflowEntries });
  const pricingQuery = useQuery({ queryKey: ["dashboard", "pricing"], queryFn: fetchAssetPrices });

  const loading =
    portfoliosQuery.isLoading ||
    assetsQuery.isLoading ||
    operationsQuery.isLoading ||
    cashflowQuery.isLoading ||
    pricingQuery.isLoading;
  const hasError =
    portfoliosQuery.isError ||
    assetsQuery.isError ||
    operationsQuery.isError ||
    cashflowQuery.isError ||
    pricingQuery.isError;
  const recentOperations = operationsQuery.data?.slice(0, 5) ?? [];
  const recentCashflow = cashflowQuery.data?.slice(0, 4) ?? [];

  const metrics = {
    portfolios: portfoliosQuery.data?.length ?? 0,
    assets: assetsQuery.data?.length ?? 0,
    operations: operationsQuery.data?.length ?? 0,
    cashflow: cashflowQuery.data?.length ?? 0,
    pricing: pricingQuery.data?.length ?? 0,
  };

  return (
    <section className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Visao executiva inicial do estado operacional da plataforma, com espaco para posicao, caixa, precificacao e monitoramento de processos."
      />

      {loading ? (
        <EmptyState title="Carregando visao geral" description="Consultando dados da base operacional." />
      ) : hasError ? (
        <EmptyState
          title="Dashboard indisponivel"
          description="Os servicos ainda nao responderam como esperado. Suba o backend e execute as migrations antes de usar o painel."
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-lg border border-border bg-surface p-6 shadow-panel">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-ink">Operacoes recentes</h2>
                  <p className="mt-1 text-sm text-muted">Ultimos registros lancados na base.</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted" />
              </div>

              {recentOperations.length === 0 ? (
                <EmptyState
                  title="Sem operacoes registradas"
                  description="Quando as primeiras operacoes forem cadastradas, elas aparecerao aqui para acompanhamento rapido."
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

            <div className="rounded-lg border border-border bg-surface p-6 shadow-panel">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-ink">Caixa recente</h2>
                  <p className="mt-1 text-sm text-muted">Movimentos mais recentes por carteira.</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted" />
              </div>

              {recentCashflow.length === 0 ? (
                <EmptyState
                  title="Sem movimentos de caixa"
                  description="Os eventos de caixa passarao a aparecer aqui assim que forem registrados."
                />
              ) : (
                <div className="space-y-3">
                  {recentCashflow.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex flex-col gap-3 rounded-lg border border-border px-4 py-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <div className="text-sm font-semibold text-ink">
                          {entry.description} em {entry.portfolio.name}
                        </div>
                        <div className="mt-1 text-sm text-muted">
                          {entry.entry_type} | entry {entry.entry_date} | settle {entry.settlement_date}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-medium text-ink">{entry.amount}</div>
                        <StatusBadge value={entry.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
