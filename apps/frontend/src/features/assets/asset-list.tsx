"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SearchToolbar } from "@/components/search-toolbar";
import { fetchAssets } from "@/lib/api/entities";

import { assetColumns } from "./columns";

export function AssetList() {
  const [query, setQuery] = useState("");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["assets"],
    queryFn: fetchAssets,
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
        description="Cadastro inicial de ativos para operações, precificação, vencimentos e controles de posição."
      />

      <SearchToolbar placeholder="Buscar por ticker, nome ou tipo" onSearch={setQuery} />

      {isLoading ? (
        <EmptyState title="Carregando ativos" description="Consultando o catálogo inicial de ativos." />
      ) : isError ? (
        <EmptyState
          title="Não foi possível carregar os ativos"
          description="Valide a conexão do frontend com o backend antes de seguir com o uso das telas."
        />
      ) : (
        <DataTable columns={assetColumns} data={filteredData} emptyMessage="Nenhum ativo encontrado." />
      )}
    </section>
  );
}

