export type ReportDatasetKey = "operations" | "cashflow" | "pricing" | "portfolios";
export type ReportFileType = "csv" | "xlsx" | "pdf";

export type ReportDatasetColumn = {
  key: string;
  label: string;
};

export type ReportDatasetConfig = {
  dataset: ReportDatasetKey;
  label: string;
  supportsDateRange: boolean;
  supportsPortfolioScope: boolean;
  columns: ReportDatasetColumn[];
};

export const reportFileTypeOptions: Array<{ value: ReportFileType; label: string }> = [
  { value: "csv", label: "CSV" },
  { value: "xlsx", label: "XLSX" },
  { value: "pdf", label: "PDF" },
];

export const reportDatasetConfig: Record<ReportDatasetKey, ReportDatasetConfig> = {
  operations: {
    dataset: "operations",
    label: "Operacoes",
    supportsDateRange: true,
    supportsPortfolioScope: true,
    columns: [
      { key: "trade_date", label: "Data da operacao" },
      { key: "settlement_date", label: "Data de liquidacao" },
      { key: "portfolio", label: "Carteira" },
      { key: "asset", label: "Ativo" },
      { key: "operation_type", label: "Tipo" },
      { key: "quantity", label: "Quantidade" },
      { key: "unit_price", label: "Preco unitario" },
      { key: "gross_value", label: "Valor bruto" },
      { key: "net_value", label: "Valor liquido" },
      { key: "fees", label: "Taxas" },
      { key: "taxes", label: "Impostos" },
      { key: "status", label: "Status" },
      { key: "notes", label: "Observacoes" },
    ],
  },
  cashflow: {
    dataset: "cashflow",
    label: "Caixa",
    supportsDateRange: true,
    supportsPortfolioScope: true,
    columns: [
      { key: "entry_date", label: "Data do evento" },
      { key: "settlement_date", label: "Data de liquidacao" },
      { key: "portfolio", label: "Carteira" },
      { key: "description", label: "Descricao" },
      { key: "entry_type", label: "Tipo" },
      { key: "amount", label: "Valor" },
      { key: "status", label: "Status" },
      { key: "operation_id", label: "Operacao relacionada" },
    ],
  },
  pricing: {
    dataset: "pricing",
    label: "Precos",
    supportsDateRange: true,
    supportsPortfolioScope: false,
    columns: [
      { key: "price_date", label: "Data do preco" },
      { key: "asset", label: "Ativo" },
      { key: "price", label: "Preco" },
      { key: "source", label: "Fonte" },
      { key: "is_validated", label: "Validado" },
    ],
  },
  portfolios: {
    dataset: "portfolios",
    label: "Carteiras",
    supportsDateRange: false,
    supportsPortfolioScope: false,
    columns: [
      { key: "name", label: "Nome" },
      { key: "base_currency", label: "Moeda base" },
      { key: "benchmark", label: "Benchmark" },
      { key: "is_active", label: "Ativa" },
      { key: "description", label: "Descricao" },
    ],
  },
};

export function getReportDatasetConfig(dataset: unknown): ReportDatasetConfig {
  if (dataset === "cashflow") {
    return reportDatasetConfig.cashflow;
  }
  if (dataset === "pricing") {
    return reportDatasetConfig.pricing;
  }
  if (dataset === "portfolios") {
    return reportDatasetConfig.portfolios;
  }
  return reportDatasetConfig.operations;
}

export function getReportFileTypeLabel(fileType: ReportFileType) {
  return reportFileTypeOptions.find((option) => option.value === fileType)?.label ?? fileType.toUpperCase();
}

export function listReportDatasetConfigs(): ReportDatasetConfig[] {
  return Object.values(reportDatasetConfig);
}
