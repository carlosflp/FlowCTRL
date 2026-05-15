"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, LoaderCircle, PencilLine, Tags } from "lucide-react";
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
  createAssetPrice,
  deleteAssetPrice,
  fetchAssetPrices,
  fetchAssets,
  updateAssetPrice,
} from "@/lib/api/entities";
import type { AssetList, AssetPrice } from "@/types/domain";

import { getPricingColumns } from "./columns";

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

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.detail ?? "Nao foi possivel registrar o preco.";
  }
  return "Nao foi possivel registrar o preco.";
}

const pricingFormSchema = z.object({
  asset_id: z.string().uuid(),
  price_date: z.string().min(1),
  price: z.string().refine(isNonNegativeDecimal, "Informe um preco valido."),
  source: z.string().min(1),
  is_validated: z.boolean(),
});

type PricingFormValues = z.infer<typeof pricingFormSchema>;

function getDefaultPricingValues(): PricingFormValues {
  return {
    asset_id: "",
    price_date: getTodayDateString(),
    price: "",
    source: "manual",
    is_validated: true,
  };
}

function mapPriceToFormValues(price: AssetPrice): PricingFormValues {
  return {
    asset_id: price.asset_id,
    price_date: price.price_date,
    price: price.price,
    source: price.source,
    is_validated: price.is_validated,
  };
}

