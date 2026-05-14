"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SearchToolbar } from "@/components/search-toolbar";
import { fetchPortfolios } from "@/lib/api/entities";

import { portfolioColumns } from "./columns";

export function PortfolioList() {
  const [query, setQuery] = useState("");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["portfolios"],
    queryFn: fetchPortfolios,
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
      (portfolio) =>
        portfolio.name.toLowerCase().includes(normalized) ||
        portfolio.base_currency.toLowerCase().includes(normalized) ||
        (portfolio.benchmark ?? "").toLowerCase().includes(normalized),
    );
  }, [data, query]);

  return (
    <section>
      <PageHeader
        title="Carteiras"
        description="Lista inicial das carteiras sob gestão, com foco em referência operacional e governança de base."
      />

      <SearchToolbar placeholder="Buscar por nome, benchmark ou moeda" onSearch={setQuery} />

      {isLoading ? (
        <EmptyState title="Carregando carteiras" description="Consultando os registros disponíveis no backend." />
      ) : isError ? (
        <EmptyState
          title="Não foi possível carregar as carteiras"
          description="Verifique se o backend está rodando e se o proxy /api/v1 do frontend consegue alcançar a API."
        />
      ) : (
        <DataTable columns={portfolioColumns} data={filteredData} emptyMessage="Nenhuma carteira encontrada." />
      )}
    </section>
  );
}
