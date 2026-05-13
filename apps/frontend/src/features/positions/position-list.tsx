"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SearchToolbar } from "@/components/search-toolbar";
import { fetchPortfolios, fetchPositionOverview, fetchPositions } from "@/lib/api/entities";
import { formatCurrency, formatPercentage } from "@/lib/formatters";

import { positionColumns } from "./columns";

function getTodayDateString(): string {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

export function PositionList() {
  const [query, setQuery] = useState("");
  const [selectedPortfolioId, setSelectedPortfolioId] = useState("");
  const [asOfDate, setAsOfDate] = useState(getTodayDateString());

  const portfoliosQuery = useQuery({
    queryKey: ["positions", "portfolios"],
    queryFn: fetchPortfolios,
  });
  const positionsQuery = useQuery({
    queryKey: ["positions", "list", selectedPortfolioId, asOfDate],
    queryFn: () =>
      fetchPositions({
        portfolioId: selectedPortfolioId || null,
        asOfDate,
      }),
  });
  const overviewQuery = useQuery({
    queryKey: ["positions", "overview", selectedPortfolioId, asOfDate],
    queryFn: () =>
      fetchPositionOverview({
        portfolioId: selectedPortfolioId || null,
        asOfDate,
      }),
  });

  const loading =
    portfoliosQuery.isLoading || positionsQuery.isLoading || overviewQuery.isLoading;
  const hasError =
    portfoliosQuery.isError || positionsQuery.isError || overviewQuery.isError;

  const filteredData = useMemo(() => {
    if (!positionsQuery.data) {
      return [];
    }

    const normalized = query.toLowerCase();
    if (!normalized) {
      return positionsQuery.data;
    }

    return positionsQuery.data.filter(
      (position) =>
        position.portfolio.name.toLowerCase().includes(normalized) ||
        position.asset.ticker.toLowerCase().includes(normalized) ||
        position.asset.name.toLowerCase().includes(normalized) ||
        position.asset.asset_type.toLowerCase().includes(normalized),
    );
  }, [positionsQuery.data, query]);

  return (
    <section className="space-y-8">
      <PageHeader
        title="Posicoes"
        description="Consolidacao inicial por carteira e ativo com base em operacoes aprovadas ou liquidadas e marcacao pelos ultimos precos disponiveis."
        actions={
          <button
            type="button"
            onClick={() => {
              void portfoliosQuery.refetch();
              void positionsQuery.refetch();
              void overviewQuery.refetch();
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink transition hover:bg-[#f0efeb]"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Atualizar</span>
          </button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-5 shadow-panel">
          <div className="text-sm text-muted">Posicoes abertas</div>
          <div className="mt-2 text-3xl font-semibold text-ink">
            {overviewQuery.data?.open_positions ?? 0}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5 shadow-panel">
          <div className="text-sm text-muted">Custo consolidado</div>
          <div className="mt-2 text-3xl font-semibold text-ink">
            {formatCurrency(overviewQuery.data?.total_cost_basis)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5 shadow-panel">
          <div className="text-sm text-muted">Valor de mercado</div>
          <div className="mt-2 text-3xl font-semibold text-ink">
            {formatCurrency(overviewQuery.data?.total_market_value)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5 shadow-panel">
          <div className="text-sm text-muted">Cobertura de precos</div>
          <div className="mt-2 text-3xl font-semibold text-ink">
            {formatPercentage(overviewQuery.data?.pricing_coverage_pct)}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5 shadow-panel">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-ink" htmlFor="positions-portfolio-filter">
              Carteira
            </label>
            <select
              id="positions-portfolio-filter"
              value={selectedPortfolioId}
              onChange={(event) => setSelectedPortfolioId(event.target.value)}
              className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none transition focus:border-accent"
            >
              <option value="">Todas as carteiras</option>
              {(portfoliosQuery.data ?? []).map((portfolio) => (
                <option key={portfolio.id} value={portfolio.id}>
                  {portfolio.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink" htmlFor="positions-date-filter">
              Data de referencia
            </label>
            <input
              id="positions-date-filter"
              type="date"
              value={asOfDate}
              onChange={(event) => setAsOfDate(event.target.value)}
              className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none transition focus:border-accent"
            />
          </div>

          <div className="rounded-lg border border-border bg-[#f7f7f4] px-4 py-3">
            <div className="text-sm font-medium text-ink">PnL nao realizado</div>
            <div className="mt-1 text-2xl font-semibold text-ink">
              {formatCurrency(overviewQuery.data?.total_unrealized_pnl)}
            </div>
            <div className="mt-1 text-sm text-muted">
              {overviewQuery.data?.priced_positions ?? 0} precificadas e{" "}
              {overviewQuery.data?.unpriced_positions ?? 0} sem preco
            </div>
          </div>
        </div>
      </div>

      <SearchToolbar placeholder="Buscar por carteira, ticker, ativo ou tipo" onSearch={setQuery} />

      {loading ? (
        <EmptyState title="Carregando posicoes" description="Consolidando operacoes e precos por carteira." />
      ) : hasError ? (
        <EmptyState
          title="Nao foi possivel carregar as posicoes"
          description="Confira se o backend esta disponivel e se ja existem operacoes e precos cadastrados."
        />
      ) : (
        <DataTable
          columns={positionColumns}
          data={filteredData}
          emptyMessage="Nenhuma posicao aberta encontrada para os filtros informados."
        />
      )}
    </section>
  );
}
