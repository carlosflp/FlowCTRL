"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Download, LoaderCircle } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import type { ReportExecution } from "@/types/domain";

type ExecutionColumnsOptions = {
  downloadingExecutionId: string | null;
  onDownload: (execution: ReportExecution) => void;
};

export function getReportExecutionColumns({
  downloadingExecutionId,
  onDownload,
}: ExecutionColumnsOptions): ColumnDef<ReportExecution>[] {
  return [
    {
      accessorKey: "created_at",
      header: "Criado em",
      cell: ({ row }) => row.original.created_at.slice(0, 19).replace("T", " "),
    },
    {
      id: "template",
      header: "Template",
      cell: ({ row }) => row.original.template.name,
    },
    {
      id: "portfolio",
      header: "Carteira",
      cell: ({ row }) => row.original.portfolio?.name ?? "Todas",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge value={row.original.status} />,
    },
    {
      accessorKey: "file_type",
      header: "Arquivo",
      cell: ({ row }) => row.original.file_type?.toUpperCase() ?? "-",
    },
    {
      id: "actions",
      header: "Acoes",
      cell: ({ row }) => {
        const execution = row.original;
        const isDownloading = downloadingExecutionId === execution.id;
        const canDownload = execution.status === "completed" && execution.file_path;

        if (!canDownload) {
          return <span className="text-sm text-muted">Aguardando</span>;
        }

        return (
          <button
            type="button"
            onClick={() => onDownload(execution)}
            disabled={isDownloading}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink transition hover:bg-[#f0efeb] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isDownloading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span>{isDownloading ? "Baixando" : "Download"}</span>
          </button>
        );
      },
    },
  ];
}
