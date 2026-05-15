"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, ClipboardPlus, LoaderCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { usePortfolioScope } from "@/components/portfolio-scope-provider";
import { SearchToolbar } from "@/components/search-toolbar";
import { useAuth } from "@/features/auth/auth-provider";
import { ApiError } from "@/lib/api/client";
import {
  createOperation,
  fetchAssetReferenceCatalog,
  fetchOperations,
} from "@/lib/api/entities";

import { operationColumns } from "./columns";

const operationTypeOptions = [
  "buy",
  "sell",
  "contribution",
  "redemption",
  "dividend",
  "interest",
  "coupon",
  "amortization",
  "fee",
  "tax",
  "adjustment",
  "transfer",
] as const;

const operationStatusOptions = [
  "draft",
  "pending_approval",
  "approved",
  "settled",
  "cancelled",
  "rejected",
] as const;

function getTodayDateString(): string {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function isNonNegativeDecimal(value: string) {
  const numericValue = Number(value);
  return value.trim() !== "" && !Number.isNaN(numericValue) && numericValue >= 0;
}

function isPositiveDecimal(value: string) {
  const numericValue = Number(value);
  return value.trim() !== "" && !Number.isNaN(numericValue) && numericValue > 0;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.detail ?? "Nao foi possivel concluir o lancamento.";
  }
  return "Nao foi possivel concluir o lancamento.";
}

const operationFormSchema = z
  .object({
    asset_id: z.string().uuid(),
    operation_type: z.enum(operationTypeOptions),
    trade_date: z.string().min(1),
    settlement_date: z.string().min(1),
    quantity: z.string().refine(isPositiveDecimal, "Informe uma quantidade maior que zero."),
    unit_price: z.string().refine(isNonNegativeDecimal, "Informe um preco unitario valido."),
    fees: z.string().refine(isNonNegativeDecimal, "Informe uma taxa valida."),
    taxes: z.string().refine(isNonNegativeDecimal, "Informe um imposto valido."),
    status: z.enum(operationStatusOptions),
    notes: z.string().optional(),
  })
  .refine((values) => values.settlement_date >= values.trade_date, {
    message: "A data de liquidacao nao pode ser anterior a data trade.",
    path: ["settlement_date"],
  });

type OperationFormValues = z.infer<typeof operationFormSchema>;

