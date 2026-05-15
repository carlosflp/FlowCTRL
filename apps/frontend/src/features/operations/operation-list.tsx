"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, ClipboardPlus, LoaderCircle, PencilLine } from "lucide-react";
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
  createOperation,
  deleteOperation,
  fetchAssetReferenceCatalog,
  fetchOperations,
  updateOperation,
} from "@/lib/api/entities";
import type { AssetList, Operation } from "@/types/domain";

import { getOperationColumns } from "./columns";

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

const feedbackToneClasses = {
  error: "rounded-lg border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-sm text-[#b91c1c]",
  success: "rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm text-[#166534]",
} as const;

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

function getDefaultOperationValues(): OperationFormValues {
  return {
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
  };
}

function mapOperationToFormValues(operation: Operation): OperationFormValues {
  return {
    asset_id: operation.asset_id,
    operation_type: operation.operation_type as OperationFormValues["operation_type"],
    trade_date: operation.trade_date,
    settlement_date: operation.settlement_date,
    quantity: operation.quantity,
    unit_price: operation.unit_price,
    fees: operation.fees,
    taxes: operation.taxes,
    status: operation.status as OperationFormValues["status"],
    notes: operation.notes ?? "",
  };
}

function renderFormErrors(errors: FieldErrors<OperationFormValues>): ReactNode {
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

type OperationFormCardProps = {
  title: string;
  description: string;
  icon: ReactNode;
  form: UseFormReturn<OperationFormValues>;
  assetOptions: AssetList;
  activePortfolioName: string | null;
  isSubmitting: boolean;
  submitLabel: string;
  submitPendingLabel: string;
  submitDisabled?: boolean;
  showHeader?: boolean;
  onClose?: () => void;
  onSubmit: (values: OperationFormValues) => Promise<void>;
};

function OperationFormCard({
  title,
  description,
  icon,
  form,
  assetOptions,
  activePortfolioName,
  isSubmitting,
  submitLabel,
  submitPendingLabel,
  submitDisabled = false,
  showHeader = true,
  onClose,
  onSubmit,
}: OperationFormCardProps) {
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
              <label className="text-sm font-medium text-ink" htmlFor={`${title}-asset`}>
                Ativo
              </label>
              <select
                {...form.register("asset_id")}
                id={`${title}-asset`}
                className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
              >
                <option value="">Selecione um ativo</option>
                {assetOptions.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.ticker} | {asset.name}
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
                {...form.register("operation_type")}
                id={`${title}-type`}
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
              <label className="text-sm font-medium text-ink" htmlFor={`${title}-status`}>
                Status
              </label>
              <select
                {...form.register("status")}
                id={`${title}-status`}
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
              <label className="text-sm font-medium text-ink" htmlFor={`${title}-trade-date`}>
                Data trade
              </label>
              <input
                {...form.register("trade_date")}
                id={`${title}-trade-date`}
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

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink" htmlFor={`${title}-quantity`}>
                Quantidade
              </label>
              <input
                {...form.register("quantity")}
                id={`${title}-quantity`}
                inputMode="decimal"
                placeholder="100"
                className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink" htmlFor={`${title}-unit-price`}>
                Preco unitario
              </label>
              <input
                {...form.register("unit_price")}
                id={`${title}-unit-price`}
                inputMode="decimal"
                placeholder="10.50"
                className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink" htmlFor={`${title}-fees`}>
                Taxas
              </label>
              <input
                {...form.register("fees")}
                id={`${title}-fees`}
                inputMode="decimal"
                className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink" htmlFor={`${title}-taxes`}>
                Impostos
              </label>
              <input
                {...form.register("taxes")}
                id={`${title}-taxes`}
                inputMode="decimal"
                className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-ink" htmlFor={`${title}-notes`}>
              Observacoes
            </label>
            <textarea
              {...form.register("notes")}
              id={`${title}-notes`}
              rows={3}
              placeholder="Motivo, broker, referencia interna ou observacoes de auditoria."
              className="w-full rounded-lg border border-border bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-accent"
            />
          </div>

          {renderFormErrors(form.formState.errors)}

          {assetOptions.length === 0 ? (
            <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-sm text-[#92400e]">
              Nenhum ativo de referencia foi encontrado. Cadastre ativos antes de registrar operacoes.
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting || submitDisabled || assetOptions.length === 0}
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

export function OperationList() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(true);
  const [selectedOperation, setSelectedOperation] = useState<Operation | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const { activePortfolio, activePortfolioId } = usePortfolioScope();
  const canWrite = user?.role === "admin" || user?.role === "manager" || user?.role === "analyst";
  const canDelete = user?.role === "admin" || user?.role === "manager";

  const createForm = useForm<OperationFormValues>({
    resolver: zodResolver(operationFormSchema),
    defaultValues: getDefaultOperationValues(),
  });
  const editForm = useForm<OperationFormValues>({
    resolver: zodResolver(operationFormSchema),
    defaultValues: getDefaultOperationValues(),
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

  useEffect(() => {
    if (!selectedOperation) {
      editForm.reset(getDefaultOperationValues());
      return;
    }

    editForm.reset(mapOperationToFormValues(selectedOperation));
  }, [editForm, selectedOperation]);

  async function refreshOperationalQueries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["operations"] }),
      queryClient.invalidateQueries({ queryKey: ["assets"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["positions"] }),
      queryClient.invalidateQueries({ queryKey: ["pricing"] }),
      queryClient.invalidateQueries({ queryKey: ["reports"] }),
    ]);
  }

  const createMutation = useMutation({
    mutationFn: createOperation,
    onSuccess: async () => {
      setFeedbackTone("success");
      setFeedbackMessage("Operacao registrada com sucesso.");
      createForm.reset(getDefaultOperationValues());
      await refreshOperationalQueries();
    },
    onError: (error) => {
      setFeedbackTone("error");
      setFeedbackMessage(getErrorMessage(error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ operationId, payload }: { operationId: string; payload: Parameters<typeof updateOperation>[1] }) =>
      updateOperation(operationId, payload),
    onSuccess: async (operation) => {
      setFeedbackTone("success");
      setFeedbackMessage("Operacao atualizada com sucesso.");
      setSelectedOperation(operation);
      editForm.reset(mapOperationToFormValues(operation));
      await refreshOperationalQueries();
    },
    onError: (error) => {
      setFeedbackTone("error");
      setFeedbackMessage(getErrorMessage(error));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ operationId }: { operationId: string }) =>
      updateOperation(operationId, { status: "cancelled" }),
    onSuccess: async (operation) => {
      setFeedbackTone("success");
      setFeedbackMessage("Operacao cancelada com sucesso.");
      setSelectedOperation((current) => (current?.id === operation.id ? operation : current));
      await refreshOperationalQueries();
    },
    onError: (error) => {
      setFeedbackTone("error");
      setFeedbackMessage(getErrorMessage(error));
    },
    onSettled: (_data, _error, variables) => {
      setPendingCancelId((current) => (current === variables.operationId ? null : current));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ operationId }: { operationId: string }) => deleteOperation(operationId),
    onSuccess: async (_data, variables) => {
      setFeedbackTone("success");
      setFeedbackMessage("Operacao excluida com sucesso.");
      setSelectedOperation((current) => (current?.id === variables.operationId ? null : current));
      await refreshOperationalQueries();
    },
    onError: (error) => {
      setFeedbackTone("error");
      setFeedbackMessage(getErrorMessage(error));
    },
    onSettled: (_data, _error, variables) => {
      setPendingDeleteId((current) => (current === variables.operationId ? null : current));
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

  const columns = useMemo(
    () =>
      getOperationColumns({
        canWrite,
        canDelete,
        selectedOperationId: selectedOperation?.id ?? null,
        pendingCancelId,
        pendingDeleteId,
        onSelectOperation: (operation) => {
          setSelectedOperation(operation);
          setFeedbackMessage(null);
        },
        onCancelOperation: (operation) => {
          if (operation.status === "cancelled") {
            return;
          }
          const confirmed = window.confirm(
            `Cancelar a operacao ${operation.asset.ticker} de ${operation.trade_date}?`,
          );
          if (!confirmed) {
            return;
          }
          setPendingCancelId(operation.id);
          void cancelMutation.mutateAsync({ operationId: operation.id });
        },
        onDeleteOperation: (operation) => {
          const confirmed = window.confirm(
            `Excluir permanentemente a operacao ${operation.asset.ticker} de ${operation.trade_date}?`,
          );
          if (!confirmed) {
            return;
          }
          setPendingDeleteId(operation.id);
          void deleteMutation.mutateAsync({ operationId: operation.id });
        },
      }),
    [canDelete, canWrite, cancelMutation, deleteMutation, pendingCancelId, pendingDeleteId, selectedOperation?.id],
  );

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
        <div className="space-y-5">
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
                <OperationFormCard
                  title="Registrar operacao"
                  description="Preencha os dados economicos e deixe a carteira ativa travada no contexto atual."
                  icon={<ClipboardPlus className="h-5 w-5" />}
                  form={createForm}
                  assetOptions={assetCatalogQuery.data ?? []}
                  activePortfolioName={activePortfolio?.name ?? null}
                  isSubmitting={createMutation.isPending}
                  submitLabel="Registrar operacao"
                  submitPendingLabel="Registrando"
                  submitDisabled={!activePortfolioId}
                  showHeader={false}
                  onSubmit={async (values) => {
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
                  }}
                />
              </div>
            ) : null}
          </div>

          {selectedOperation ? (
            <OperationFormCard
              title="Editar operacao"
              description={`Ajuste o lancamento de ${selectedOperation.asset.ticker} sem sair da carteira ativa.`}
              icon={<PencilLine className="h-5 w-5" />}
              form={editForm}
              assetOptions={assetCatalogQuery.data ?? []}
              activePortfolioName={activePortfolio?.name ?? null}
              isSubmitting={updateMutation.isPending}
              submitLabel="Salvar alteracoes"
              submitPendingLabel="Salvando"
              onClose={() => setSelectedOperation(null)}
              onSubmit={async (values) => {
                if (!selectedOperation) {
                  return;
                }

                setFeedbackMessage(null);
                await updateMutation.mutateAsync({
                  operationId: selectedOperation.id,
                  payload: {
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
                  },
                });
              }}
            />
          ) : null}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-[#f7f7f4] px-4 py-4 text-sm text-muted">
          Seu perfil esta em modo leitura. Para alterar operacoes, use uma conta com perfil `analyst`, `manager` ou `admin`.
        </div>
      )}

      {feedbackMessage ? <div className={feedbackToneClasses[feedbackTone]}>{feedbackMessage}</div> : null}

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
          columns={columns}
          data={filteredData}
          emptyMessage="Nenhuma operacao encontrada para a carteira ativa."
        />
      )}
    </section>
  );
}
