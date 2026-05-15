"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { usePortfolioScope } from "@/components/portfolio-scope-provider";
import { SearchToolbar } from "@/components/search-toolbar";
import { fetchAssets } from "@/lib/api/entities";

import { assetColumns } from "./columns";

export function AssetList() {
  const [query, setQuery] = useState("");
  const { activePortfolio, activePortfolioId } = usePortfolioScope();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["assets", activePortfolioId],
    queryFn: () => fetchAssets({ portfolioId: activePortfolioId }),
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
      (asset) =>
        asset.ticker.toLowerCase().includes(normalized) ||
        asset.name.toLowerCase().includes(normalized) ||
        asset.asset_type.toLowerCase().includes(normalized),
    );
  }, [data, query]);

  return (
    <section>
      <PageHeader
        title="Ativos"
        description={
          activePortfolio
            ? `Catalogo de ativos associado a ${activePortfolio.name}.`
            : "Catalogo de ativos associado a carteira selecionada."
        }
      />

      <SearchToolbar placeholder="Buscar por ticker, nome ou tipo" onSearch={setQuery} />

      {isLoading ? (
        <EmptyState title="Carregando ativos" description="Consultando os ativos relacionados a carteira ativa." />
      ) : isError ? (
        <EmptyState
          title="Nao foi possivel carregar os ativos"
          description="Valide a conexao do frontend com o backend e a permissao da carteira selecionada."
        />
      ) : (
        <DataTable columns={assetColumns} data={filteredData} emptyMessage="Nenhum ativo encontrado para a carteira ativa." />
      )}
    </section>
  );
}
