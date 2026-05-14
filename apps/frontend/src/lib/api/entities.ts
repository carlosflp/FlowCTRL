import {
  actionResponseSchema,
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
  userListSchema,
  userSchema,
} from "@/lib/api/schemas";
import { apiDownload, apiGet, apiPost, apiPut, type DownloadResult } from "@/lib/api/client";
import type {
  ActionResponse,
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
  User,
  UserList,
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

export function fetchUsers(): Promise<UserList> {
  return apiGet("/users", userListSchema);
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

export function createUser(payload: {
  email: string;
  full_name: string;
  password: string;
  role: "admin" | "manager" | "analyst" | "viewer";
  is_active: boolean;
  is_superuser?: boolean;
}): Promise<User> {
  return apiPost("/users", payload, userSchema);
}

export function updateUser(
  userId: string,
  payload: {
    email?: string;
    full_name?: string;
    password?: string;
    role?: "admin" | "manager" | "analyst" | "viewer";
    is_active?: boolean;
    is_superuser?: boolean;
  },
): Promise<User> {
  return apiPut(`/users/${userId}`, payload, userSchema);
}

export function updateOwnProfile(payload: {
  email: string;
  full_name: string;
}): Promise<User> {
  return apiPut("/auth/me", payload, userSchema);
}

export function changeOwnPassword(payload: {
  current_password: string;
  new_password: string;
}): Promise<ActionResponse> {
  return apiPost("/auth/change-password", payload, actionResponseSchema);
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
  file_type: "csv" | "xlsx" | "pdf";
  parameters_json: {
    dataset?: "operations" | "cashflow" | "pricing" | "portfolios" | null;
    date_from?: string | null;
    date_to?: string | null;
    columns?: string[] | null;
  } | null;
}): Promise<ReportExecution> {
  return apiPost("/reports/executions", payload, reportExecutionSchema);
}

export function downloadReportExecution(executionId: string): Promise<DownloadResult> {
  return apiDownload(`/reports/executions/${executionId}/download`);
}
