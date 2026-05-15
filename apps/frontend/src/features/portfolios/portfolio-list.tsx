"use client";

import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SearchToolbar } from "@/components/search-toolbar";
import { StatusBadge } from "@/components/status-badge";

import { usePortfolioScope } from "@/components/portfolio-scope-provider";
import { useAuth } from "@/features/auth/auth-provider";

export function PortfolioList() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    activePortfolioId,
    hasAccessiblePortfolios,
    isLoading,
    portfolios,
    refreshPortfolios,
    selectPortfolio,
  } = usePortfolioScope();
  const [query, setQuery] = useState("");

  const filteredPortfolios = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return portfolios;
    }

    return portfolios.filter(
      (portfolio) =>
        portfolio.name.toLowerCase().includes(normalizedQuery) ||
        portfolio.base_currency.toLowerCase().includes(normalizedQuery) ||
        (portfolio.benchmark ?? "").toLowerCase().includes(normalizedQuery),
    );
  }, [portfolios, query]);

  return (
    <section className="space-y-8">
      <PageHeader
        title="Carteiras"
        description="Escolha a carteira ativa da sessao. O dashboard, operacoes, caixa, ativos, precos, posicoes e relatorios passam a respeitar esse escopo ate voce trocar novamente."
        actions={
          <button
            type="button"
            onClick={() => {
              void refreshPortfolios();
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink transition hover:bg-[#f0efeb]"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Atualizar</span>
          </button>
        }
      />

      <div className="rounded-lg border border-border bg-surface p-5 shadow-panel">
        <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr_0.8fr]">
          <div>
            <div className="text-sm font-semibold text-ink">Escopo atual da sessao</div>
            <p className="mt-2 text-sm leading-6 text-muted">
              {activePortfolioId
                ? "A plataforma inteira esta trabalhando com uma carteira ativa. Troque aqui sempre que quiser navegar com outro contexto."
                : "Nenhuma carteira foi escolhida ainda. Selecione uma abaixo para liberar as demais areas do sistema."}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-[#f7f7f4] px-4 py-4">
            <div className="text-sm text-muted">Carteiras liberadas</div>
            <div className="mt-2 text-3xl font-semibold text-ink">{portfolios.length}</div>
          </div>
          <div className="rounded-lg border border-border bg-[#f7f7f4] px-4 py-4">
            <div className="text-sm text-muted">Perfil</div>
            <div className="mt-2 text-3xl font-semibold capitalize text-ink">{user?.role ?? "-"}</div>
          </div>
        </div>
      </div>

      <SearchToolbar placeholder="Buscar por nome, benchmark ou moeda" onSearch={setQuery} />

      {isLoading ? (
        <EmptyState title="Carregando carteiras" description="Buscando as carteiras disponiveis para esta conta." />
      ) : !hasAccessiblePortfolios ? (
        <EmptyState
          title="Nenhuma carteira disponivel"
          description="Essa conta ainda nao recebeu acesso a nenhuma carteira. Um administrador pode ajustar isso na tela de usuarios."
        />
      ) : filteredPortfolios.length === 0 ? (
        <EmptyState
          title="Nenhuma carteira encontrada"
          description="Ajuste a busca para localizar a carteira que voce quer ativar."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredPortfolios.map((portfolio) => {
            const isActiveSelection = portfolio.id === activePortfolioId;

            return (
              <article
                key={portfolio.id}
                className={
                  isActiveSelection
                    ? "rounded-xl border border-accent bg-[#f0fdfa] p-5 shadow-panel"
                    : "rounded-xl border border-border bg-surface p-5 shadow-panel"
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div>
                      <div className="text-lg font-semibold text-ink">{portfolio.name}</div>
                      <p className="mt-1 text-sm leading-6 text-muted">
                        {portfolio.benchmark
                          ? `Benchmark ${portfolio.benchmark} | Moeda base ${portfolio.base_currency}`
                          : `Moeda base ${portfolio.base_currency}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge value={portfolio.is_active} />
                      {isActiveSelection ? (
                        <span className="inline-flex rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-white">
                          Carteira em uso
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[220px]">
                    <button
                      type="button"
                      onClick={() => {
                        selectPortfolio(portfolio.id);
                        router.push("/dashboard");
                      }}
                      className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:bg-[#115e59]"
                    >
                      {isActiveSelection ? "Abrir dashboard" : "Usar esta carteira"}
                    </button>
                    {!isActiveSelection ? (
                      <button
                        type="button"
                        onClick={() => {
                          selectPortfolio(portfolio.id);
                        }}
                        className="inline-flex h-11 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-ink transition hover:bg-[#f0efeb]"
                      >
                        Definir sem sair da pagina
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-border bg-white px-4 py-4 text-sm text-muted">
                  {portfolio.description && portfolio.description.trim().length > 0
                    ? portfolio.description
                    : "Sem descricao operacional cadastrada para esta carteira."}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
