"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { StatusBadge } from "@/components/status-badge";
import { formatCurrency, formatDecimal, formatPercentage } from "@/lib/formatters";
import type { Position } from "@/types/domain";

export const positionColumns: ColumnDef<Position>[] = [
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
    accessorKey: "quantity",
    header: "Quantidade",
    cell: ({ row }) => formatDecimal(row.original.quantity),
  },
  {
    accessorKey: "average_cost",
    header: "Custo medio",
    cell: ({ row }) => formatCurrency(row.original.average_cost),
  },
  {
    accessorKey: "latest_price",
    header: "Ultimo preco",
    cell: ({ row }) => formatCurrency(row.original.latest_price),
  },
  {
    accessorKey: "market_value",
    header: "Valor de mercado",
    cell: ({ row }) => formatCurrency(row.original.market_value),
  },
  {
    accessorKey: "unrealized_pnl",
    header: "PnL nao realizado",
    cell: ({ row }) => formatCurrency(row.original.unrealized_pnl),
  },
  {
    accessorKey: "unrealized_pnl_pct",
    header: "Rentabilidade",
    cell: ({ row }) => formatPercentage(row.original.unrealized_pnl_pct),
  },
  {
    id: "pricing",
    header: "Preco",
    cell: ({ row }) =>
      row.original.latest_price ? (
        <StatusBadge
          value={row.original.is_price_validated ? "completed" : "pending_approval"}
          label={row.original.is_price_validated ? "validado" : "nao validado"}
        />
      ) : (
        <StatusBadge value="draft" label="sem preco" />
      ),
  },
];
