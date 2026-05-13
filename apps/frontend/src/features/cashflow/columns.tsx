"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { StatusBadge } from "@/components/status-badge";
import type { CashflowEntry } from "@/types/domain";

export const cashflowColumns: ColumnDef<CashflowEntry>[] = [
  {
    accessorKey: "settlement_date",
    header: "Liquidacao",
  },
  {
    id: "portfolio",
    header: "Carteira",
    cell: ({ row }) => row.original.portfolio.name,
  },
  {
    accessorKey: "description",
    header: "Descricao",
  },
  {
    accessorKey: "entry_type",
    header: "Tipo",
  },
  {
    accessorKey: "amount",
    header: "Valor",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge value={row.original.status} />,
  },
];
