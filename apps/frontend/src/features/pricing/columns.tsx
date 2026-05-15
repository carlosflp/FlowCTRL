"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { StatusBadge } from "@/components/status-badge";
import type { AssetPrice } from "@/types/domain";

type PricingColumnsOptions = {
  canWrite: boolean;
  canDelete: boolean;
  selectedPriceId: string | null;
  pendingDeleteId: string | null;
  onSelectPrice: (price: AssetPrice) => void;
  onDeletePrice: (price: AssetPrice) => void;
};

function getActionButtonClasses(kind: "primary" | "muted" | "danger"): string {
  if (kind === "primary") {
    return "inline-flex items-center rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#115e59]";
  }
  if (kind === "danger") {
    return "inline-flex items-center rounded-lg border border-[#fecaca] px-3 py-2 text-xs font-semibold text-[#b91c1c] transition hover:bg-[#fff1f2]";
  }
  return "inline-flex items-center rounded-lg border border-border px-3 py-2 text-xs font-semibold text-ink transition hover:bg-[#f0efeb]";
}

export function getPricingColumns({
  canWrite,
  canDelete,
  selectedPriceId,
  pendingDeleteId,
  onSelectPrice,
  onDeletePrice,
}: PricingColumnsOptions): ColumnDef<AssetPrice>[] {
  const columns: ColumnDef<AssetPrice>[] = [
    {
      accessorKey: "price_date",
      header: "Data",
    },
    {
      id: "asset",
      header: "Ativo",
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-ink">{row.original.asset.ticker}</div>
          <div className="text-xs text-muted">{row.original.asset.name}</div>
        </div>
      ),
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

  if (!canWrite && !canDelete) {
    return columns;
  }

  columns.push({
    id: "actions",
    header: "Acoes",
    cell: ({ row }) => {
      const price = row.original;
      const isSelected = price.id === selectedPriceId;
      const isDeleting = pendingDeleteId === price.id;

      return (
        <div className="flex flex-wrap gap-2">
          {canWrite ? (
            <button
              type="button"
              onClick={() => onSelectPrice(price)}
              className={isSelected ? getActionButtonClasses("primary") : getActionButtonClasses("muted")}
            >
              {isSelected ? "Editando" : "Editar"}
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => onDeletePrice(price)}
              className={getActionButtonClasses("danger")}
            >
              {isDeleting ? "Excluindo" : "Excluir"}
            </button>
          ) : null}
        </div>
      );
    },
  });

  return columns;
}
