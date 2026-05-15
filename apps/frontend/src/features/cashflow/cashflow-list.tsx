"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, LoaderCircle, PencilLine, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm, type FieldErrors, type UseFormReturn } from "react-hook-form";
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
  deleteCashflowEntry,
  fetchCashflowEntries,
  fetchOperations,
  updateCashflowEntry,
} from "@/lib/api/entities";
import type { CashflowEntry, OperationList } from "@/types/domain";

import { getCashflowColumns } from "./columns";

const cashflowTypeOptions = ["inflow", "outflow", "transfer", "adjustment"] as const;
const cashflowStatusOptions = ["pending", "settled", "cancelled"] as const;

const feedbackToneClasses = {
  error: "rounded-lg border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-sm text-[#b91c1c]",
  success: "rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm text-[#166534]",
} as const;

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

function getDefaultCashflowValues(): CashflowFormValues {
  return {
    operation_id: "",
    entry_date: getTodayDateString(),
    settlement_date: getTodayDateString(),
    description: "",
    entry_type: "inflow",
    amount: "",
    status: "settled",
  };
}

function mapEntryToFormValues(entry: CashflowEntry): CashflowFormValues {
  return {
    operation_id: entry.operation_id ?? "",
    entry_date: entry.entry_date,
    settlement_date: entry.settlement_date,
    description: entry.description,
    entry_type: entry.entry_type as CashflowFormValues["entry_type"],
    amount: entry.amount,
    status: entry.status as CashflowFormValues["status"],
  };
}

function renderFormErrors(errors: FieldErrors<CashflowFormValues>): ReactNode {
  const messages = Object.values(errors)
    .filter((error): error is { message?: string } => typeof error === "object" && error !== null)
    .map((error) => error.message)
    .filter((message): message is string => Boolean(message));

  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-2 text-sm text-[#b91c1c]">
      {messages.map((message, index) => (
        <div key={`${message}-${index}`} className="rounded-lg border border-[#fecaca] bg-[#fff1f2] px-4 py-3">
          {message}
        </div>
      ))}
    </div>
  );
}

type CashflowFormCardProps = {
  title: string;
  description: string;
  icon: ReactNode;
  form: UseFormReturn<CashflowFormValues>;
  activePortfolioName: string | null;
  operationOptions: OperationList;
  isSubmitting: boolean;
  submitLabel: string;
  submitPendingLabel: string;
  showHeader?: boolean;
  onClose?: () => void;
  onSubmit: (values: CashflowFormValues) => Promise<void>;
};

