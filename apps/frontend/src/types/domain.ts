import type { z } from "zod";

import {
  assetListSchema,
  assetSchema,
  operationListSchema,
  operationSchema,
  portfolioListSchema,
  portfolioSchema,
} from "@/lib/api/schemas";

export type Portfolio = z.infer<typeof portfolioSchema>;
export type PortfolioList = z.infer<typeof portfolioListSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type AssetList = z.infer<typeof assetListSchema>;
export type Operation = z.infer<typeof operationSchema>;
export type OperationList = z.infer<typeof operationListSchema>;

