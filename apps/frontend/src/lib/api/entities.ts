import { assetListSchema, operationListSchema, portfolioListSchema } from "@/lib/api/schemas";
import { apiGet } from "@/lib/api/client";
import type { AssetList, OperationList, PortfolioList } from "@/types/domain";

export function fetchPortfolios(): Promise<PortfolioList> {
  return apiGet("/portfolios", portfolioListSchema);
}

export function fetchAssets(): Promise<AssetList> {
  return apiGet("/assets", assetListSchema);
}

export function fetchOperations(): Promise<OperationList> {
  return apiGet("/operations", operationListSchema);
}