function renderFormErrors(errors: FieldErrors<PricingFormValues>): ReactNode {
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

type PricingFormCardProps = {
  title: string;
  description: string;
  icon: ReactNode;
  form: UseFormReturn<PricingFormValues>;
  activePortfolioName: string | null;
  assetOptions: AssetList;
  isSubmitting: boolean;
  submitLabel: string;
  submitPendingLabel: string;
  showHeader?: boolean;
  onClose?: () => void;
  onSubmit: (values: PricingFormValues) => Promise<void>;
};

function PricingFormCard({
  title,
  description,
  icon,
  form,
  activePortfolioName,
  assetOptions,
  isSubmitting,
  submitLabel,
  submitPendingLabel,
  showHeader = true,
  onClose,
  onSubmit,
}: PricingFormCardProps) {
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
              <label className="text-sm font-medium text-ink" htmlFor={`${title}-date`}>
                Data do preco
              </label>
              <input
                {...form.register("price_date")}
                id={`${title}-date`}
                type="date"
                className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink" htmlFor={`${title}-price`}>
                Preco
              </label>
              <input
                {...form.register("price")}
                id={`${title}-price`}
                inputMode="decimal"
                placeholder="101.35"
                className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
              />
            </div>
            <div className="space-y-2 xl:col-span-2">
              <label className="text-sm font-medium text-ink" htmlFor={`${title}-source`}>
                Fonte
              </label>
              <input
                {...form.register("source")}
                id={`${title}-source`}
                placeholder="manual, anbima, vendor, broker"
                className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-lg border border-border px-3 py-3 text-sm text-ink">
            <input
              {...form.register("is_validated")}
              type="checkbox"
              className="h-4 w-4 rounded border-border"
            />
            <span>Registrar como preco validado</span>
          </label>

          {renderFormErrors(form.formState.errors)}

          {assetOptions.length === 0 ? (
            <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-sm text-[#92400e]">
              Nenhum ativo da carteira ativa apareceu para precificacao ainda. Registre operacoes primeiro ou troque de carteira.
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting || assetOptions.length === 0}
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

export function PricingList() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(true);
  const [selectedPrice, setSelectedPrice] = useState<AssetPrice | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const { activePortfolio, activePortfolioId } = usePortfolioScope();
  const canWrite = user?.role === "admin" || user?.role === "manager" || user?.role === "analyst";
  const canDelete = user?.role === "admin" || user?.role === "manager";

  const createForm = useForm<PricingFormValues>({
    resolver: zodResolver(pricingFormSchema),
    defaultValues: getDefaultPricingValues(),
  });
  const editForm = useForm<PricingFormValues>({
    resolver: zodResolver(pricingFormSchema),
    defaultValues: getDefaultPricingValues(),
  });

  const pricingQuery = useQuery({
    queryKey: ["pricing", activePortfolioId],
    queryFn: () => fetchAssetPrices({ portfolioId: activePortfolioId }),
  });
  const assetsQuery = useQuery({
    queryKey: ["pricing", "assets", activePortfolioId],
    queryFn: () => fetchAssets({ portfolioId: activePortfolioId }),
    enabled: canWrite,
  });

  useEffect(() => {
    if (!selectedPrice) {
      editForm.reset(getDefaultPricingValues());
      return;
    }

    editForm.reset(mapPriceToFormValues(selectedPrice));
  }, [editForm, selectedPrice]);

  async function refreshPricingQueries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["pricing"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["positions"] }),
      queryClient.invalidateQueries({ queryKey: ["reports"] }),
    ]);
  }

  const createMutation = useMutation({
    mutationFn: createAssetPrice,
    onSuccess: async () => {
      setFeedbackTone("success");
      setFeedbackMessage("Preco registrado com sucesso.");
      createForm.reset(getDefaultPricingValues());
      await refreshPricingQueries();
    },
    onError: (error) => {
      setFeedbackTone("error");
      setFeedbackMessage(getErrorMessage(error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ priceId, payload }: { priceId: string; payload: Parameters<typeof updateAssetPrice>[1] }) =>
      updateAssetPrice(priceId, payload),
    onSuccess: async (price) => {
      setFeedbackTone("success");
      setFeedbackMessage("Preco atualizado com sucesso.");
      setSelectedPrice(price);
      editForm.reset(mapPriceToFormValues(price));
      await refreshPricingQueries();
    },
    onError: (error) => {
      setFeedbackTone("error");
      setFeedbackMessage(getErrorMessage(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ priceId }: { priceId: string }) => deleteAssetPrice(priceId),
    onSuccess: async (_data, variables) => {
      setFeedbackTone("success");
      setFeedbackMessage("Preco excluido com sucesso.");
      setSelectedPrice((current) => (current?.id === variables.priceId ? null : current));
      await refreshPricingQueries();
    },
    onError: (error) => {
      setFeedbackTone("error");
      setFeedbackMessage(getErrorMessage(error));
    },
    onSettled: (_data, _error, variables) => {
      setPendingDeleteId((current) => (current === variables.priceId ? null : current));
    },
  });

  const filteredData = useMemo(() => {
    if (!pricingQuery.data) {
      return [];
    }

    const normalized = query.toLowerCase();
    if (!normalized) {
      return pricingQuery.data;
    }

    return pricingQuery.data.filter(
      (price) =>
        price.asset.ticker.toLowerCase().includes(normalized) ||
        price.asset.name.toLowerCase().includes(normalized) ||
        price.source.toLowerCase().includes(normalized),
    );
  }, [pricingQuery.data, query]);

  const columns = useMemo(
    () =>
      getPricingColumns({
        canWrite,
        canDelete,
        selectedPriceId: selectedPrice?.id ?? null,
        pendingDeleteId,
        onSelectPrice: (price) => {
          setSelectedPrice(price);
          setFeedbackMessage(null);
        },
        onDeletePrice: (price) => {
          const confirmed = window.confirm(
            `Excluir permanentemente o preco de ${price.asset.ticker} em ${price.price_date}?`,
          );
          if (!confirmed) {
            return;
          }
          setPendingDeleteId(price.id);
          void deleteMutation.mutateAsync({ priceId: price.id });
        },
      }),
    [canDelete, canWrite, deleteMutation, pendingDeleteId, selectedPrice?.id],
  );

  return (
    <section className="space-y-8">
      <PageHeader
        title="Precos"
        description={
          activePortfolio
            ? `Historico de precos dos ativos ligados a ${activePortfolio.name}.`
            : "Historico de precos dos ativos da carteira selecionada."
        }
      />

      {canWrite ? (
        <div className="space-y-5">
          <div className="rounded-lg border border-border bg-surface shadow-panel">
            <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-accentSoft p-2 text-accent">
                  <Tags className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-base font-semibold text-ink">Novo preco</div>
                  <div className="text-sm text-muted">
                    Cadastre uma nova observacao de preco para os ativos atualmente relevantes na carteira ativa.
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
                <PricingFormCard
                  title="Registrar preco"
                  description="Adicione uma observacao nova de preco para os ativos relevantes da carteira ativa."
                  icon={<Tags className="h-5 w-5" />}
                  form={createForm}
                  activePortfolioName={activePortfolio?.name ?? null}
                  assetOptions={assetsQuery.data ?? []}
                  isSubmitting={createMutation.isPending}
                  submitLabel="Registrar preco"
                  submitPendingLabel="Registrando"
                  showHeader={false}
                  onSubmit={async (values) => {
                    setFeedbackMessage(null);
                    await createMutation.mutateAsync(values);
                  }}
                />
              </div>
            ) : null}
          </div>

          {selectedPrice ? (
            <PricingFormCard
              title="Editar preco"
              description={`Revise a marcacao de ${selectedPrice.asset.ticker} mantendo o contexto da carteira ativa.`}
              icon={<PencilLine className="h-5 w-5" />}
              form={editForm}
              activePortfolioName={activePortfolio?.name ?? null}
              assetOptions={assetsQuery.data ?? []}
              isSubmitting={updateMutation.isPending}
              submitLabel="Salvar alteracoes"
              submitPendingLabel="Salvando"
              onClose={() => setSelectedPrice(null)}
              onSubmit={async (values) => {
                if (!selectedPrice) {
                  return;
                }

                setFeedbackMessage(null);
                await updateMutation.mutateAsync({
                  priceId: selectedPrice.id,
                  payload: values,
                });
              }}
            />
          ) : null}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-[#f7f7f4] px-4 py-4 text-sm text-muted">
          Seu perfil esta em modo leitura. Para alterar precos, use uma conta com perfil `analyst`, `manager` ou `admin`.
        </div>
      )}

      {feedbackMessage ? <div className={feedbackToneClasses[feedbackTone]}>{feedbackMessage}</div> : null}

      <SearchToolbar placeholder="Buscar por ativo ou fonte" onSearch={setQuery} />

      {pricingQuery.isLoading ? (
        <EmptyState title="Carregando precos" description="Consultando a base de precificacao da carteira ativa." />
      ) : pricingQuery.isError ? (
        <EmptyState
          title="Nao foi possivel carregar os precos"
          description="Valide a autenticacao e se a carteira selecionada continua acessivel."
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredData}
          emptyMessage="Nenhum preco encontrado para a carteira ativa."
        />
      )}
    </section>
  );
}
