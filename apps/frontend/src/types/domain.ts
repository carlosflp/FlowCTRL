import type { z } from "zod";

import {
  actionResponseSchema,
  auditActorSchema,
  auditLogListSchema,
  auditLogSchema,
  assetListSchema,
  assetPriceListSchema,
  assetPriceSchema,
  assetSchema,
  importDatasetTypeSchema,
  importJobListSchema,
  importJobSchema,
  importJobStatusSchema,
  importSourceTypeSchema,
  authTokenSchema,
  cashflowEntryListSchema,
  cashflowEntrySchema,
  operationListSchema,
  operationSchema,
  positionListSchema,
  positionOverviewSchema,
  positionSchema,
  portfolioListSchema,
  portfolioScopeSchema,
  portfolioSchema,
  reportExecutionParametersSchema,
  reportExecutionListSchema,
  reportExecutionSchema,
  reportTemplateListSchema,
  reportTemplateSchema,
  userListSchema,
  userRoleSchema,
  userSchema,
} from "@/lib/api/schemas";

export type User = z.infer<typeof userSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
export type UserList = z.infer<typeof userListSchema>;
export type AuditActor = z.infer<typeof auditActorSchema>;
export type AuditLog = z.infer<typeof auditLogSchema>;
export type AuditLogList = z.infer<typeof auditLogListSchema>;
export type ActionResponse = z.infer<typeof actionResponseSchema>;
export type ImportDatasetType = z.infer<typeof importDatasetTypeSchema>;
export type ImportSourceType = z.infer<typeof importSourceTypeSchema>;
export type ImportJobStatus = z.infer<typeof importJobStatusSchema>;
export type ImportJob = z.infer<typeof importJobSchema>;
export type ImportJobList = z.infer<typeof importJobListSchema>;
export type PortfolioScope = z.infer<typeof portfolioScopeSchema>;
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
export type Position = z.infer<typeof positionSchema>;
export type PositionList = z.infer<typeof positionListSchema>;
export type PositionOverview = z.infer<typeof positionOverviewSchema>;
export type ReportTemplate = z.infer<typeof reportTemplateSchema>;
export type ReportTemplateList = z.infer<typeof reportTemplateListSchema>;
export type ReportExecutionParameters = z.infer<typeof reportExecutionParametersSchema>;
export type ReportExecution = z.infer<typeof reportExecutionSchema>;
export type ReportExecutionList = z.infer<typeof reportExecutionListSchema>;
export type AuthToken = z.infer<typeof authTokenSchema>;
