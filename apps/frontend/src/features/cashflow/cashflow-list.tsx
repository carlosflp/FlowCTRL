"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, LoaderCircle, WalletCards } from "lucide-react";
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
  createCashflowEntry,
  fetchCashflowEntries,
  fetchOperations,
} from "@/lib/api/entities";

import { cashflowColumns } from "./columns";

const cashflowTypeOptions = ["inflow", "outflow", "transfer", "adjustment"] as const;
const cashflowStatusOptions = ["pending", "settled", "cancelled"] as const;

function getTodayDateString(): string {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function isPositiveDecimal(value: string) {
  const numericValue = Number(value);
  return value.trim() !== "" && !Number.isNaN(numericValue) && numericValue > 0;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.detail ?? "Nao foi possivel registrar o evento de caixa.";
  }
  return "Nao foi possivel registrar o evento de caixa.";
}

const cashflowFormSchema = z
  .object({
    operation_id: z.string().uuid().optional().or(z.literal("")),
    entry_date: z.string().min(1),
    settlement_date: z.string().min(1),
    description: z.string().min(2),
    entry_type: z.enum(cashflowTypeOptions),
    amount: z.string().refine(isPositiveDecimal, "Informe um valor maior que zero."),
    status: z.enum(cashflowStatusOptions),
  })
  .refine((values) => values.settlement_date >= values.entry_date, {
    message: "A data de liquidacao nao pode ser anterior a data do evento.",
    path: ["settlement_date"],
  });

type CashflowFormValues = z.infer<typeof cashflowFormSchema>;

