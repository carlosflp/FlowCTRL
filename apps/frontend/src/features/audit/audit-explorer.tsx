"use client";

import { useQuery } from "@tanstack/react-query";
import { Filter, LoaderCircle, RefreshCw, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { useAuth } from "@/features/auth/auth-provider";
import { fetchAuditLogs, fetchUsers } from "@/lib/api/entities";
import type { AuditLog } from "@/types/domain";

import { getAuditColumns } from "./columns";

const entityOptions = [
  { value: "", label: "Todos os dominios" },
  { value: "operation", label: "Operacoes" },
  { value: "cashflow_entry", label: "Caixa" },
  { value: "asset_price", label: "Precos" },
  { value: "user", label: "Usuarios" },
  { value: "report_template", label: "Templates" },
  { value: "report_execution", label: "Execucoes" },
] as const;

const actionOptions = [
  { value: "", label: "Todas as acoes" },
  { value: "created", label: "Criacao" },
  { value: "updated", label: "Atualizacao" },
  { value: "deleted", label: "Exclusao" },
] as const;

type AuditFilterState = {
  search: string;
  entityType: string;
  action: "" | "created" | "updated" | "deleted";
  userId: string;
  dateFrom: string;
  dateTo: string;
};

const defaultFilters: AuditFilterState = {
  search: "",
  entityType: "",
  action: "",
  userId: "",
  dateFrom: "",
  dateTo: "",
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatJsonSnapshot(value: AuditLog["old_value_json"]): string {
  return JSON.stringify(value, null, 2);
}

function DetailSnapshot({
  title,
  value,
}: {
  title: string;
  value: AuditLog["old_value_json"];
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-[#fbfaf8] p-4">
      <div className="text-sm font-semibold text-ink">{title}</div>
      {value === null ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted">
          Sem snapshot registrado.
        </div>
      ) : (
        <pre className="overflow-x-auto rounded-lg bg-[#111827] p-4 text-xs leading-6 text-[#e5e7eb]">
          {formatJsonSnapshot(value)}
        </pre>
      )}
    </div>
  );
}

export function AuditExplorer() {
  const { user: currentUser } = useAuth();
  const [draftFilters, setDraftFilters] = useState<AuditFilterState>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<AuditFilterState>(defaultFilters);
  const [selectedAuditLogId, setSelectedAuditLogId] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
    enabled: currentUser?.role === "admin",
  });

  const auditLogsQuery = useQuery({
    queryKey: ["audit", appliedFilters],
    queryFn: () =>
      fetchAuditLogs({
        search: appliedFilters.search || null,
        entityType: appliedFilters.entityType || null,
        action: appliedFilters.action || null,
        userId: appliedFilters.userId || null,
        dateFrom: appliedFilters.dateFrom || null,
        dateTo: appliedFilters.dateTo || null,
        limit: 150,
      }),
    enabled: currentUser?.role === "admin",
  });

  const selectedAuditLog = useMemo(
    () => auditLogsQuery.data?.find((item) => item.id === selectedAuditLogId) ?? null,
    [auditLogsQuery.data, selectedAuditLogId],
  );

  useEffect(() => {
    if (!auditLogsQuery.data || auditLogsQuery.data.length === 0) {
      setSelectedAuditLogId(null);
      return;
    }

    if (!selectedAuditLogId || !auditLogsQuery.data.some((item) => item.id === selectedAuditLogId)) {
      setSelectedAuditLogId(auditLogsQuery.data[0].id);
    }
  }, [auditLogsQuery.data, selectedAuditLogId]);

  const metrics = {
    total: auditLogsQuery.data?.length ?? 0,
    created: auditLogsQuery.data?.filter((item) => item.action === "created").length ?? 0,
    updated: auditLogsQuery.data?.filter((item) => item.action === "updated").length ?? 0,
    deleted: auditLogsQuery.data?.filter((item) => item.action === "deleted").length ?? 0,
  };

  if (currentUser?.role !== "admin") {
    return (
      <section className="space-y-8">
        <PageHeader
          title="Auditoria"
          description="Trilha administrativa de alteracoes persistidas, atores autenticados e snapshots before/after."
        />
        <EmptyState
          title="Acesso restrito"
          description="Apenas administradores podem consultar a trilha completa de auditoria nesta etapa."
        />
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <PageHeader
        title="Auditoria"
        description="Consulta administrativa dos eventos persistidos na plataforma, com filtros por dominio, ator, acao e periodo."
        actions={
          <button
            type="button"
            onClick={() => void auditLogsQuery.refetch()}
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium text-ink transition hover:bg-[#f0efeb]"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Atualizar</span>
          </button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-5 shadow-panel">
          <div className="text-sm text-muted">Eventos carregados</div>
          <div className="mt-2 text-3xl font-semibold text-ink">{metrics.total}</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5 shadow-panel">
          <div className="text-sm text-muted">Criacoes</div>
          <div className="mt-2 text-3xl font-semibold text-ink">{metrics.created}</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5 shadow-panel">
          <div className="text-sm text-muted">Atualizacoes</div>
          <div className="mt-2 text-3xl font-semibold text-ink">{metrics.updated}</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5 shadow-panel">
          <div className="text-sm text-muted">Exclusoes</div>
          <div className="mt-2 text-3xl font-semibold text-ink">{metrics.deleted}</div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5 shadow-panel">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-lg bg-accentSoft p-2 text-accent">
            <Filter className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-semibold text-ink">Filtros da trilha</div>
            <div className="text-sm text-muted">
              Refine a leitura por dominio, acao, ator, periodo e texto livre.
            </div>
          </div>
        </div>

        <form
          className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            setAppliedFilters(draftFilters);
          }}
        >
          <div className="space-y-2 xl:col-span-3">
            <label className="text-sm font-medium text-ink" htmlFor="audit-search">
              Busca livre
            </label>
            <input
              id="audit-search"
              value={draftFilters.search}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              placeholder="Entity id, nome do ator, email ou dominio"
              className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none transition focus:border-accent"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-ink" htmlFor="audit-entity-type">
              Dominio
            </label>
            <select
              id="audit-entity-type"
              value={draftFilters.entityType}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  entityType: event.target.value,
                }))
              }
              className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none transition focus:border-accent"
            >
              {entityOptions.map((option) => (
                <option key={option.value || "all-entities"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-ink" htmlFor="audit-action">
              Acao
            </label>
            <select
              id="audit-action"
              value={draftFilters.action}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  action: event.target.value as AuditFilterState["action"],
                }))
              }
              className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none transition focus:border-accent"
            >
              {actionOptions.map((option) => (
                <option key={option.value || "all-actions"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-ink" htmlFor="audit-user">
              Ator
            </label>
            <select
              id="audit-user"
              value={draftFilters.userId}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  userId: event.target.value,
                }))
              }
              className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none transition focus:border-accent"
            >
              <option value="">Todos os atores</option>
              {usersQuery.data?.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name} ({user.role})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-ink" htmlFor="audit-date-from">
              Data inicial
            </label>
            <input
              id="audit-date-from"
              type="date"
              value={draftFilters.dateFrom}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  dateFrom: event.target.value,
                }))
              }
              className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none transition focus:border-accent"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-ink" htmlFor="audit-date-to">
              Data final
            </label>
            <input
              id="audit-date-to"
              type="date"
              value={draftFilters.dateTo}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  dateTo: event.target.value,
                }))
              }
              className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none transition focus:border-accent"
            />
          </div>

          <div className="flex flex-wrap items-end gap-3 xl:col-span-3">
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:bg-[#115e59]"
            >
              Aplicar filtros
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftFilters(defaultFilters);
                setAppliedFilters(defaultFilters);
              }}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-ink transition hover:bg-[#f0efeb]"
            >
              Limpar
            </button>
          </div>
        </form>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          {auditLogsQuery.isLoading ? (
            <EmptyState title="Carregando auditoria" description="Consultando os eventos persistidos na plataforma." />
          ) : auditLogsQuery.isError ? (
            <EmptyState
              title="Nao foi possivel carregar a trilha"
              description="Confira a sessao administrativa e o backend antes de continuar."
            />
          ) : (
            <DataTable
              columns={getAuditColumns({
                selectedAuditLogId,
                onSelectAuditLog: (auditLog) => setSelectedAuditLogId(auditLog.id),
              })}
              data={auditLogsQuery.data ?? []}
              emptyMessage="Nenhum evento encontrado para os filtros informados."
            />
          )}
        </div>

        <div className="space-y-5">
          <div className="rounded-lg border border-border bg-surface p-5 shadow-panel">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-lg bg-accentSoft p-2 text-accent">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <div className="text-base font-semibold text-ink">Detalhe do evento</div>
                <div className="text-sm text-muted">Leia contexto, ator autenticado e snapshots persistidos.</div>
              </div>
            </div>

            {!selectedAuditLog ? (
              <EmptyState
                title="Nenhum evento selecionado"
                description="Escolha uma linha da tabela para analisar o snapshot before/after."
              />
            ) : (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-border bg-[#fbfaf8] p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">Dominio</div>
                    <div className="mt-2 text-sm font-medium text-ink">{selectedAuditLog.entity_type}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-[#fbfaf8] p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">Acao</div>
                    <div className="mt-2">
                      <StatusBadge value={selectedAuditLog.action} />
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-[#fbfaf8] p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">Registro</div>
                    <div className="mt-2 break-all text-sm font-medium text-ink">{selectedAuditLog.entity_id}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-[#fbfaf8] p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">Quando</div>
                    <div className="mt-2 text-sm font-medium text-ink">{formatDateTime(selectedAuditLog.created_at)}</div>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-[#fbfaf8] p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">Ator</div>
                  <div className="mt-2 text-sm font-medium text-ink">
                    {selectedAuditLog.user?.full_name ?? "Sistema"}
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    {selectedAuditLog.user
                      ? `${selectedAuditLog.user.email} | ${selectedAuditLog.user.role}`
                      : "Evento sem usuario autenticado associado."}
                  </div>
                </div>

                <DetailSnapshot title="Estado anterior" value={selectedAuditLog.old_value_json} />
                <DetailSnapshot title="Estado posterior" value={selectedAuditLog.new_value_json} />
              </div>
            )}
          </div>
        </div>
      </div>

      {auditLogsQuery.isFetching ? (
        <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted shadow-panel">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          <span>Atualizando trilha...</span>
        </div>
      ) : null}
    </section>
  );
}
