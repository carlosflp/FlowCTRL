"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BriefcaseBusiness,
  ClipboardList,
  DollarSign,
  Landmark,
  PieChart,
  Wallet,
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { usePortfolioScope } from "@/components/portfolio-scope-provider";
import { StatusBadge } from "@/components/status-badge";
import {
  fetchAssetPrices,
  fetchAssets,
  fetchCashflowEntries,
  fetchOperations,
  fetchPositionOverview,
} from "@/lib/api/entities";
import { formatCurrency, formatPercentage } from "@/lib/formatters";

const summaryCards = [
  {
    key: "portfolios",
    label: "Carteira ativa",
    icon: BriefcaseBusiness,
    description: "Escopo operacional em uso nesta sessao.",
  },
  {
    key: "assets",
    label: "Ativos",
    icon: Landmark,
    description: "Instrumentos associados a carteira selecionada.",
  },
  {
    key: "operations",
    label: "Operacoes",
    icon: ClipboardList,
    description: "Transacoes registradas dentro do escopo ativo.",
  },
  {
    key: "cashflow",
    label: "Caixa",
    icon: Wallet,
    description: "Eventos de caixa da carteira atualmente selecionada.",
  },
  {
    key: "pricing",
    label: "Precos",
    icon: DollarSign,
    description: "Base de precificacao relevante para a carteira ativa.",
  },
  {
    key: "positions",
    label: "Posicoes",
    icon: PieChart,
    description: "Posicoes abertas consolidadas para a carteira em uso.",
  },
] as const;

export function DashboardOverview() {
  const { activePortfolio, activePortfolioId } = usePortfolioScope();
  const assetsQuery = useQuery({
    queryKey: ["dashboard", "assets", activePortfolioId],
    queryFn: () => fetchAssets({ portfolioId: activePortfolioId }),
  });
  const operationsQuery = useQuery({
    queryKey: ["dashboard", "operations", activePortfolioId],
    queryFn: () => fetchOperations({ portfolioId: activePortfolioId }),
  });
  const cashflowQuery = useQuery({
    queryKey: ["dashboard", "cashflow", activePortfolioId],
    queryFn: () => fetchCashflowEntries({ portfolioId: activePortfolioId }),
  });
  const pricingQuery = useQuery({
    queryKey: ["dashboard", "pricing", activePortfolioId],
    queryFn: () => fetchAssetPrices({ portfolioId: activePortfolioId }),
  });
  const positionsOverviewQuery = useQuery({
    queryKey: ["dashboard", "positions", "overview", activePortfolioId],
    queryFn: () => fetchPositionOverview({ portfolioId: activePortfolioId }),
  });

  const loading =
    assetsQuery.isLoading ||
    operationsQuery.isLoading ||
    cashflowQuery.isLoading ||
    pricingQuery.isLoading ||
    positionsOverviewQuery.isLoading;
  const hasError =
    assetsQuery.isError ||
    operationsQuery.isError ||
    cashflowQuery.isError ||
    pricingQuery.isError ||
    positionsOverviewQuery.isError;
  const recentOperations = operationsQuery.data?.slice(0, 5) ?? [];
  const recentCashflow = cashflowQuery.data?.slice(0, 4) ?? [];

  const metrics = {
    portfolios: activePortfolio ? 1 : 0,
    assets: assetsQuery.data?.length ?? 0,
    operations: operationsQuery.data?.length ?? 0,
    cashflow: cashflowQuery.data?.length ?? 0,
    pricing: pricingQuery.data?.length ?? 0,
    positions: positionsOverviewQuery.data?.open_positions ?? 0,
  };

  return (
    <section className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={
          activePortfolio
            ? `Visao executiva da carteira ativa ${activePortfolio.name}, reunindo atividade operacional, caixa, precificacao e consolidacao de posicoes.`
            : "Visao executiva da carteira selecionada."
        }
      />

      {loading ? (
        <EmptyState title="Carregando visao geral" description="Consultando os dados da carteira ativa." />
      ) : hasError ? (
        <EmptyState
          title="Dashboard indisponivel"
          description="Os servicos ainda nao responderam como esperado para a carteira selecionada."
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
            <div className="rounded-lg border border-border bg-surface p-6 shadow-panel xl:col-span-2">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-ink">Posicao consolidada</h2>
                  <p className="mt-1 text-sm text-muted">
                    Snapshot baseado em operacoes aprovadas ou liquidadas e nos ultimos precos disponiveis da carteira ativa.
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted" />
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-border px-4 py-4">
                  <div className="text-sm text-muted">Custo consolidado</div>
                  <div className="mt-2 text-2xl font-semibold text-ink">
                    {formatCurrency(positionsOverviewQuery.data?.total_cost_basis)}
                  </div>
                </div>
                <div className="rounded-lg border border-border px-4 py-4">
                  <div className="text-sm text-muted">Valor de mercado</div>
                  <div className="mt-2 text-2xl font-semibold text-ink">
                    {formatCurrency(positionsOverviewQuery.data?.total_market_value)}
                  </div>
                </div>
                <div className="rounded-lg border border-border px-4 py-4">
                  <div className="text-sm text-muted">PnL nao realizado</div>
                  <div className="mt-2 text-2xl font-semibold text-ink">
                    {formatCurrency(positionsOverviewQuery.data?.total_unrealized_pnl)}
                  </div>
                </div>
                <div className="rounded-lg border border-border px-4 py-4">
                  <div className="text-sm text-muted">Cobertura de precos</div>
                  <div className="mt-2 text-2xl font-semibold text-ink">
                    {formatPercentage(positionsOverviewQuery.data?.pricing_coverage_pct)}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface p-6 shadow-panel">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-ink">Operacoes recentes</h2>
                  <p className="mt-1 text-sm text-muted">Ultimos registros da carteira ativa.</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted" />
              </div>

              {recentOperations.length === 0 ? (
                <EmptyState
                  title="Sem operacoes registradas"
                  description="Quando a carteira ativa receber operacoes, elas aparecerao aqui."
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
                  <p className="mt-1 text-sm text-muted">Movimentos mais recentes da carteira ativa.</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted" />
              </div>

              {recentCashflow.length === 0 ? (
                <EmptyState
                  title="Sem movimentos de caixa"
                  description="Os eventos de caixa da carteira ativa passarao a aparecer aqui assim que forem registrados."
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
