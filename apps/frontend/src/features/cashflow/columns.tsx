"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { StatusBadge } from "@/components/status-badge";
import type { CashflowEntry } from "@/types/domain";

type CashflowColumnsOptions = {
  canWrite: boolean;
  canDelete: boolean;
  selectedEntryId: string | null;
  pendingCancelId: string | null;
  pendingDeleteId: string | null;
  onSelectEntry: (entry: CashflowEntry) => void;
  onCancelEntry: (entry: CashflowEntry) => void;
  onDeleteEntry: (entry: CashflowEntry) => void;
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

export function getCashflowColumns({
  canWrite,
  canDelete,
  selectedEntryId,
  pendingCancelId,
  pendingDeleteId,
  onSelectEntry,
  onCancelEntry,
  onDeleteEntry,
}: CashflowColumnsOptions): ColumnDef<CashflowEntry>[] {
  const columns: ColumnDef<CashflowEntry>[] = [
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

  if (!canWrite && !canDelete) {
    return columns;
  }

  columns.push({
    id: "actions",
    header: "Acoes",
    cell: ({ row }) => {
      const entry = row.original;
      const isSelected = entry.id === selectedEntryId;
      const isCancelled = entry.status === "cancelled";
      const isCancelling = pendingCancelId === entry.id;
      const isDeleting = pendingDeleteId === entry.id;

      return (
        <div className="flex flex-wrap gap-2">
          {canWrite ? (
            <button
              type="button"
              onClick={() => onSelectEntry(entry)}
              className={isSelected ? getActionButtonClasses("primary") : getActionButtonClasses("muted")}
            >
              {isSelected ? "Editando" : "Editar"}
            </button>
          ) : null}
          {canWrite ? (
            <button
              type="button"
              disabled={isCancelled || isCancelling}
              onClick={() => onCancelEntry(entry)}
              className={getActionButtonClasses("muted")}
            >
              {isCancelling ? "Cancelando" : isCancelled ? "Cancelado" : "Cancelar"}
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => onDeleteEntry(entry)}
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
