"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  LoaderCircle,
  Play,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { usePortfolioScope } from "@/components/portfolio-scope-provider";
import { StatusBadge } from "@/components/status-badge";
import {
  createReportExecution,
  downloadReportExecution,
  fetchReportExecutions,
  fetchReportTemplates,
} from "@/lib/api/entities";
import { ApiError } from "@/lib/api/client";
import type { ReportTemplate } from "@/types/domain";

import { getReportExecutionColumns } from "./execution-columns";
import {
  getReportDatasetConfig,
  getReportFileTypeLabel,
  listReportDatasetConfigs,
  reportFileTypeOptions,
  type ReportDatasetConfig,
  type ReportDatasetKey,
  type ReportFileType,
} from "./report-dataset-config";

type ReportParametersPayload = {
  dataset?: ReportDatasetKey;
  date_from?: string;
  date_to?: string;
  columns?: string[];
};

function triggerBrowserDownload(blob: Blob, filename: string) {
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(objectUrl);
}

function getDatasetConfigForTemplate(template: Pick<ReportTemplate, "config_json">): ReportDatasetConfig {
  return getReportDatasetConfig(template.config_json?.dataset);
}

function isCustomTemplate(template: Pick<ReportTemplate, "config_json">) {
  return template.config_json?.custom_template === true;
}

function buildReportParameters(
  datasetConfig: ReportDatasetConfig,
  dateFrom: string,
  dateTo: string,
  selectedColumns: string[],
  datasetOverride?: ReportDatasetKey,
): ReportParametersPayload | null {
  const parameters: ReportParametersPayload = {};

  if (datasetOverride) {
    parameters.dataset = datasetOverride;
  }
  if (datasetConfig.supportsDateRange && dateFrom) {
    parameters.date_from = dateFrom;
  }
  if (datasetConfig.supportsDateRange && dateTo) {
    parameters.date_to = dateTo;
  }
  if (selectedColumns.length < datasetConfig.columns.length) {
    parameters.columns = selectedColumns;
  }

  return Object.keys(parameters).length > 0 ? parameters : null;
}

function getReportErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.detail ?? "Nao foi possivel completar a acao solicitada.";
  }
  return "Nao foi possivel completar a acao solicitada.";
}

function formatDateRangeSummary(dateFrom: string, dateTo: string) {
  if (!dateFrom && !dateTo) {
    return "Sem filtro de periodo";
  }
  return `${dateFrom || "..."} ate ${dateTo || "..."}`;
}

function formatColumnSummary(selectedColumns: string[], totalColumns: number) {
  if (selectedColumns.length === totalColumns) {
    return "Todas as colunas";
  }
  return `${selectedColumns.length}/${totalColumns} colunas`;
}

