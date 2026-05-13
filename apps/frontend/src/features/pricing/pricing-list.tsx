"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SearchToolbar } from "@/components/search-toolbar";
import { fetchAssetPrices } from "@/lib/api/entities";

import { pricingColumns } from "./columns";

export function PricingList() {
  const [query, setQuery] = useState("");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["pricing"],
    queryFn: fetchAssetPrices,
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
        description="Historico de precos por ativo e fonte, com preparacao para validacao e uso em calculos de posicao."
      />

      <SearchToolbar placeholder="Buscar por ativo ou fonte" onSearch={setQuery} />

      {isLoading ? (
        <EmptyState title="Carregando precos" description="Consultando a base de precificacao." />
      ) : isError ? (
        <EmptyState
          title="Nao foi possivel carregar os precos"
          description="Valide a autenticacao e o estado do backend antes de continuar."
        />
      ) : (
        <DataTable columns={pricingColumns} data={filteredData} emptyMessage="Nenhum preco encontrado." />
      )}
    </section>
  );
}