export function OperationList() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(true);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");
  const { activePortfolio, activePortfolioId } = usePortfolioScope();
  const canWrite = user?.role === "admin" || user?.role === "manager" || user?.role === "analyst";

  const form = useForm<OperationFormValues>({
    resolver: zodResolver(operationFormSchema),
    defaultValues: {
      asset_id: "",
      operation_type: "buy",
      trade_date: getTodayDateString(),
      settlement_date: getTodayDateString(),
      quantity: "",
      unit_price: "",
      fees: "0",
      taxes: "0",
      status: "approved",
      notes: "",
    },
  });

  const operationsQuery = useQuery({
    queryKey: ["operations", activePortfolioId],
    queryFn: () => fetchOperations({ portfolioId: activePortfolioId }),
  });
  const assetCatalogQuery = useQuery({
    queryKey: ["operations", "asset-reference-catalog"],
    queryFn: fetchAssetReferenceCatalog,
    enabled: canWrite,
  });

  const createMutation = useMutation({
    mutationFn: createOperation,
    onSuccess: async () => {
      setFeedbackTone("success");
      setFeedbackMessage("Operacao registrada com sucesso.");
      form.reset({
        asset_id: "",
        operation_type: "buy",
        trade_date: getTodayDateString(),
        settlement_date: getTodayDateString(),
        quantity: "",
        unit_price: "",
        fees: "0",
        taxes: "0",
        status: "approved",
        notes: "",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["operations"] }),
        queryClient.invalidateQueries({ queryKey: ["assets"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["positions"] }),
        queryClient.invalidateQueries({ queryKey: ["pricing"] }),
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
      ]);
    },
    onError: (error) => {
      setFeedbackTone("error");
      setFeedbackMessage(getErrorMessage(error));
    },
  });

  const filteredData = useMemo(() => {
    if (!operationsQuery.data) {
      return [];
    }

    const normalized = query.toLowerCase();
    if (!normalized) {
      return operationsQuery.data;
    }

    return operationsQuery.data.filter(
      (operation) =>
        operation.portfolio.name.toLowerCase().includes(normalized) ||
        operation.asset.ticker.toLowerCase().includes(normalized) ||
        operation.operation_type.toLowerCase().includes(normalized) ||
        operation.status.toLowerCase().includes(normalized),
    );
  }, [operationsQuery.data, query]);

  return (
    <section className="space-y-8">
      <PageHeader
        title="Operacoes"
        description={
          activePortfolio
            ? `Registro operacional filtrado pela carteira ativa ${activePortfolio.name}.`
            : "Registro operacional da carteira selecionada."
        }
      />

      {canWrite ? (
        <div className="rounded-lg border border-border bg-surface shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accentSoft p-2 text-accent">
                <ClipboardPlus className="h-5 w-5" />
              </div>
              <div>
                <div className="text-base font-semibold text-ink">Novo lancamento operacional</div>
                <div className="text-sm text-muted">
                  A carteira ativa ja entra travada no formulario para evitar erro de escopo.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateOpen((current) => !current)}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink transition hover:bg-[#f0efeb]"
            >
              <span>{isCreateOpen ? "Ocultar formulario" : "Abrir formulario"}</span>
              {isCreateOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>

          {isCreateOpen ? (
            <div className="border-t border-border px-5 py-5">
              <form
                className="space-y-5"
                onSubmit={form.handleSubmit(async (values) => {
                  if (!activePortfolioId) {
                    setFeedbackTone("error");
                    setFeedbackMessage("Selecione uma carteira antes de registrar operacoes.");
                    return;
                  }

                  setFeedbackMessage(null);
                  await createMutation.mutateAsync({
                    portfolio_id: activePortfolioId,
                    asset_id: values.asset_id,
                    operation_type: values.operation_type,
                    trade_date: values.trade_date,
                    settlement_date: values.settlement_date,
                    quantity: values.quantity,
                    unit_price: values.unit_price,
                    fees: values.fees,
                    taxes: values.taxes,
                    status: values.status,
                    notes: values.notes?.trim() ? values.notes : null,
                  });
                })}
              >
                <div className="grid gap-4 xl:grid-cols-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-ink">Carteira ativa</label>
                    <div className="flex h-11 items-center rounded-lg border border-border bg-[#f7f7f4] px-3 text-sm text-ink">
                      {activePortfolio?.name ?? "Nenhuma carteira selecionada"}
                    </div>
                  </div>
                  <div className="space-y-2 xl:col-span-3">
                    <label className="text-sm font-medium text-ink" htmlFor="operation-asset">
                      Ativo
                    </label>
                    <select
                      {...form.register("asset_id")}
                      id="operation-asset"
                      className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
                    >
                      <option value="">Selecione um ativo</option>
                      {(assetCatalogQuery.data ?? []).map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.ticker} | {asset.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-ink" htmlFor="operation-type">
                      Tipo
                    </label>
                    <select
                      {...form.register("operation_type")}
                      id="operation-type"
                      className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
                    >
                      {operationTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-ink" htmlFor="operation-status">
                      Status
                    </label>
                    <select
                      {...form.register("status")}
                      id="operation-status"
                      className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
                    >
                      {operationStatusOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-ink" htmlFor="operation-trade-date">
                      Data trade
                    </label>
                    <input
                      {...form.register("trade_date")}
                      id="operation-trade-date"
                      type="date"
                      className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-ink" htmlFor="operation-settlement-date">
                      Data liquidacao
                    </label>
                    <input
                      {...form.register("settlement_date")}
                      id="operation-settlement-date"
                      type="date"
                      className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-ink" htmlFor="operation-quantity">
                      Quantidade
                    </label>
                    <input
                      {...form.register("quantity")}
                      id="operation-quantity"
                      inputMode="decimal"
                      placeholder="100"
                      className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-ink" htmlFor="operation-unit-price">
                      Preco unitario
                    </label>
                    <input
                      {...form.register("unit_price")}
                      id="operation-unit-price"
                      inputMode="decimal"
                      placeholder="10.50"
                      className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-ink" htmlFor="operation-fees">
                      Taxas
                    </label>
                    <input
                      {...form.register("fees")}
                      id="operation-fees"
                      inputMode="decimal"
                      className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-ink" htmlFor="operation-taxes">
                      Impostos
                    </label>
                    <input
                      {...form.register("taxes")}
                      id="operation-taxes"
                      inputMode="decimal"
                      className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-ink" htmlFor="operation-notes">
                    Observacoes
                  </label>
                  <textarea
                    {...form.register("notes")}
                    id="operation-notes"
                    rows={3}
                    placeholder="Motivo, broker, referencia interna ou observacoes de auditoria."
                    className="w-full rounded-lg border border-border bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-accent"
                  />
                </div>

                {form.formState.errors.root ? (
                  <div className="rounded-lg border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-sm text-[#b91c1c]">
                    {form.formState.errors.root.message}
                  </div>
                ) : null}

                <div className="grid gap-2 text-sm text-[#b91c1c]">
                  {Object.values(form.formState.errors)
                    .filter((error): error is { message?: string } => typeof error === "object" && error !== null)
                    .map((error, index) =>
                      error.message ? (
                        <div key={`${error.message}-${index}`} className="rounded-lg border border-[#fecaca] bg-[#fff1f2] px-4 py-3">
                          {error.message}
                        </div>
                      ) : null,
                    )}
                </div>

                {assetCatalogQuery.data && assetCatalogQuery.data.length === 0 ? (
                  <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-sm text-[#92400e]">
                    Nenhum ativo de referencia foi encontrado. Cadastre ativos antes de registrar operacoes.
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={createMutation.isPending || (assetCatalogQuery.data?.length ?? 0) === 0}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:bg-[#115e59] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {createMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  <span>{createMutation.isPending ? "Registrando" : "Registrar operacao"}</span>
                </button>
              </form>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-[#f7f7f4] px-4 py-4 text-sm text-muted">
          Seu perfil esta em modo leitura. Para registrar operacoes, use uma conta com perfil `analyst`, `manager` ou `admin`.
        </div>
      )}

      {feedbackMessage ? (
        <div
          className={
            feedbackTone === "error"
              ? "rounded-lg border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-sm text-[#b91c1c]"
              : "rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm text-[#166534]"
          }
        >
          {feedbackMessage}
        </div>
      ) : null}

      <SearchToolbar placeholder="Buscar por carteira, ativo, tipo ou status" onSearch={setQuery} />

      {operationsQuery.isLoading ? (
        <EmptyState title="Carregando operacoes" description="Buscando o historico operacional da carteira ativa." />
      ) : operationsQuery.isError ? (
        <EmptyState
          title="Nao foi possivel carregar as operacoes"
          description="Confira se a API esta disponivel e se a carteira ativa continua acessivel para este usuario."
        />
      ) : (
        <DataTable
          columns={operationColumns}
          data={filteredData}
          emptyMessage="Nenhuma operacao encontrada para a carteira ativa."
        />
      )}
    </section>
  );
}
