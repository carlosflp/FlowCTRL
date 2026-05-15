"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, LoaderCircle, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { usePortfolioScope } from "@/components/portfolio-scope-provider";
import { StatusBadge } from "@/components/status-badge";
import { useAuth } from "@/features/auth/auth-provider";
import { ApiError } from "@/lib/api/client";
import { fetchImportJobs, uploadImportJob } from "@/lib/api/entities";
import type { ImportDatasetType, ImportJob, ImportSourceType } from "@/types/domain";

const datasetOptions: Array<{ value: ImportDatasetType; label: string; description: string }> = [
  { value: "operations", label: "Operacoes", description: "Compra, venda, ajustes e eventos operacionais." },
  { value: "cashflow", label: "Caixa", description: "Entradas, saidas, transferencias e ajustes de caixa." },
  { value: "pricing", label: "Precos", description: "Preco por ativo, data e fonte." },
];

const sourceOptions: Array<{ value: ImportSourceType; label: string }> = [
  { value: "manual_upload", label: "Planilha manual" },
  { value: "administrator_file", label: "Arquivo do administrador" },
  { value: "custodian_statement", label: "Extrato do custodiante" },
  { value: "brokerage_note", label: "Nota de corretagem" },
  { value: "movement_file", label: "Arquivo de movimentacao" },
  { value: "cash_file", label: "Arquivo de caixa" },
  { value: "market_report", label: "Relatorio B3/Selic/Cetip" },
  { value: "internal_report", label: "Relatorio interno" },
];

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.detail ?? "Nao foi possivel enviar o arquivo de importacao.";
  }
  return "Nao foi possivel enviar o arquivo de importacao.";
}

function getImportColumns(options: {
  selectedJobId: string | null;
  onSelectJob: (job: ImportJob) => void;
}): ColumnDef<ImportJob>[] {
  return [
    {
      accessorKey: "created_at",
      header: "Criado em",
      cell: ({ row }) => row.original.created_at.slice(0, 16).replace("T", " "),
    },
    {
      accessorKey: "dataset",
      header: "Dataset",
    },
    {
      accessorKey: "source",
      header: "Origem",
    },
    {
      accessorKey: "file_name",
      header: "Arquivo",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge value={row.original.status} label={row.original.status} />,
    },
    {
      id: "rows",
      header: "Linhas",
      cell: ({ row }) => (
        <div className="text-sm text-ink">
          <div>{row.original.total_rows} totais</div>
          <div className="text-xs text-muted">
            {row.original.successful_rows} ok | {row.original.failed_rows} erro(s)
          </div>
        </div>
      ),
    },
    {
      id: "actions",
      header: "Acoes",
      cell: ({ row }) => {
        const isSelected = row.original.id === options.selectedJobId;

        return (
          <button
            type="button"
            onClick={() => options.onSelectJob(row.original)}
            className={
              isSelected
                ? "inline-flex items-center rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white"
                : "inline-flex items-center rounded-lg border border-border px-3 py-2 text-xs font-semibold text-ink transition hover:bg-[#f0efeb]"
            }
          >
            {isSelected ? "Selecionado" : "Detalhes"}
          </button>
        );
      },
    },
  ];
}

