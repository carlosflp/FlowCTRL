"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, LoaderCircle, Play, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import {
  createReportExecution,
  downloadReportExecution,
  fetchPortfolios,
  fetchReportExecutions,
  fetchReportTemplates,
} from "@/lib/api/entities";
import { ApiError } from "@/lib/api/client";

import { getReportExecutionColumns } from "./execution-columns";

function triggerBrowserDownload(blob: Blob, filename: string) {
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(objectUrl);
}

function getDatasetLabel(template: { config_json: Record<string, unknown> | null }) {
  const dataset = template.config_json?.dataset;
  if (dataset === "cashflow") {
    return "Caixa";
  }
  if (dataset === "pricing") {
    return "Precos";
  }
  if (dataset === "portfolios") {
    return "Carteiras";
  }
  return "Operacoes";
}

function getReportErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.detail ?? "Nao foi possivel completar a acao solicitada.";
  }
  return "Nao foi possivel completar a acao solicitada.";
}

export function ReportsPage() {
  const queryClient = useQueryClient();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"error" | "success">("success");
  const [downloadingExecutionId, setDownloadingExecutionId] = useState<string | null>(null);

  const templatesQuery = useQuery({
    queryKey: ["reports", "templates"],
    queryFn: fetchReportTemplates,
  });
  const executionsQuery = useQuery({
    queryKey: ["reports", "executions"],
    queryFn: fetchReportExecutions,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!Array.isArray(data)) {
        return false;
      }
      return data.some((execution) => execution.status === "queued" || execution.status === "running")
        ? 5000
        : false;
    },
  });
  const portfoliosQuery = useQuery({
    queryKey: ["reports", "portfolios"],
    queryFn: fetchPortfolios,
  });

  const runReportMutation = useMutation({
    mutationFn: createReportExecution,
    onSuccess: () => {
      setFeedbackTone("success");
      setFeedbackMessage("Execucao enfileirada com sucesso.");
      void queryClient.invalidateQueries({ queryKey: ["reports", "executions"] });
    },
    onError: (error) => {
      setFeedbackTone("error");
      setFeedbackMessage(getReportErrorMessage(error));
    },
  });

  const loading =
    templatesQuery.isLoading || executionsQuery.isLoading || portfoliosQuery.isLoading;
  const hasError =
    templatesQuery.isError || executionsQuery.isError || portfoliosQuery.isError;

  const executionColumns = useMemo(
    () =>
      getReportExecutionColumns({
        downloadingExecutionId,
        onDownload: async (execution) => {
          try {
            setDownloadingExecutionId(execution.id);
            const result = await downloadReportExecution(execution.id);
            triggerBrowserDownload(result.blob, result.filename ?? `report-${execution.id}`);
          } catch (error) {
            setFeedbackTone("error");
            setFeedbackMessage(getReportErrorMessage(error));
          } finally {
            setDownloadingExecutionId(null);
          }
        },
      }),
    [downloadingExecutionId],
  );

  return (
    <section className="space-y-8">
      <PageHeader
        title="Relatorios"
        description="Execucoes assincronas com Celery, armazenamento no MinIO e download autenticado dos artefatos gerados."
        actions={
          <button
            type="button"
            onClick={() => {
              void templatesQuery.refetch();
              void executionsQuery.refetch();
              void portfoliosQuery.refetch();
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink transition hover:bg-[#f0efeb]"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Atualizar</span>
          </button>
        }
      />

      <div className="rounded-lg border border-border bg-surface p-5 shadow-panel">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm font-semibold text-ink">Escopo da execucao</div>
            <p className="mt-1 text-sm text-muted">
              Selecione uma carteira para limitar a geracao quando o dataset suportar filtro por carteira.
            </p>
          </div>
          <div className="w-full md:max-w-sm">
            <label className="mb-2 block text-sm font-medium text-ink" htmlFor="report-portfolio-filter">
              Carteira
            </label>
            <select
              id="report-portfolio-filter"
              value={selectedPortfolioId}
              onChange={(event) => setSelectedPortfolioId(event.target.value)}
              className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none transition focus:border-accent"
            >
              <option value="">Todas as carteiras</option>
              {(portfoliosQuery.data ?? []).map((portfolio) => (
                <option key={portfolio.id} value={portfolio.id}>
                  {portfolio.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {feedbackMessage ? (
        <div
          className={
            feedbackTone === "error"
              ? "rounded-lg border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-sm text-[#b91c1c]"
              : "rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm text-[#166534]"
          }
        >
          {feedbackMessage}
        </div>
      ) : null}

      {loading ? (
        <EmptyState
          title="Carregando relatorios"
          description="Consultando templates e execucoes disponiveis."
        />
      ) : hasError ? (
        <EmptyState
          title="Nao foi possivel carregar os relatorios"
          description="Confira o backend, o worker e o bucket do MinIO antes de usar esta area."
        />
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            {(templatesQuery.data ?? []).map((template) => {
              const isRunning = runReportMutation.isPending && runReportMutation.variables?.template_id === template.id;

              return (
                <div key={template.id} className="rounded-lg border border-border bg-surface p-5 shadow-panel">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-accentSoft p-2 text-accent">
                          <FileSpreadsheet className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-base font-semibold text-ink">{template.name}</div>
                          <div className="mt-1 text-sm text-muted">{template.description}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        <StatusBadge value={template.is_active} label={template.is_active ? "active" : "inactive"} />
                        <span className="inline-flex rounded-full bg-[#eef3f1] px-2.5 py-1 text-xs font-semibold text-accent">
                          {template.template_type.toUpperCase()}
                        </span>
                        <span className="inline-flex rounded-full bg-[#f5f5f4] px-2.5 py-1 text-xs font-semibold text-muted">
                          {getDatasetLabel(template)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        runReportMutation.mutate({
                          template_id: template.id,
                          portfolio_id: selectedPortfolioId || null,
                          parameters_json: null,
                        })
                      }
                      disabled={!template.is_active || runReportMutation.isPending}
                      className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:bg-[#115e59] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isRunning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      <span>{isRunning ? "Enfileirando" : "Executar"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {(templatesQuery.data ?? []).length === 0 ? (
            <EmptyState
              title="Nenhum template disponivel"
              description="Crie templates pela API ou execute o bootstrap do backend para popular os modelos iniciais."
            />
          ) : null}

          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Execucoes recentes</h2>
              <p className="mt-1 text-sm text-muted">
                O worker atualiza automaticamente os status enquanto as execucoes estiverem em fila ou em processamento.
              </p>
            </div>

            <DataTable
              columns={executionColumns}
              data={executionsQuery.data ?? []}
              emptyMessage="Nenhuma execucao de relatorio encontrada."
            />
          </div>
        </>
      )}
    </section>
  );
}
