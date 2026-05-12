"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { StatusBadge } from "@/components/status-badge";
import type { Asset } from "@/types/domain";

export const assetColumns: ColumnDef<Asset>[] = [
  {
    accessorKey: "ticker",
    header: "Ticker",
  },
  {
    accessorKey: "name",
    header: "Ativo",
  },
  {
    accessorKey: "asset_type",
    header: "Tipo",
  },
  {
    accessorKey: "issuer",
    header: "Emissor",
    cell: ({ row }) => row.original.issuer ?? "-",
  },
  {
    accessorKey: "indexer",
    header: "Indexador",
    cell: ({ row }) => row.original.indexer ?? "-",
  },
  {
    accessorKey: "is_active",
    header: "Status",
    cell: ({ row }) => <StatusBadge value={row.original.is_active} />,
  },
];

