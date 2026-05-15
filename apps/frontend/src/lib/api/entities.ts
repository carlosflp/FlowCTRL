import {
  actionResponseSchema,
  auditLogListSchema,
  assetListSchema,
  assetPriceSchema,
  assetPriceListSchema,
  cashflowEntrySchema,
  cashflowEntryListSchema,
  operationSchema,
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
  AuditLogList,
  AssetList,
  AssetPrice,
  AssetPriceList,
  CashflowEntry,
  CashflowEntryList,
  Operation,
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

type AuditLogFilters = {
  entityType?: string | null;
  action?: "created" | "updated" | "deleted" | null;
  userId?: string | null;
  search?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  limit?: number;
};

type PositionFilters = {
  portfolioId?: string | null;
  asOfDate?: string | null;
};

type PortfolioScopedFilters = {
  portfolioId?: string | null;
};

function buildAuditQueryString(filters: AuditLogFilters): string {
  const params = new URLSearchParams();

  if (filters.entityType) {
    params.set("entity_type", filters.entityType);
  }
  if (filters.action) {
    params.set("action", filters.action);
  }
  if (filters.userId) {
    params.set("user_id", filters.userId);
  }
  if (filters.search) {
    params.set("search", filters.search);
  }
  if (filters.dateFrom) {
    params.set("date_from", filters.dateFrom);
  }
  if (filters.dateTo) {
    params.set("date_to", filters.dateTo);
  }
  if (filters.limit) {
    params.set("limit", String(filters.limit));
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

function buildPortfolioScopedQueryString(filters: PortfolioScopedFilters): string {
  const params = new URLSearchParams();

  if (filters.portfolioId) {
    params.set("portfolio_id", filters.portfolioId);
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

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

export function fetchAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogList> {
  return apiGet(`/audit${buildAuditQueryString(filters)}`, auditLogListSchema);
}

export function fetchAssets(filters: PortfolioScopedFilters = {}): Promise<AssetList> {
  return apiGet(`/assets${buildPortfolioScopedQueryString(filters)}`, assetListSchema);
}

export function fetchAssetReferenceCatalog(): Promise<AssetList> {
  return apiGet("/assets/reference", assetListSchema);
}

export function fetchOperations(filters: PortfolioScopedFilters = {}): Promise<OperationList> {
  return apiGet(`/operations${buildPortfolioScopedQueryString(filters)}`, operationListSchema);
}

export function createOperation(payload: {
  portfolio_id: string;
  asset_id: string;
  operation_type:
    | "buy"
    | "sell"
    | "contribution"
    | "redemption"
    | "dividend"
    | "interest"
    | "coupon"
    | "amortization"
    | "fee"
    | "tax"
    | "adjustment"
    | "transfer";
  trade_date: string;
  settlement_date: string;
  quantity: string;
  unit_price: string;
  fees?: string;
  taxes?: string;
  status?: "draft" | "pending_approval" | "approved" | "settled" | "cancelled" | "rejected";
  notes?: string | null;
}): Promise<Operation> {
  return apiPost("/operations", payload, operationSchema);
}

export function fetchCashflowEntries(filters: PortfolioScopedFilters = {}): Promise<CashflowEntryList> {
  return apiGet(`/cashflow${buildPortfolioScopedQueryString(filters)}`, cashflowEntryListSchema);
}

export function createCashflowEntry(payload: {
  portfolio_id: string;
  operation_id?: string | null;
  entry_date: string;
  settlement_date: string;
  description: string;
  entry_type: "inflow" | "outflow" | "transfer" | "adjustment";
  amount: string;
  status?: "pending" | "settled" | "cancelled";
}): Promise<CashflowEntry> {
  return apiPost("/cashflow", payload, cashflowEntrySchema);
}

export function fetchAssetPrices(filters: PortfolioScopedFilters = {}): Promise<AssetPriceList> {
  return apiGet(`/pricing${buildPortfolioScopedQueryString(filters)}`, assetPriceListSchema);
}

export function createAssetPrice(payload: {
  asset_id: string;
  price_date: string;
  price: string;
  source: string;
  is_validated?: boolean;
}): Promise<AssetPrice> {
  return apiPost("/pricing", payload, assetPriceSchema);
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
  portfolio_ids?: string[];
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
    portfolio_ids?: string[];
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

export function fetchReportExecutions(filters: PortfolioScopedFilters = {}): Promise<ReportExecutionList> {
  return apiGet(`/reports/executions${buildPortfolioScopedQueryString(filters)}`, reportExecutionListSchema);
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
