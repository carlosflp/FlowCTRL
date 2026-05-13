import {
  assetListSchema,
  assetPriceListSchema,
  cashflowEntryListSchema,
  operationListSchema,
  portfolioListSchema,
} from "@/lib/api/schemas";
import { apiGet } from "@/lib/api/client";
import type {
  AssetList,
  AssetPriceList,
  CashflowEntryList,
  OperationList,
  PortfolioList,
} from "@/types/domain";

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
