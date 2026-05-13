"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { StatusBadge } from "@/components/status-badge";
import type { AssetPrice } from "@/types/domain";

export const pricingColumns: ColumnDef<AssetPrice>[] = [
  {
    accessorKey: "price_date",
    header: "Data",
  },
  {
    id: "asset",
    header: "Ativo",
    cell: ({ row }) => row.original.asset.ticker,
  },
  {
    accessorKey: "price",
    header: "Preco",
  },
  {
    accessorKey: "source",
    header: "Fonte",
  },
  {
    accessorKey: "is_validated",
    header: "Validado",
    cell: ({ row }) => (
      <StatusBadge
        value={row.original.is_validated}
        label={row.original.is_validated ? "validated" : "pending"}
      />
    ),
  },
];
