import { z } from "zod";

export const portfolioSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  base_currency: z.string(),
  benchmark: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const assetSchema = z.object({
  id: z.string().uuid(),
  ticker: z.string(),
  name: z.string(),
  asset_type: z.string(),
  issuer: z.string().nullable(),
  indexer: z.string().nullable(),
  maturity_date: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const operationSchema = z.object({
  id: z.string().uuid(),
  portfolio_id: z.string().uuid(),
  asset_id: z.string().uuid(),
  operation_type: z.string(),
  trade_date: z.string(),
  settlement_date: z.string(),
  quantity: z.string(),
  unit_price: z.string(),
  gross_value: z.string(),
  net_value: z.string(),
  fees: z.string(),
  taxes: z.string(),
  status: z.string(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  portfolio: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
  asset: z.object({
    id: z.string().uuid(),
    ticker: z.string(),
    name: z.string(),
  }),
});

export const portfolioListSchema = z.array(portfolioSchema);
export const assetListSchema = z.array(assetSchema);
export const operationListSchema = z.array(operationSchema);

