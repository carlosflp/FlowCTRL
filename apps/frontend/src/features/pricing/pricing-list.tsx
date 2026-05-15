"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { usePortfolioScope } from "@/components/portfolio-scope-provider";
import { SearchToolbar } from "@/components/search-toolbar";
import { fetchAssetPrices } from "@/lib/api/entities";

import { pricingColumns } from "./columns";

export function PricingList() {
  const [query, setQuery] = useState("");
  const { activePortfolio, activePortfolioId } = usePortfolioScope();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["pricing", activePortfolioId],
    queryFn: () => fetchAssetPrices({ portfolioId: activePortfolioId }),
  });

  const filteredData = useMemo(() => {
    if (!data) {
      return [];
    }

    const normalized = query.toLowerCase();
    if (!normalized) {
      return data;
    }

    return data.filter(
      (price) =>
        price.asset.ticker.toLowerCase().includes(normalized) ||
        price.asset.name.toLowerCase().includes(normalized) ||
        price.source.toLowerCase().includes(normalized),
    );
  }, [data, query]);

  return (
    <section>
      <PageHeader
        title="Precos"
        description={
          activePortfolio
            ? `Historico de precos dos ativos ligados a ${activePortfolio.name}.`
            : "Historico de precos dos ativos da carteira selecionada."
        }
      />

      <SearchToolbar placeholder="Buscar por ativo ou fonte" onSearch={setQuery} />

      {isLoading ? (
        <EmptyState title="Carregando precos" description="Consultando a base de precificacao da carteira ativa." />
      ) : isError ? (
        <EmptyState
          title="Nao foi possivel carregar os precos"
          description="Valide a autenticacao e se a carteira selecionada continua acessivel."
        />
      ) : (
        <DataTable columns={pricingColumns} data={filteredData} emptyMessage="Nenhum preco encontrado para a carteira ativa." />
      )}
    </section>
  );
}