function CashflowFormCard({
  title,
  description,
  icon,
  form,
  activePortfolioName,
  operationOptions,
  isSubmitting,
  submitLabel,
  submitPendingLabel,
  showHeader = true,
  onClose,
  onSubmit,
}: CashflowFormCardProps) {
  const formContent = (
    <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4 xl:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-ink">Carteira ativa</label>
              <div className="flex h-11 items-center rounded-lg border border-border bg-[#f7f7f4] px-3 text-sm text-ink">
                {activePortfolioName ?? "Nenhuma carteira selecionada"}
              </div>
            </div>
            <div className="space-y-2 xl:col-span-3">
              <label className="text-sm font-medium text-ink" htmlFor={`${title}-operation-id`}>
                Operacao relacionada
              </label>
              <select
                {...form.register("operation_id")}
                id={`${title}-operation-id`}
                className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
              >
                <option value="">Sem vinculo operacional</option>
                {operationOptions.map((operation) => (
                  <option key={operation.id} value={operation.id}>
                    {operation.trade_date} | {operation.asset.ticker} | {operation.operation_type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink" htmlFor={`${title}-type`}>
                Tipo
              </label>
              <select
                {...form.register("entry_type")}
                id={`${title}-type`}
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
              <label className="text-sm font-medium text-ink" htmlFor={`${title}-status`}>
                Status
              </label>
              <select
                {...form.register("status")}
                id={`${title}-status`}
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
              <label className="text-sm font-medium text-ink" htmlFor={`${title}-entry-date`}>
                Data do evento
              </label>
              <input
                {...form.register("entry_date")}
                id={`${title}-entry-date`}
                type="date"
                className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink" htmlFor={`${title}-settlement-date`}>
                Data liquidacao
              </label>
              <input
                {...form.register("settlement_date")}
                id={`${title}-settlement-date`}
                type="date"
                className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
              />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.6fr_0.8fr]">
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink" htmlFor={`${title}-description`}>
                Descricao
              </label>
              <input
                {...form.register("description")}
                id={`${title}-description`}
                placeholder="Ex.: Aporte do cotista, resgate, taxa bancaria ou ajuste operacional."
                className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink" htmlFor={`${title}-amount`}>
                Valor
              </label>
              <input
                {...form.register("amount")}
                id={`${title}-amount`}
                inputMode="decimal"
                placeholder="1500.00"
                className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
              />
            </div>
          </div>

          {renderFormErrors(form.formState.errors)}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:bg-[#115e59] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              <span>{isSubmitting ? submitPendingLabel : submitLabel}</span>
            </button>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-ink transition hover:bg-[#f0efeb]"
              >
                Cancelar
              </button>
            ) : null}
          </div>
    </form>
  );

  if (!showHeader) {
    return formContent;
  }

  return (
    <div className="rounded-lg border border-border bg-surface shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-accentSoft p-2 text-accent">{icon}</div>
          <div>
            <div className="text-base font-semibold text-ink">{title}</div>
            <div className="text-sm text-muted">{description}</div>
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink transition hover:bg-[#f0efeb]"
          >
            Fechar edicao
          </button>
        ) : null}
      </div>

      <div className="border-t border-border px-5 py-5">{formContent}</div>
    </div>
  );
}

export function CashflowList() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<CashflowEntry | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const { activePortfolio, activePortfolioId } = usePortfolioScope();
  const canWrite = user?.role === "admin" || user?.role === "manager" || user?.role === "analyst";
  const canDelete = user?.role === "admin" || user?.role === "manager";

  const createForm = useForm<CashflowFormValues>({
    resolver: zodResolver(cashflowFormSchema),
    defaultValues: getDefaultCashflowValues(),
  });
  const editForm = useForm<CashflowFormValues>({
    resolver: zodResolver(cashflowFormSchema),
    defaultValues: getDefaultCashflowValues(),
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

  useEffect(() => {
    if (!selectedEntry) {
      editForm.reset(getDefaultCashflowValues());
      return;
    }

    editForm.reset(mapEntryToFormValues(selectedEntry));
  }, [editForm, selectedEntry]);

  async function refreshCashflowQueries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["cashflow"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["reports"] }),
    ]);
  }

  const createMutation = useMutation({
    mutationFn: createCashflowEntry,
    onSuccess: async () => {
      setFeedbackTone("success");
      setFeedbackMessage("Evento de caixa registrado com sucesso.");
      createForm.reset(getDefaultCashflowValues());
      await refreshCashflowQueries();
    },
    onError: (error) => {
      setFeedbackTone("error");
      setFeedbackMessage(getErrorMessage(error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ entryId, payload }: { entryId: string; payload: Parameters<typeof updateCashflowEntry>[1] }) =>
      updateCashflowEntry(entryId, payload),
    onSuccess: async (entry) => {
      setFeedbackTone("success");
      setFeedbackMessage("Evento de caixa atualizado com sucesso.");
      setSelectedEntry(entry);
      editForm.reset(mapEntryToFormValues(entry));
      await refreshCashflowQueries();
    },
    onError: (error) => {
      setFeedbackTone("error");
      setFeedbackMessage(getErrorMessage(error));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ entryId }: { entryId: string }) =>
      updateCashflowEntry(entryId, { status: "cancelled" }),
    onSuccess: async (entry) => {
      setFeedbackTone("success");
      setFeedbackMessage("Evento de caixa cancelado com sucesso.");
      setSelectedEntry((current) => (current?.id === entry.id ? entry : current));
      await refreshCashflowQueries();
    },
    onError: (error) => {
      setFeedbackTone("error");
      setFeedbackMessage(getErrorMessage(error));
    },
    onSettled: (_data, _error, variables) => {
      setPendingCancelId((current) => (current === variables.entryId ? null : current));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ entryId }: { entryId: string }) => deleteCashflowEntry(entryId),
    onSuccess: async (_data, variables) => {
      setFeedbackTone("success");
      setFeedbackMessage("Evento de caixa excluido com sucesso.");
      setSelectedEntry((current) => (current?.id === variables.entryId ? null : current));
      await refreshCashflowQueries();
    },
    onError: (error) => {
      setFeedbackTone("error");
      setFeedbackMessage(getErrorMessage(error));
    },
    onSettled: (_data, _error, variables) => {
      setPendingDeleteId((current) => (current === variables.entryId ? null : current));
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

  const columns = useMemo(
    () =>
      getCashflowColumns({
        canWrite,
        canDelete,
        selectedEntryId: selectedEntry?.id ?? null,
        pendingCancelId,
        pendingDeleteId,
        onSelectEntry: (entry) => {
          setSelectedEntry(entry);
          setFeedbackMessage(null);
        },
        onCancelEntry: (entry) => {
          if (entry.status === "cancelled") {
            return;
          }
          const confirmed = window.confirm(
            `Cancelar o evento de caixa "${entry.description}" de ${entry.settlement_date}?`,
          );
          if (!confirmed) {
            return;
          }
          setPendingCancelId(entry.id);
          void cancelMutation.mutateAsync({ entryId: entry.id });
        },
        onDeleteEntry: (entry) => {
          const confirmed = window.confirm(
            `Excluir permanentemente o evento de caixa "${entry.description}"?`,
          );
          if (!confirmed) {
            return;
          }
          setPendingDeleteId(entry.id);
          void deleteMutation.mutateAsync({ entryId: entry.id });
        },
      }),
    [canDelete, canWrite, cancelMutation, deleteMutation, pendingCancelId, pendingDeleteId, selectedEntry?.id],
  );

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
        <div className="space-y-5">
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
                <CashflowFormCard
                  title="Registrar caixa"
                  description="Registre um evento novo e, se quiser, vincule a operacao visivel nesse mesmo escopo."
                  icon={<WalletCards className="h-5 w-5" />}
                  form={createForm}
                  activePortfolioName={activePortfolio?.name ?? null}
                  operationOptions={operationsQuery.data ?? []}
                  isSubmitting={createMutation.isPending}
                  submitLabel="Registrar evento de caixa"
                  submitPendingLabel="Registrando"
                  showHeader={false}
                  onSubmit={async (values) => {
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
                  }}
                />
              </div>
            ) : null}
          </div>

          {selectedEntry ? (
            <CashflowFormCard
              title="Editar caixa"
              description={`Revise o evento "${selectedEntry.description}" sem sair da carteira ativa.`}
              icon={<PencilLine className="h-5 w-5" />}
              form={editForm}
              activePortfolioName={activePortfolio?.name ?? null}
              operationOptions={operationsQuery.data ?? []}
              isSubmitting={updateMutation.isPending}
              submitLabel="Salvar alteracoes"
              submitPendingLabel="Salvando"
              onClose={() => setSelectedEntry(null)}
              onSubmit={async (values) => {
                if (!selectedEntry) {
                  return;
                }

                setFeedbackMessage(null);
                await updateMutation.mutateAsync({
                  entryId: selectedEntry.id,
                  payload: {
                    operation_id: values.operation_id || null,
                    entry_date: values.entry_date,
                    settlement_date: values.settlement_date,
                    description: values.description,
                    entry_type: values.entry_type,
                    amount: values.amount,
                    status: values.status,
                  },
                });
              }}
            />
          ) : null}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-[#f7f7f4] px-4 py-4 text-sm text-muted">
          Seu perfil esta em modo leitura. Para alterar caixa, use uma conta com perfil `analyst`, `manager` ou `admin`.
        </div>
      )}

      {feedbackMessage ? <div className={feedbackToneClasses[feedbackTone]}>{feedbackMessage}</div> : null}

      <SearchToolbar placeholder="Buscar por carteira, descricao, tipo ou status" onSearch={setQuery} />

      {cashflowQuery.isLoading ? (
        <EmptyState title="Carregando caixa" description="Consultando os eventos de caixa da carteira ativa." />
      ) : cashflowQuery.isError ? (
        <EmptyState
          title="Nao foi possivel carregar o caixa"
          description="Confira se a API esta disponivel e se a carteira selecionada continua acessivel."
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredData}
          emptyMessage="Nenhum evento de caixa encontrado para a carteira ativa."
        />
      )}
    </section>
  );
}
