"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { StatusBadge } from "@/components/status-badge";
import type { Operation } from "@/types/domain";

type OperationColumnsOptions = {
  canWrite: boolean;
  canDelete: boolean;
  selectedOperationId: string | null;
  pendingCancelId: string | null;
  pendingDeleteId: string | null;
  onSelectOperation: (operation: Operation) => void;
  onCancelOperation: (operation: Operation) => void;
  onDeleteOperation: (operation: Operation) => void;
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

export function getOperationColumns({
  canWrite,
  canDelete,
  selectedOperationId,
  pendingCancelId,
  pendingDeleteId,
  onSelectOperation,
  onCancelOperation,
  onDeleteOperation,
}: OperationColumnsOptions): ColumnDef<Operation>[] {
  const columns: ColumnDef<Operation>[] = [
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
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-ink">{row.original.asset.ticker}</div>
          <div className="text-xs text-muted">{row.original.asset.name}</div>
        </div>
      ),
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
      header: "Valor liquido",
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
      const operation = row.original;
      const isSelected = operation.id === selectedOperationId;
      const isCancelled = operation.status === "cancelled";
      const isCancelling = pendingCancelId === operation.id;
      const isDeleting = pendingDeleteId === operation.id;

      return (
        <div className="flex flex-wrap gap-2">
          {canWrite ? (
            <button
              type="button"
              onClick={() => onSelectOperation(operation)}
              className={isSelected ? getActionButtonClasses("primary") : getActionButtonClasses("muted")}
            >
              {isSelected ? "Editando" : "Editar"}
            </button>
          ) : null}
          {canWrite ? (
            <button
              type="button"
              disabled={isCancelled || isCancelling}
              onClick={() => onCancelOperation(operation)}
              className={getActionButtonClasses("muted")}
            >
              {isCancelling ? "Cancelando" : isCancelled ? "Cancelada" : "Cancelar"}
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => onDeleteOperation(operation)}
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
