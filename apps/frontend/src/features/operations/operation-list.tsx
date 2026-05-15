"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { usePortfolioScope } from "@/components/portfolio-scope-provider";
import { SearchToolbar } from "@/components/search-toolbar";
import { fetchOperations } from "@/lib/api/entities";

import { operationColumns } from "./columns";

export function OperationList() {
  const [query, setQuery] = useState("");
  const { activePortfolio, activePortfolioId } = usePortfolioScope();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["operations", activePortfolioId],
    queryFn: () => fetchOperations({ portfolioId: activePortfolioId }),
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
      (operation) =>
        operation.portfolio.name.toLowerCase().includes(normalized) ||
        operation.asset.ticker.toLowerCase().includes(normalized) ||
        operation.operation_type.toLowerCase().includes(normalized) ||
        operation.status.toLowerCase().includes(normalized),
    );
  }, [data, query]);

  return (
    <section>
      <PageHeader
        title="Operacoes"
        description={
          activePortfolio
            ? `Registro operacional filtrado pela carteira ativa ${activePortfolio.name}.`
            : "Registro operacional da carteira selecionada."
        }
      />

      <SearchToolbar placeholder="Buscar por carteira, ativo, tipo ou status" onSearch={setQuery} />

      {isLoading ? (
        <EmptyState title="Carregando operacoes" description="Buscando o historico operacional da carteira ativa." />
      ) : isError ? (
        <EmptyState
          title="Nao foi possivel carregar as operacoes"
          description="Confira se a API esta disponivel e se a carteira ativa continua acessivel para este usuario."
        />
      ) : (
        <DataTable columns={operationColumns} data={filteredData} emptyMessage="Nenhuma operacao encontrada para a carteira ativa." />
      )}
    </section>
  );
}
