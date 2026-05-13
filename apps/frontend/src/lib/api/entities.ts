import {
  assetListSchema,
  assetPriceListSchema,
  cashflowEntryListSchema,
  operationListSchema,
  positionListSchema,
  positionOverviewSchema,
  portfolioListSchema,
  reportExecutionListSchema,
  reportExecutionSchema,
  reportTemplateListSchema,
} from "@/lib/api/schemas";
import { apiDownload, apiGet, apiPost, type DownloadResult } from "@/lib/api/client";
import type {
  AssetList,
  AssetPriceList,
  CashflowEntryList,
  OperationList,
  PositionList,
  PositionOverview,
  PortfolioList,
  ReportExecution,
  ReportExecutionList,
  ReportTemplateList,
} from "@/types/domain";

type PositionFilters = {
  portfolioId?: string | null;
  asOfDate?: string | null;
};

function buildPositionQueryString(filters: PositionFilters): string {
  const params = new URLSearchParams();

  if (filters.portfolioId) {
    params.set("portfolio_id", filters.portfolioId);
  }
  if (filters.asOfDate) {
    params.set("as_of_date", filters.asOfDate);
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export function fetchPortfolios(): Promise<PortfolioList> {
  return apiGet("/portfolios", portfolioListSchema);
}

export function fetchAssets(): Promise<AssetList> {
  return apiGet("/assets", assetListSchema);
}

export function fetchOperations(): Promise<OperationList> {
  return apiGet("/operations", operationListSchema);
}

export function fetchCashflowEntries(): Promise<CashflowEntryList> {
  return apiGet("/cashflow", cashflowEntryListSchema);
}

export function fetchAssetPrices(): Promise<AssetPriceList> {
  return apiGet("/pricing", assetPriceListSchema);
}

export function fetchPositions(filters: PositionFilters = {}): Promise<PositionList> {
  return apiGet(`/positions${buildPositionQueryString(filters)}`, positionListSchema);
}

export function fetchPositionOverview(filters: PositionFilters = {}): Promise<PositionOverview> {
  return apiGet(`/positions/overview${buildPositionQueryString(filters)}`, positionOverviewSchema);
}

export function fetchReportTemplates(): Promise<ReportTemplateList> {
  return apiGet("/reports/templates", reportTemplateListSchema);
}

export function fetchReportExecutions(): Promise<ReportExecutionList> {
  return apiGet("/reports/executions", reportExecutionListSchema);
}

export function createReportExecution(payload: {
  template_id: string;
  portfolio_id: string | null;
  parameters_json: Record<string, unknown> | null;
}): Promise<ReportExecution> {
  return apiPost("/reports/executions", payload, reportExecutionSchema);
}

export function downloadReportExecution(executionId: string): Promise<DownloadResult> {
  return apiDownload(`/reports/executions/${executionId}/download`);
}