export function ImportJobsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activePortfolio, activePortfolioId } = usePortfolioScope();
  const [dataset, setDataset] = useState<ImportDatasetType>("operations");
  const [source, setSource] = useState<ImportSourceType>("manual_upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");
  const canWrite = user?.role === "admin" || user?.role === "manager" || user?.role === "analyst";

  const importJobsQuery = useQuery({
    queryKey: ["imports", activePortfolioId],
    queryFn: () => fetchImportJobs({ portfolioId: activePortfolioId }),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!Array.isArray(data)) {
        return false;
      }
      return data.some((job) => job.status === "queued" || job.status === "processing") ? 5000 : false;
    },
  });

  const selectedJob = useMemo(
    () => (importJobsQuery.data ?? []).find((job) => job.id === selectedJobId) ?? null,
    [importJobsQuery.data, selectedJobId],
  );

  useEffect(() => {
    if (!selectedJobId) {
      return;
    }

    if (!selectedJob && (importJobsQuery.data?.length ?? 0) > 0) {
      setSelectedJobId(importJobsQuery.data?.[0]?.id ?? null);
    }
  }, [importJobsQuery.data, selectedJob, selectedJobId]);

  const uploadMutation = useMutation({
    mutationFn: uploadImportJob,
    onSuccess: async (job) => {
      setFeedbackTone("success");
      setFeedbackMessage("Arquivo enviado e lote criado com sucesso.");
      setSelectedFile(null);
      setSelectedJobId(job.id);
      await queryClient.invalidateQueries({ queryKey: ["imports"] });
    },
    onError: (error) => {
      setFeedbackTone("error");
      setFeedbackMessage(getErrorMessage(error));
    },
  });

  const columns = useMemo(
    () =>
      getImportColumns({
        selectedJobId,
        onSelectJob: (job) => setSelectedJobId(job.id),
      }),
    [selectedJobId],
  );

  return (
    <section className="space-y-8">
      <PageHeader
        title="Importacoes"
        description="Base inicial de ingestao para planilhas CSV/XLSX com historico, preview e processamento assincrono por lote."
        actions={
          <button
            type="button"
            onClick={() => void importJobsQuery.refetch()}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink transition hover:bg-[#f0efeb]"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Atualizar</span>
          </button>
        }
      />

      {canWrite ? (
        <div className="rounded-lg border border-border bg-surface p-6 shadow-panel">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-accentSoft p-2 text-accent">
              <FileUp className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-semibold text-ink">Novo lote de importacao</div>
              <div className="text-sm text-muted">
                Primeira fase liberada para `operacoes`, `caixa` e `precos` via arquivo estruturado.
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr_1fr_1.5fr]">
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink" htmlFor="import-dataset">
                Dataset
              </label>
              <select
                id="import-dataset"
                value={dataset}
                onChange={(event) => setDataset(event.target.value as ImportDatasetType)}
                className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
              >
                {datasetOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="text-xs text-muted">
                {datasetOptions.find((option) => option.value === dataset)?.description}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-ink" htmlFor="import-source">
                Origem
              </label>
              <select
                id="import-source"
                value={source}
                onChange={(event) => setSource(event.target.value as ImportSourceType)}
                className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
              >
                {sourceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-ink">Carteira ativa</label>
              <div className="flex h-11 items-center rounded-lg border border-border bg-[#f7f7f4] px-3 text-sm text-ink">
                {activePortfolio?.name ?? "Nenhuma carteira selecionada"}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-ink" htmlFor="import-file">
                Arquivo
              </label>
              <input
                id="import-file"
                type="file"
                accept=".csv,.xlsx"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                className="block h-11 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none transition file:mr-3 file:rounded-md file:border-0 file:bg-accentSoft file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent focus:border-accent"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!selectedFile || !activePortfolioId || uploadMutation.isPending}
              onClick={() => {
                if (!selectedFile || !activePortfolioId) {
                  setFeedbackTone("error");
                  setFeedbackMessage("Selecione uma carteira ativa e um arquivo CSV/XLSX antes de enviar.");
                  return;
                }

                setFeedbackMessage(null);
                uploadMutation.mutate({
                  portfolio_id: activePortfolioId,
                  dataset,
                  source,
                  file: selectedFile,
                });
              }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:bg-[#115e59] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {uploadMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              <span>{uploadMutation.isPending ? "Enviando" : "Enviar lote"}</span>
            </button>
            <div className="text-xs text-muted">
              Colunas esperadas nesta fase: `ticker`, datas, tipos operacionais, valores e fonte de preco.
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-[#f7f7f4] px-4 py-4 text-sm text-muted">
          Seu perfil esta em modo leitura. Importacoes exigem permissao de `analyst`, `manager` ou `admin`.
        </div>
      )}

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

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Historico de lotes</h2>
            <p className="mt-1 text-sm text-muted">
              Cada lote guarda origem, preview, contagem de linhas e o resultado do processamento.
            </p>
          </div>

          {importJobsQuery.isLoading ? (
            <EmptyState title="Carregando lotes" description="Consultando o historico de importacoes da carteira ativa." />
          ) : importJobsQuery.isError ? (
            <EmptyState
              title="Nao foi possivel carregar os lotes"
              description="Valide se o backend de importacoes esta disponivel e se a carteira segue acessivel."
            />
          ) : (
            <DataTable
              columns={columns}
              data={importJobsQuery.data ?? []}
              emptyMessage="Nenhum lote de importacao encontrado para a carteira ativa."
            />
          )}
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Detalhe do lote</h2>
            <p className="mt-1 text-sm text-muted">
              Preview inicial dos dados e primeiros erros registrados no processamento.
            </p>
          </div>

          {selectedJob ? (
            <div className="rounded-lg border border-border bg-surface p-5 shadow-panel">
              <div className="space-y-2">
                <div className="text-base font-semibold text-ink">{selectedJob.file_name}</div>
                <div className="text-sm text-muted">
                  {selectedJob.dataset} | {selectedJob.source} | {selectedJob.portfolio.name}
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <StatusBadge value={selectedJob.status} label={selectedJob.status} />
                  <span className="inline-flex rounded-full bg-[#f5f5f4] px-2.5 py-1 text-xs font-semibold text-muted">
                    {selectedJob.total_rows} linhas
                  </span>
                  <span className="inline-flex rounded-full bg-[#f5f5f4] px-2.5 py-1 text-xs font-semibold text-muted">
                    {selectedJob.successful_rows} ok | {selectedJob.failed_rows} erro(s)
                  </span>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <div className="text-sm font-semibold text-ink">Resumo</div>
                  <div className="mt-1 text-sm text-muted">
                    {selectedJob.result_json?.summary ?? "Aguardando processamento do lote."}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold text-ink">Preview</div>
                  {selectedJob.preview_rows_json && selectedJob.preview_rows_json.length > 0 ? (
                    <div className="mt-2 overflow-x-auto rounded-lg border border-border bg-[#fafaf8]">
                      <table className="min-w-full text-left text-xs">
                        <thead className="border-b border-border bg-white text-muted">
                          <tr>
                            {Object.keys(selectedJob.preview_rows_json[0]).map((column) => (
                              <th key={column} className="px-3 py-2 font-semibold">
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedJob.preview_rows_json.map((row, index) => (
                            <tr key={index} className="border-b border-border last:border-b-0">
                              {Object.entries(row).map(([column, value]) => (
                                <td key={`${index}-${column}`} className="px-3 py-2 text-ink">
                                  {value === null ? "-" : String(value)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="mt-2 rounded-lg border border-border bg-[#fafaf8] px-4 py-3 text-sm text-muted">
                      Nenhum preview disponivel para este lote.
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-sm font-semibold text-ink">Primeiros erros</div>
                  {selectedJob.result_json?.errors && selectedJob.result_json.errors.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {selectedJob.result_json.errors.map((error) => (
                        <div key={`${error.row_number}-${error.message}`} className="rounded-lg border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-sm text-[#b91c1c]">
                          <div className="font-semibold">Linha {error.row_number}</div>
                          <div className="mt-1">{error.message}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 rounded-lg border border-border bg-[#fafaf8] px-4 py-3 text-sm text-muted">
                      Nenhum erro registrado ate agora.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              title="Selecione um lote"
              description="Escolha um item do historico para ver preview e erros de processamento."
            />
          )}
        </div>
      </div>
    </section>
  );
}
