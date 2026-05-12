"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { StatusBadge } from "@/components/status-badge";
import type { Portfolio } from "@/types/domain";

export const portfolioColumns: ColumnDef<Portfolio>[] = [
  {
    accessorKey: "name",
    header: "Carteira",
  },
  {
    accessorKey: "base_currency",
    header: "Moeda base",
  },
  {
    accessorKey: "benchmark",
    header: "Benchmark",
    cell: ({ row }) => row.original.benchmark ?? "-",
  },
  {
    accessorKey: "description",
    header: "Descrição",
    cell: ({ row }) => row.original.description ?? "-",
  },
  {
    accessorKey: "is_active",
    header: "Status",
    cell: ({ row }) => <StatusBadge value={row.original.is_active} />,
  },
];

