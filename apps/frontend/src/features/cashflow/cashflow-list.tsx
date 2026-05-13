"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SearchToolbar } from "@/components/search-toolbar";
import { fetchCashflowEntries } from "@/lib/api/entities";

import { cashflowColumns } from "./columns";

export function CashflowList() {
  const [query, setQuery] = useState("");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["cashflow"],
    queryFn: fetchCashflowEntries,
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
      (entry) =>
        entry.portfolio.name.toLowerCase().includes(normalized) ||
        entry.description.toLowerCase().includes(normalized) ||
        entry.entry_type.toLowerCase().includes(normalized) ||
        entry.status.toLowerCase().includes(normalized),
    );
  }, [data, query]);

  return (
    <section>
      <PageHeader
        title="Caixa"
        description="Movimentos de caixa por carteira para acompanhar entradas, saidas, ajustes e conciliacao operacional."
      />

      <SearchToolbar placeholder="Buscar por carteira, descricao, tipo ou status" onSearch={setQuery} />

      {isLoading ? (
        <EmptyState title="Carregando caixa" description="Consultando os eventos de caixa disponiveis." />
      ) : isError ? (
        <EmptyState
          title="Nao foi possivel carregar o caixa"
          description="Confira se a API esta disponivel e se as migrations ja foram aplicadas."
        />
      ) : (
        <DataTable columns={cashflowColumns} data={filteredData} emptyMessage="Nenhum evento de caixa encontrado." />
      )}
    </section>
  );
}
