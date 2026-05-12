"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { StatusBadge } from "@/components/status-badge";
import type { Operation } from "@/types/domain";

export const operationColumns: ColumnDef<Operation>[] = [
  {
    accessorKey: "trade_date",
    header: "Data trade",
  },
  {
    id: "portfolio",
    header: "Carteira",
    cell: ({ row }) => row.original.portfolio.name,
  },
  {
    id: "asset",
    header: "Ativo",
    cell: ({ row }) => row.original.asset.ticker,
  },
  {
    accessorKey: "operation_type",
    header: "Tipo",
  },
  {
    accessorKey: "gross_value",
    header: "Valor bruto",
  },
  {
    accessorKey: "net_value",
    header: "Valor líquido",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge value={row.original.status} />,
  },
];

