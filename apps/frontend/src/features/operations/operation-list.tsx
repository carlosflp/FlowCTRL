"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SearchToolbar } from "@/components/search-toolbar";
import { fetchOperations } from "@/lib/api/entities";

import { operationColumns } from "./columns";

export function OperationList() {
  const [query, setQuery] = useState("");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["operations"],
    queryFn: fetchOperations,
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
        title="Operações"
        description="Registro operacional das transações com dados suficientes para auditoria, caixa, posição e relatórios futuros."
      />

      <SearchToolbar placeholder="Buscar por carteira, ativo, tipo ou status" onSearch={setQuery} />

      {isLoading ? (
        <EmptyState title="Carregando operações" description="Buscando o histórico operacional disponível." />
      ) : isError ? (
        <EmptyState
          title="Não foi possível carregar as operações"
          description="Confira se a API está disponível e se o banco já foi migrado antes de usar esta tela."
        />
      ) : (
        <DataTable columns={operationColumns} data={filteredData} emptyMessage="Nenhuma operação encontrada." />
      )}
    </section>
  );
}