function ReportFormatSelect(props: {
  label: string;
  value: ReportFileType;
  onChange: (value: ReportFileType) => void;
  compact?: boolean;
}) {
  return (
    <div className={props.compact ? "space-y-1" : "space-y-2"}>
      <label className="block text-sm font-medium text-ink">{props.label}</label>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value as ReportFileType)}
        className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
      >
        {reportFileTypeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ReportsPage() {
  const queryClient = useQueryClient();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isScopeOpen, setIsScopeOpen] = useState(false);
  const [expandedTemplateSettings, setExpandedTemplateSettings] = useState<Record<string, boolean>>({});
  const [selectedColumnsByTemplate, setSelectedColumnsByTemplate] = useState<Record<string, string[]>>({});
  const [selectedFileTypeByTemplate, setSelectedFileTypeByTemplate] = useState<Record<string, ReportFileType>>({});
  const [customDataset, setCustomDataset] = useState<ReportDatasetKey>("operations");
  const [customFileType, setCustomFileType] = useState<ReportFileType>("xlsx");
  const [isCustomSettingsOpen, setIsCustomSettingsOpen] = useState(true);
  const [selectedCustomColumnsByDataset, setSelectedCustomColumnsByDataset] = useState<Record<string, string[]>>({});
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"error" | "success">("success");
  const [downloadingExecutionId, setDownloadingExecutionId] = useState<string | null>(null);
  const { activePortfolio, activePortfolioId, refreshPortfolios } = usePortfolioScope();

  const templatesQuery = useQuery({
    queryKey: ["reports", "templates"],
    queryFn: fetchReportTemplates,
  });
  const executionsQuery = useQuery({
    queryKey: ["reports", "executions", activePortfolioId],
    queryFn: () => fetchReportExecutions({ portfolioId: activePortfolioId }),
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

  const loading = templatesQuery.isLoading || executionsQuery.isLoading;
  const hasError = templatesQuery.isError || executionsQuery.isError;

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

  const selectedPortfolioLabel = useMemo(() => {
    return activePortfolio?.name ?? "Carteira selecionada";
  }, [activePortfolio]);

  const scopeSummary = useMemo(
    () => `${selectedPortfolioLabel} | ${formatDateRangeSummary(dateFrom, dateTo)}`,
    [dateFrom, dateTo, selectedPortfolioLabel],
  );

  const customDatasetConfig = useMemo(() => getReportDatasetConfig(customDataset), [customDataset]);
  const datasetOptions = useMemo(() => listReportDatasetConfigs(), []);

  const customTemplate = useMemo(
    () => (templatesQuery.data ?? []).find((template) => isCustomTemplate(template)) ?? null,
    [templatesQuery.data],
  );

  const visibleTemplates = useMemo(
    () => (templatesQuery.data ?? []).filter((template) => !isCustomTemplate(template)),
    [templatesQuery.data],
  );

  function getSelectedColumns(template: ReportTemplate): string[] {
    const datasetConfig = getDatasetConfigForTemplate(template);
    return selectedColumnsByTemplate[template.id] ?? datasetConfig.columns.map((column) => column.key);
  }

  function getSelectedFileType(template: ReportTemplate): ReportFileType {
    return selectedFileTypeByTemplate[template.id] ?? template.template_type;
  }

  function getCustomSelectedColumns(dataset: ReportDatasetKey): string[] {
    const datasetConfig = getReportDatasetConfig(dataset);
    return selectedCustomColumnsByDataset[dataset] ?? datasetConfig.columns.map((column) => column.key);
  }

  function toggleColumn(template: ReportTemplate, columnKey: string) {
    const datasetConfig = getDatasetConfigForTemplate(template);
    const orderedKeys = datasetConfig.columns.map((column) => column.key);

    setSelectedColumnsByTemplate((current) => {
      const currentSelection = current[template.id] ?? orderedKeys;
      const nextSelection = currentSelection.includes(columnKey)
        ? currentSelection.filter((key) => key !== columnKey)
        : orderedKeys.filter((key) => [...currentSelection, columnKey].includes(key));

      return {
        ...current,
        [template.id]: nextSelection,
      };
    });
  }

  function resetColumns(template: ReportTemplate) {
    setSelectedColumnsByTemplate((current) => {
      const next = { ...current };
      delete next[template.id];
      return next;
    });
  }

  function toggleCustomColumn(columnKey: string) {
    const orderedKeys = customDatasetConfig.columns.map((column) => column.key);

    setSelectedCustomColumnsByDataset((current) => {
      const currentSelection = current[customDataset] ?? orderedKeys;
      const nextSelection = currentSelection.includes(columnKey)
        ? currentSelection.filter((key) => key !== columnKey)
        : orderedKeys.filter((key) => [...currentSelection, columnKey].includes(key));

      return {
        ...current,
        [customDataset]: nextSelection,
      };
    });
  }

  function resetCustomColumns(dataset: ReportDatasetKey) {
    setSelectedCustomColumnsByDataset((current) => {
      const next = { ...current };
      delete next[dataset];
      return next;
    });
  }

  function toggleTemplateSettings(templateId: string) {
    setExpandedTemplateSettings((current) => ({
      ...current,
      [templateId]: !(current[templateId] ?? false),
    }));
  }

  function validateExecutionState(selectedColumns: string[]) {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setFeedbackTone("error");
      setFeedbackMessage("A data inicial nao pode ser maior que a data final.");
      return false;
    }
    if (selectedColumns.length === 0) {
      setFeedbackTone("error");
      setFeedbackMessage("Selecione pelo menos uma coluna antes de executar o relatorio.");
      return false;
    }
    return true;
  }

  function enqueueReportExecution(options: {
    templateId: string;
    datasetConfig: ReportDatasetConfig;
    selectedColumns: string[];
    fileType: ReportFileType;
    datasetOverride?: ReportDatasetKey;
  }) {
    if (!validateExecutionState(options.selectedColumns)) {
      return;
    }

    setFeedbackMessage(null);
    runReportMutation.mutate({
      template_id: options.templateId,
      portfolio_id: options.datasetConfig.supportsPortfolioScope ? activePortfolioId ?? null : null,
      file_type: options.fileType,
      parameters_json: buildReportParameters(
        options.datasetConfig,
        dateFrom,
        dateTo,
        options.selectedColumns,
        options.datasetOverride,
      ),
    });
  }

  return (
    <section className="space-y-8">
      <PageHeader
        title="Relatorios"
        description="Templates reutilizaveis, relatorios totalmente personalizados e exportacao assincrona em CSV, XLSX ou PDF."
        actions={
          <button
            type="button"
            onClick={() => {
              void templatesQuery.refetch();
              void executionsQuery.refetch();
              void refreshPortfolios();
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink transition hover:bg-[#f0efeb]"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Atualizar</span>
          </button>
        }
      />

      <div className="rounded-lg border border-border bg-surface shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-ink">Filtros globais</div>
            <p className="mt-1 text-sm text-muted">{scopeSummary}</p>
          </div>
          <button
            type="button"
            onClick={() => setIsScopeOpen((current) => !current)}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink transition hover:bg-[#f0efeb]"
          >
            <span>{isScopeOpen ? "Ocultar filtros" : "Abrir filtros"}</span>
            {isScopeOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {isScopeOpen ? (
          <div className="border-t border-border px-5 py-5">
            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
              <div>
                <div className="text-sm font-semibold text-ink">Escopo da execucao</div>
                <p className="mt-1 text-sm text-muted">
                  Carteira e periodo sao reaproveitados pelos templates e pelo relatorio personalizado sempre que o dataset suportar esses filtros.
                </p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-ink">Carteira ativa</label>
                <div className="flex h-11 items-center rounded-lg border border-border bg-[#f7f7f4] px-3 text-sm text-ink">
                  {selectedPortfolioLabel}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-ink" htmlFor="report-date-from">
                  Data inicial
                </label>
                <input
                  id="report-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none transition focus:border-accent"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-ink" htmlFor="report-date-to">
                  Data final
                </label>
                <input
                  id="report-date-to"
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none transition focus:border-accent"
                />
              </div>
            </div>
          </div>
        ) : null}
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
          {customTemplate ? (
            <div className="rounded-lg border border-border bg-surface p-6 shadow-panel">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-accentSoft p-2 text-accent">
                      <SlidersHorizontal className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-ink">Relatorio personalizado</div>
                      <div className="mt-1 text-sm text-muted">
                        Escolha o dataset, o formato de exportacao e as colunas que quiser para montar sua propria execucao.
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full bg-[#eef3f1] px-2.5 py-1 text-xs font-semibold text-accent">
                      {customDatasetConfig.label}
                    </span>
                    <span className="inline-flex rounded-full bg-[#f5f5f4] px-2.5 py-1 text-xs font-semibold text-muted">
                      {getReportFileTypeLabel(customFileType)}
                    </span>
                    <span className="inline-flex rounded-full bg-[#f5f5f4] px-2.5 py-1 text-xs font-semibold text-muted">
                      {formatColumnSummary(
                        getCustomSelectedColumns(customDataset),
                        customDatasetConfig.columns.length,
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[260px]">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-ink" htmlFor="custom-report-dataset">
                        Dataset
                      </label>
                      <select
                        id="custom-report-dataset"
                        value={customDataset}
                        onChange={(event) => setCustomDataset(event.target.value as ReportDatasetKey)}
                        className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
                      >
                        {datasetOptions.map((datasetOption) => (
                          <option key={datasetOption.dataset} value={datasetOption.dataset}>
                            {datasetOption.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <ReportFormatSelect
                      label="Formato"
                      value={customFileType}
                      onChange={setCustomFileType}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      enqueueReportExecution({
                        templateId: customTemplate.id,
                        datasetConfig: customDatasetConfig,
                        selectedColumns: getCustomSelectedColumns(customDataset),
                        fileType: customFileType,
                        datasetOverride: customDataset,
                      })
                    }
                    disabled={runReportMutation.isPending}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:bg-[#115e59] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {runReportMutation.isPending && runReportMutation.variables?.template_id === customTemplate.id ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    <span>Executar relatorio personalizado</span>
                  </button>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-border bg-[#fafaf8]">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-ink">Configuracao da execucao</div>
                    <div className="mt-1 text-xs text-muted">
                      Dataset: {customDatasetConfig.label} | formato: {getReportFileTypeLabel(customFileType)} | carteira:{" "}
                      {customDatasetConfig.supportsPortfolioScope ? selectedPortfolioLabel : "Nao aplicavel"} | periodo:{" "}
                      {customDatasetConfig.supportsDateRange ? formatDateRangeSummary(dateFrom, dateTo) : "Nao aplicavel"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-muted">
                      {formatColumnSummary(getCustomSelectedColumns(customDataset), customDatasetConfig.columns.length)}
                    </span>
                    {getCustomSelectedColumns(customDataset).length !== customDatasetConfig.columns.length ? (
                      <button
                        type="button"
                        onClick={() => resetCustomColumns(customDataset)}
                        className="inline-flex items-center rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-ink transition hover:bg-[#f0efeb]"
                      >
                        Usar padrao
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setIsCustomSettingsOpen((current) => !current)}
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-ink transition hover:bg-[#f0efeb]"
                    >
                      <span>{isCustomSettingsOpen ? "Ocultar" : "Abrir"}</span>
                      {isCustomSettingsOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {isCustomSettingsOpen ? (
                  <div className="space-y-4 border-t border-border px-4 py-4">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg border border-border bg-white px-3 py-3 text-xs text-muted">
                        Carteira:
                        <span className="ml-2 font-semibold text-ink">
                          {customDatasetConfig.supportsPortfolioScope ? selectedPortfolioLabel : "Nao aplicavel"}
                        </span>
                      </div>
                      <div className="rounded-lg border border-border bg-white px-3 py-3 text-xs text-muted">
                        Periodo:
                        <span className="ml-2 font-semibold text-ink">
                          {customDatasetConfig.supportsDateRange
                            ? formatDateRangeSummary(dateFrom, dateTo)
                            : "Nao aplicavel"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="text-sm font-medium text-ink">Colunas exportadas</div>
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {customDatasetConfig.columns.map((column) => {
                          const checked = getCustomSelectedColumns(customDataset).includes(column.key);

                          return (
                            <label
                              key={column.key}
                              className="flex items-center gap-3 rounded-lg border border-border bg-white px-3 py-3 text-sm text-ink"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleCustomColumn(column.key)}
                                className="h-4 w-4 rounded border-border"
                              />
                              <span>{column.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <EmptyState
              title="Relatorio personalizado indisponivel"
              description="Atualize o backend para carregar o template padrao do modo personalizado."
            />
          )}

          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Templates reutilizaveis</h2>
              <p className="mt-1 text-sm text-muted">
                Cada template representa uma base reaproveitavel. O formato do arquivo agora eh escolhido na execucao.
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {visibleTemplates.map((template) => {
                const datasetConfig = getDatasetConfigForTemplate(template);
                const selectedColumns = getSelectedColumns(template);
                const selectedFileType = getSelectedFileType(template);
                const isTemplateSettingsOpen = expandedTemplateSettings[template.id] ?? false;
                const isRunning =
                  runReportMutation.isPending && runReportMutation.variables?.template_id === template.id;
                const portfolioSummary = datasetConfig.supportsPortfolioScope
                  ? selectedPortfolioLabel
                  : "Nao aplicavel";
                const dateRangeSummary = datasetConfig.supportsDateRange
                  ? formatDateRangeSummary(dateFrom, dateTo)
                  : "Nao aplicavel";

                return (
                  <div key={template.id} className="rounded-lg border border-border bg-surface p-5 shadow-panel">
                    <div className="flex flex-wrap items-start justify-between gap-4">
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
                          <span className="inline-flex rounded-full bg-[#f5f5f4] px-2.5 py-1 text-xs font-semibold text-muted">
                            {datasetConfig.label}
                          </span>
                          <span className="inline-flex rounded-full bg-[#eef3f1] px-2.5 py-1 text-xs font-semibold text-accent">
                            {getReportFileTypeLabel(selectedFileType)}
                          </span>
                        </div>
                      </div>

                      <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[240px]">
                        <ReportFormatSelect
                          label="Formato de exportacao"
                          value={selectedFileType}
                          onChange={(value) =>
                            setSelectedFileTypeByTemplate((current) => ({
                              ...current,
                              [template.id]: value,
                            }))
                          }
                          compact
                        />

                        <button
                          type="button"
                          onClick={() =>
                            enqueueReportExecution({
                              templateId: template.id,
                              datasetConfig,
                              selectedColumns,
                              fileType: selectedFileType,
                            })
                          }
                          disabled={!template.is_active || runReportMutation.isPending}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:bg-[#115e59] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isRunning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                          <span>{isRunning ? "Enfileirando" : "Executar"}</span>
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 rounded-lg border border-border bg-[#fafaf8]">
                      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div>
                          <div className="text-sm font-semibold text-ink">Filtros e colunas</div>
                          <div className="mt-1 text-xs text-muted">
                            {formatColumnSummary(selectedColumns, datasetConfig.columns.length)} | carteira: {portfolioSummary} | periodo:{" "}
                            {dateRangeSummary}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedColumns.length !== datasetConfig.columns.length ? (
                            <button
                              type="button"
                              onClick={() => resetColumns(template)}
                              className="inline-flex items-center rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-ink transition hover:bg-[#f0efeb]"
                            >
                              Usar padrao
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => toggleTemplateSettings(template.id)}
                            className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-ink transition hover:bg-[#f0efeb]"
                          >
                            <span>{isTemplateSettingsOpen ? "Ocultar" : "Abrir"}</span>
                            {isTemplateSettingsOpen ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {isTemplateSettingsOpen ? (
                        <div className="space-y-4 border-t border-border px-4 py-4">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="rounded-lg border border-border bg-white px-3 py-3 text-xs text-muted">
                              Carteira:
                              <span className="ml-2 font-semibold text-ink">{portfolioSummary}</span>
                            </div>
                            <div className="rounded-lg border border-border bg-white px-3 py-3 text-xs text-muted">
                              Periodo:
                              <span className="ml-2 font-semibold text-ink">{dateRangeSummary}</span>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="text-sm font-medium text-ink">Colunas exportadas</div>
                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                              {datasetConfig.columns.map((column) => {
                                const checked = selectedColumns.includes(column.key);

                                return (
                                  <label
                                    key={column.key}
                                    className="flex items-center gap-3 rounded-lg border border-border bg-white px-3 py-3 text-sm text-ink"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleColumn(template, column.key)}
                                      className="h-4 w-4 rounded border-border"
                                    />
                                    <span>{column.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {visibleTemplates.length === 0 ? (
              <EmptyState
                title="Nenhum template disponivel"
                description="Crie templates pela API ou execute o bootstrap do backend para popular os modelos iniciais."
              />
            ) : null}
          </div>

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
