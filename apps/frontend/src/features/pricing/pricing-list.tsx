"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, LoaderCircle, Tags } from "lucide-react";
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
  createAssetPrice,
  fetchAssetPrices,
  fetchAssets,
} from "@/lib/api/entities";

import { pricingColumns } from "./columns";

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

export function PricingList() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(true);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");
  const { activePortfolio, activePortfolioId } = usePortfolioScope();
  const canWrite = user?.role === "admin" || user?.role === "manager" || user?.role === "analyst";

  const form = useForm<PricingFormValues>({
    resolver: zodResolver(pricingFormSchema),
    defaultValues: {
      asset_id: "",
      price_date: getTodayDateString(),
      price: "",
      source: "manual",
      is_validated: true,
    },
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

  const createMutation = useMutation({
    mutationFn: createAssetPrice,
    onSuccess: async () => {
      setFeedbackTone("success");
      setFeedbackMessage("Preco registrado com sucesso.");
      form.reset({
        asset_id: "",
        price_date: getTodayDateString(),
        price: "",
        source: "manual",
        is_validated: true,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pricing"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["positions"] }),
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
      ]);
    },
    onError: (error) => {
      setFeedbackTone("error");
      setFeedbackMessage(getErrorMessage(error));
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
              <form
                className="space-y-5"
                onSubmit={form.handleSubmit(async (values) => {
                  setFeedbackMessage(null);
                  await createMutation.mutateAsync(values);
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
                    <label className="text-sm font-medium text-ink" htmlFor="pricing-asset">
                      Ativo
                    </label>
                    <select
                      {...form.register("asset_id")}
                      id="pricing-asset"
                      className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
                    >
                      <option value="">Selecione um ativo</option>
                      {(assetsQuery.data ?? []).map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.ticker} | {asset.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-ink" htmlFor="pricing-date">
                      Data do preco
                    </label>
                    <input
                      {...form.register("price_date")}
                      id="pricing-date"
                      type="date"
                      className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-ink" htmlFor="pricing-price">
                      Preco
                    </label>
                    <input
                      {...form.register("price")}
                      id="pricing-price"
                      inputMode="decimal"
                      placeholder="101.35"
                      className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none transition focus:border-accent"
                    />
                  </div>
                  <div className="space-y-2 xl:col-span-2">
                    <label className="text-sm font-medium text-ink" htmlFor="pricing-source">
                      Fonte
                    </label>
                    <input
                      {...form.register("source")}
                      id="pricing-source"
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
                  <span>Registrar ja como preco validado</span>
                </label>

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

                {assetsQuery.data && assetsQuery.data.length === 0 ? (
                  <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-sm text-[#92400e]">
                    Nenhum ativo da carteira ativa apareceu para precificacao ainda. Registre operacoes primeiro ou troque de carteira.
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={createMutation.isPending || (assetsQuery.data?.length ?? 0) === 0}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:bg-[#115e59] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {createMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  <span>{createMutation.isPending ? "Registrando" : "Registrar preco"}</span>
                </button>
              </form>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-[#f7f7f4] px-4 py-4 text-sm text-muted">
          Seu perfil esta em modo leitura. Para registrar precos, use uma conta com perfil `analyst`, `manager` ou `admin`.
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

      <SearchToolbar placeholder="Buscar por ativo ou fonte" onSearch={setQuery} />

      {pricingQuery.isLoading ? (
        <EmptyState title="Carregando precos" description="Consultando a base de precificacao da carteira ativa." />
      ) : pricingQuery.isError ? (
        <EmptyState
          title="Nao foi possivel carregar os precos"
          description="Valide a autenticacao e se a carteira selecionada continua acessivel."
        />
      ) : (
        <DataTable columns={pricingColumns} data={filteredData} emptyMessage="Nenhum preco encontrado para a carteira ativa." />
      )}
    </section>
  );
}
