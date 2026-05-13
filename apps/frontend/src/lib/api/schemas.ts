import { z } from "zod";

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  full_name: z.string(),
  is_active: z.boolean(),
  is_superuser: z.boolean(),
  role: z.enum(["admin", "manager", "analyst", "viewer"]),
  created_at: z.string(),
  updated_at: z.string(),
});

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

export const cashflowEntrySchema = z.object({
  id: z.string().uuid(),
  portfolio_id: z.string().uuid(),
  operation_id: z.string().uuid().nullable(),
  entry_date: z.string(),
  settlement_date: z.string(),
  description: z.string(),
  entry_type: z.string(),
  amount: z.string(),
  status: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  portfolio: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
  operation: z
    .object({
      id: z.string().uuid(),
      operation_type: z.string(),
      status: z.string(),
    })
    .nullable(),
});

export const assetPriceSchema = z.object({
  id: z.string().uuid(),
  asset_id: z.string().uuid(),
  price_date: z.string(),
  price: z.string(),
  source: z.string(),
  is_validated: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  asset: z.object({
    id: z.string().uuid(),
    ticker: z.string(),
    name: z.string(),
  }),
});

export const positionSchema = z.object({
  as_of_date: z.string(),
  portfolio: z.object({
    id: z.string().uuid(),
    name: z.string(),
    base_currency: z.string(),
  }),
  asset: z.object({
    id: z.string().uuid(),
    ticker: z.string(),
    name: z.string(),
    asset_type: z.string(),
  }),
  quantity: z.string(),
  average_cost: z.string(),
  total_cost_basis: z.string(),
  latest_price: z.string().nullable(),
  latest_price_date: z.string().nullable(),
  price_source: z.string().nullable(),
  is_price_validated: z.boolean().nullable(),
  market_value: z.string().nullable(),
  unrealized_pnl: z.string().nullable(),
  unrealized_pnl_pct: z.string().nullable(),
  last_trade_date: z.string(),
  operation_count: z.number(),
});

export const positionOverviewSchema = z.object({
  as_of_date: z.string(),
  open_positions: z.number(),
  priced_positions: z.number(),
  unpriced_positions: z.number(),
  total_cost_basis: z.string(),
  total_market_value: z.string(),
  total_unrealized_pnl: z.string(),
  pricing_coverage_pct: z.string(),
});

export const reportTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  template_type: z.enum(["csv", "xlsx", "pdf"]),
  config_json: z.record(z.unknown()).nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const reportExecutionSchema = z.object({
  id: z.string().uuid(),
  template_id: z.string().uuid(),
  portfolio_id: z.string().uuid().nullable(),
  status: z.enum(["queued", "running", "completed", "failed"]),
  parameters_json: z.record(z.unknown()).nullable(),
  file_path: z.string().nullable(),
  file_type: z.string().nullable(),
  created_at: z.string(),
  finished_at: z.string().nullable(),
  template: z.object({
    id: z.string().uuid(),
    name: z.string(),
    template_type: z.enum(["csv", "xlsx", "pdf"]),
  }),
  portfolio: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
    })
    .nullable(),
});

export const authTokenSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  user: userSchema,
});

export const portfolioListSchema = z.array(portfolioSchema);
export const assetListSchema = z.array(assetSchema);
export const operationListSchema = z.array(operationSchema);
export const cashflowEntryListSchema = z.array(cashflowEntrySchema);
export const assetPriceListSchema = z.array(assetPriceSchema);
export const positionListSchema = z.array(positionSchema);
export const reportTemplateListSchema = z.array(reportTemplateSchema);
export const reportExecutionListSchema = z.array(reportExecutionSchema);
