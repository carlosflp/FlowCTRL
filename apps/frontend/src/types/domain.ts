import type { z } from "zod";

import {
  assetListSchema,
  assetPriceListSchema,
  assetPriceSchema,
  assetSchema,
  authTokenSchema,
  cashflowEntryListSchema,
  cashflowEntrySchema,
  operationListSchema,
  operationSchema,
  portfolioListSchema,
  portfolioSchema,
  userSchema,
} from "@/lib/api/schemas";

export type User = z.infer<typeof userSchema>;
export type Portfolio = z.infer<typeof portfolioSchema>;
export type PortfolioList = z.infer<typeof portfolioListSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type AssetList = z.infer<typeof assetListSchema>;
export type Operation = z.infer<typeof operationSchema>;
export type OperationList = z.infer<typeof operationListSchema>;
export type CashflowEntry = z.infer<typeof cashflowEntrySchema>;
export type CashflowEntryList = z.infer<typeof cashflowEntryListSchema>;
export type AssetPrice = z.infer<typeof assetPriceSchema>;
export type AssetPriceList = z.infer<typeof assetPriceListSchema>;
export type AuthToken = z.infer<typeof authTokenSchema>;