export function CashflowList() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(true);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");
  const { activePortfolio, activePortfolioId } = usePortfolioScope();
  const canWrite = user?.role === "admin" || user?.role === "manager" || user?.role === "analyst";

  const form = useForm<CashflowFormValues>({
    resolver: zodResolver(cashflowFormSchema),
    defaultValues: {
      operation_id: "",
      entry_date: getTodayDateString(),
      settlement_date: getTodayDateString(),
      description: "",
      entry_type: "inflow",
      amount: "",
      status: "settled",
    },
  });

  const cashflowQuery = useQuery({
    queryKey: ["cashflow", activePortfolioId],
    queryFn: () => fetchCashflowEntries({ portfolioId: activePortfolioId }),
  });
  const operationsQuery = useQuery({
    queryKey: ["cashflow", "operations", activePortfolioId],
    queryFn: () => fetchOperations({ portfolioId: activePortfolioId }),
    enabled: canWrite,
  });

  const createMutation = useMutation({
    mutationFn: createCashflowEntry,
    onSuccess: async () => {
      setFeedbackTone("success");
      setFeedbackMessage("Evento de caixa registrado com sucesso.");
      form.reset({
        operation_id: "",
        entry_date: getTodayDateString(),
        settlement_date: getTodayDateString(),
        description: "",
        entry_type: "inflow",
        amount: "",
        status: "settled",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cashflow"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
      ]);
    },
    onError: (error) => {
      setFeedbackTone("error");
      setFeedbackMessage(getErrorMessage(error));
    },
  });

  const filteredData = useMemo(() => {
    if (!cashflowQuery.data) {
      return [];
    }

    const normalized = query.toLowerCase();
    if (!normalized) {
      return cashflowQuery.data;
    }

    return cashflowQuery.data.filter(
      (entry) =>
        entry.portfolio.name.toLowerCase().includes(normalized) ||
        entry.description.toLowerCase().includes(normalized) ||
        entry.entry_type.toLowerCase().includes(normalized) ||
        entry.status.toLowerCase().includes(normalized),
    );
  }, [cashflowQuery.data, query]);

  return (
    <section className="space-y-8">
      <PageHeader
        title="Caixa"
        description={
          activePortfolio
            ? `Movimentos de caixa filtrados pela carteira ativa ${activePortfolio.name}.`
            : "Movimentos de caixa da carteira selecionada."
        }
      />

      {canWrite ? (
        <div className="rounded-lg border border-border bg-surface shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accentSoft p-2 text-accent">
                <WalletCards className="h-5 w-5" />
              </div>
              <div>
                <div className="text-base font-semibold text-ink">Novo evento de caixa</div>
                <div className="text-sm text-muted">
                  Lance entradas, saidas, ajustes e transferencias diretamente na carteira ativa.
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
                    setFeedbackMessage("Selecione uma carteira antes de registrar eventos de caixa.");
                    return;
                  }

                  setFeedbackMessage(null);
                  await createMutation.mutateAsync({
                    portfolio_id: activePortfolioId,
                    operation_id: values.operation_id || null,
                    entry_date: values.entry_date,
                    settlement_date: values.settlement_date,
                    description: values.description,
                    entry_type: values.entry_type,
                    amount: values.amount,
                    status: values.status,
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
                    <label className="text-sm font-medium text-ink" htmlFor="cashflow-operation-id">
                      Operacao relacionada
                    </label>
                    <select
                      {...form.register("operation_id")}
                      id="cashflow-operation-id"
                      className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
                    >
                      <option value="">Sem vinculo operacional</option>
                      {(operationsQuery.data ?? []).map((operation) => (
                        <option key={operation.id} value={operation.id}>
                          {operation.trade_date} | {operation.asset.ticker} | {operation.operation_type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-ink" htmlFor="cashflow-type">
                      Tipo
                    </label>
                    <select
                      {...form.register("entry_type")}
                      id="cashflow-type"
                      className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
                    >
                      {cashflowTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-ink" htmlFor="cashflow-status">
                      Status
                    </label>
                    <select
                      {...form.register("status")}
                      id="cashflow-status"
                      className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
                    >
                      {cashflowStatusOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-ink" htmlFor="cashflow-entry-date">
                      Data do evento
                    </label>
                    <input
                      {...form.register("entry_date")}
                      id="cashflow-entry-date"
                      type="date"
                      className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-ink" htmlFor="cashflow-settlement-date">
                      Data liquidacao
                    </label>
                    <input
                      {...form.register("settlement_date")}
                      id="cashflow-settlement-date"
                      type="date"
                      className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
                    />
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.6fr_0.8fr]">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-ink" htmlFor="cashflow-description">
                      Descricao
                    </label>
                    <input
                      {...form.register("description")}
                      id="cashflow-description"
                      placeholder="Ex.: Aporte do cotista, resgate, taxa bancaria ou ajuste operacional."
                      className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-ink" htmlFor="cashflow-amount">
                      Valor
                    </label>
                    <input
                      {...form.register("amount")}
                      id="cashflow-amount"
                      inputMode="decimal"
                      placeholder="1500.00"
                      className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
                    />
                  </div>
                </div>

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

                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:bg-[#115e59] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {createMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  <span>{createMutation.isPending ? "Registrando" : "Registrar evento de caixa"}</span>
                </button>
              </form>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-[#f7f7f4] px-4 py-4 text-sm text-muted">
          Seu perfil esta em modo leitura. Para registrar caixa, use uma conta com perfil `analyst`, `manager` ou `admin`.
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

      <SearchToolbar placeholder="Buscar por carteira, descricao, tipo ou status" onSearch={setQuery} />

      {cashflowQuery.isLoading ? (
        <EmptyState title="Carregando caixa" description="Consultando os eventos de caixa da carteira ativa." />
      ) : cashflowQuery.isError ? (
        <EmptyState
          title="Nao foi possivel carregar o caixa"
          description="Confira se a API esta disponivel e se a carteira selecionada continua acessivel."
        />
      ) : (
        <DataTable columns={cashflowColumns} data={filteredData} emptyMessage="Nenhum evento de caixa encontrado para a carteira ativa." />
      )}
    </section>
  );
}
