"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Download, LoaderCircle } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import type { ReportExecution } from "@/types/domain";

import { getReportDatasetConfig } from "./report-dataset-config";

type ExecutionColumnsOptions = {
  downloadingExecutionId: string | null;
  onDownload: (execution: ReportExecution) => void;
};

export function getReportExecutionColumns({
  downloadingExecutionId,
  onDownload,
}: ExecutionColumnsOptions): ColumnDef<ReportExecution>[] {
  function buildExecutionTemplateLabel(execution: ReportExecution) {
    const dataset = execution.parameters_json?.dataset;
    if (!dataset) {
      return execution.template.name;
    }
    return `${execution.template.name} (${getReportDatasetConfig(dataset).label})`;
  }

  function buildExecutionScopeLabel(execution: ReportExecution) {
    const parameters = execution.parameters_json;
    const scopeParts: string[] = [];

    if (parameters?.date_from || parameters?.date_to) {
      const from = parameters.date_from ?? "...";
      const to = parameters.date_to ?? "...";
      scopeParts.push(`${from} ate ${to}`);
    }
    if (parameters?.columns?.length) {
      scopeParts.push(`${parameters.columns.length} colunas`);
    }

    return scopeParts.length > 0 ? scopeParts.join(" | ") : "Padrao";
  }

  return [
    {
      accessorKey: "created_at",
      header: "Criado em",
      cell: ({ row }) => row.original.created_at.slice(0, 19).replace("T", " "),
    },
    {
      id: "template",
      header: "Template",
      cell: ({ row }) => buildExecutionTemplateLabel(row.original),
    },
    {
      id: "portfolio",
      header: "Carteira",
      cell: ({ row }) => row.original.portfolio?.name ?? "Todas",
    },
    {
      id: "filters",
      header: "Escopo",
      cell: ({ row }) => buildExecutionScopeLabel(row.original),
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
