"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { StatusBadge } from "@/components/status-badge";
import type { AuditLog } from "@/types/domain";

const entityLabels: Record<string, string> = {
  operation: "Operacao",
  cashflow_entry: "Caixa",
  asset_price: "Preco",
  user: "Usuario",
  report_template: "Template",
  report_execution: "Execucao",
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

type AuditColumnsOptions = {
  selectedAuditLogId: string | null;
  onSelectAuditLog: (auditLog: AuditLog) => void;
};

export function getAuditColumns({
  selectedAuditLogId,
  onSelectAuditLog,
}: AuditColumnsOptions): ColumnDef<AuditLog>[] {
  return [
    {
      accessorKey: "created_at",
      header: "Quando",
      cell: ({ row }) => formatDateTime(row.original.created_at),
    },
    {
      accessorKey: "entity_type",
      header: "Dominio",
      cell: ({ row }) => entityLabels[row.original.entity_type] ?? row.original.entity_type,
    },
    {
      accessorKey: "entity_id",
      header: "Registro",
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-ink">{row.original.entity_id}</div>
          <div className="text-xs text-muted">{row.original.user?.full_name ?? "Sistema"}</div>
        </div>
      ),
    },
    {
      accessorKey: "action",
      header: "Acao",
      cell: ({ row }) => <StatusBadge value={row.original.action} />,
    },
    {
      id: "details",
      header: "Detalhe",
      cell: ({ row }) => {
        const isSelected = row.original.id === selectedAuditLogId;

        return (
          <button
            type="button"
            onClick={() => onSelectAuditLog(row.original)}
            className={
              isSelected
                ? "inline-flex items-center rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white"
                : "inline-flex items-center rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink transition hover:bg-[#f0efeb]"
            }
          >
            {isSelected ? "Selecionado" : "Ver"}
          </button>
        );
      },
    },
  ];
}
