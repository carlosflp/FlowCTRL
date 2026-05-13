"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, ShieldAlert, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SearchToolbar } from "@/components/search-toolbar";
import { useAuth } from "@/features/auth/auth-provider";
import { ApiError } from "@/lib/api/client";
import { createUser, fetchUsers, updateUser } from "@/lib/api/entities";
import type { User } from "@/types/domain";

import { getUserColumns } from "./columns";

const roleOptions = ["admin", "manager", "analyst", "viewer"] as const;

const createUserSchema = z.object({
  full_name: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(roleOptions),
  is_active: z.boolean(),
});

const updateUserSchema = z.object({
  full_name: z.string().min(3),
  email: z.string().email(),
  password: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : undefined)),
  role: z.enum(roleOptions),
  is_active: z.boolean(),
});

type CreateUserValues = z.infer<typeof createUserSchema>;
type UpdateUserValues = z.infer<typeof updateUserSchema>;

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.detail ?? "Nao foi possivel concluir a operacao.";
  }
  return "Nao foi possivel concluir a operacao.";
}

export function UserAdmin() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [query, setQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
    enabled: currentUser?.role === "admin",
  });

  const createForm = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
      role: "viewer",
      is_active: true,
    },
  });
  const updateForm = useForm<UpdateUserValues>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      full_name: "",
      email: "",
      password: undefined,
      role: "viewer",
      is_active: true,
    },
  });

  const selectedUser = useMemo(
    () => usersQuery.data?.find((item) => item.id === selectedUserId) ?? null,
    [selectedUserId, usersQuery.data],
  );
  const filteredUsers = useMemo(() => {
    if (!usersQuery.data) {
      return [];
    }

    const normalized = query.toLowerCase();
    if (!normalized) {
      return usersQuery.data;
    }

    return usersQuery.data.filter(
      (item) =>
        item.full_name.toLowerCase().includes(normalized) ||
        item.email.toLowerCase().includes(normalized) ||
        item.role.toLowerCase().includes(normalized),
    );
  }, [query, usersQuery.data]);
  const isSelectedCurrentUser = selectedUser?.id === currentUser?.id;

  useEffect(() => {
    if (!selectedUserId && usersQuery.data && usersQuery.data.length > 0) {
      setSelectedUserId(usersQuery.data[0].id);
    }
  }, [selectedUserId, usersQuery.data]);

  useEffect(() => {
    if (!selectedUser) {
      updateForm.reset({
        full_name: "",
        email: "",
        password: undefined,
        role: "viewer",
        is_active: true,
      });
      return;
    }

    updateForm.reset({
      full_name: selectedUser.full_name,
      email: selectedUser.email,
      password: undefined,
      role: selectedUser.role,
      is_active: selectedUser.is_active,
    });
  }, [selectedUser, updateForm]);

  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: async (createdUser) => {
      setFeedbackTone("success");
      setFeedbackMessage("Usuario criado com sucesso.");
      createForm.reset({
        full_name: "",
        email: "",
        password: "",
        role: "viewer",
        is_active: true,
      });
      setSelectedUserId(createdUser.id);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      setFeedbackTone("error");
      setFeedbackMessage(getErrorMessage(error));
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: Parameters<typeof updateUser>[1] }) =>
      updateUser(userId, payload),
    onSuccess: async (updatedUser) => {
      setFeedbackTone("success");
      setFeedbackMessage("Usuario atualizado com sucesso.");
      setSelectedUserId(updatedUser.id);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      setFeedbackTone("error");
      setFeedbackMessage(getErrorMessage(error));
    },
  });

  const metrics = {
    total: usersQuery.data?.length ?? 0,
    active: usersQuery.data?.filter((item) => item.is_active).length ?? 0,
    inactive: usersQuery.data?.filter((item) => !item.is_active).length ?? 0,
    admins: usersQuery.data?.filter((item) => item.role === "admin").length ?? 0,
  };

  if (currentUser?.role !== "admin") {
    return (
      <section className="space-y-8">
        <PageHeader
          title="Usuarios"
          description="Administracao de acesso interno, perfis operacionais e status de conta."
        />
        <EmptyState
          title="Acesso restrito"
          description="Apenas administradores podem gerenciar usuarios e perfis nesta etapa."
        />
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <PageHeader
        title="Usuarios"
        description="Gestao administrativa de contas internas, perfis de acesso e ativacao de usuarios da plataforma."
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-5 shadow-panel">
          <div className="text-sm text-muted">Usuarios</div>
          <div className="mt-2 text-3xl font-semibold text-ink">{metrics.total}</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5 shadow-panel">
          <div className="text-sm text-muted">Ativos</div>
          <div className="mt-2 text-3xl font-semibold text-ink">{metrics.active}</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5 shadow-panel">
          <div className="text-sm text-muted">Inativos</div>
          <div className="mt-2 text-3xl font-semibold text-ink">{metrics.inactive}</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5 shadow-panel">
          <div className="text-sm text-muted">Admins</div>
          <div className="mt-2 text-3xl font-semibold text-ink">{metrics.admins}</div>
        </div>
      </div>

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

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="space-y-5">
          <SearchToolbar placeholder="Buscar por nome, email ou perfil" onSearch={setQuery} />

          {usersQuery.isLoading ? (
            <EmptyState title="Carregando usuarios" description="Consultando as contas internas cadastradas." />
          ) : usersQuery.isError ? (
            <EmptyState
              title="Nao foi possivel carregar os usuarios"
              description="Confira a autenticacao e o backend antes de continuar."
            />
          ) : (
            <DataTable
              columns={getUserColumns({
                currentUserId: currentUser?.id ?? null,
                selectedUserId,
                onSelectUser: (user) => setSelectedUserId(user.id),
              })}
              data={filteredUsers}
              emptyMessage="Nenhum usuario encontrado."
            />
          )}
        </div>

        <div className="space-y-5">
          <div className="rounded-lg border border-border bg-surface p-5 shadow-panel">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-lg bg-accentSoft p-2 text-accent">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <div className="text-base font-semibold text-ink">Novo usuario</div>
                <div className="text-sm text-muted">Crie contas internas com perfil inicial definido.</div>
              </div>
            </div>

            <form
              className="space-y-4"
              onSubmit={createForm.handleSubmit(async (values) => {
                setFeedbackMessage(null);
                await createUserMutation.mutateAsync({
                  ...values,
                  is_superuser: values.role === "admin",
                });
              })}
            >
              <div className="space-y-2">
                <label className="text-sm font-medium text-ink" htmlFor="create-full-name">
                  Nome completo
                </label>
                <input
                  {...createForm.register("full_name")}
                  id="create-full-name"
                  className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none transition focus:border-accent"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-ink" htmlFor="create-email">
                  Email
                </label>
                <input
                  {...createForm.register("email")}
                  id="create-email"
                  type="email"
                  className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none transition focus:border-accent"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-ink" htmlFor="create-password">
                  Senha inicial
                </label>
                <input
                  {...createForm.register("password")}
                  id="create-password"
                  type="password"
                  className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none transition focus:border-accent"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-ink" htmlFor="create-role">
                  Perfil
                </label>
                <select
                  {...createForm.register("role")}
                  id="create-role"
                  className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none transition focus:border-accent"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-3 rounded-lg border border-border px-3 py-3 text-sm text-ink">
                <input {...createForm.register("is_active")} type="checkbox" className="h-4 w-4 rounded border-border" />
                <span>Usuario ativo desde a criacao</span>
              </label>

              <button
                type="submit"
                disabled={createUserMutation.isPending}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:bg-[#115e59] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {createUserMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                <span>{createUserMutation.isPending ? "Criando" : "Criar usuario"}</span>
              </button>
            </form>
          </div>

          <div className="rounded-lg border border-border bg-surface p-5 shadow-panel">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-lg bg-accentSoft p-2 text-accent">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <div className="text-base font-semibold text-ink">Edicao administrativa</div>
                <div className="text-sm text-muted">Revise perfil, email, senha e status do usuario selecionado.</div>
              </div>
            </div>

            {!selectedUser ? (
              <EmptyState
                title="Nenhum usuario selecionado"
                description="Escolha uma linha da tabela para editar um usuario."
              />
            ) : (
              <form
                className="space-y-4"
                onSubmit={updateForm.handleSubmit(async (values) => {
                  if (isSelectedCurrentUser) {
                    setFeedbackTone("error");
                    setFeedbackMessage("O usuario atual fica protegido nesta tela para evitar bloqueio acidental.");
                    return;
                  }

                  setFeedbackMessage(null);
                  await updateUserMutation.mutateAsync({
                    userId: selectedUser.id,
                    payload: {
                      full_name: values.full_name,
                      email: values.email,
                      password: values.password,
                      role: values.role,
                      is_active: values.is_active,
                      is_superuser: values.role === "admin",
                    },
                  });
                })}
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium text-ink" htmlFor="edit-full-name">
                    Nome completo
                  </label>
                  <input
                    {...updateForm.register("full_name")}
                    id="edit-full-name"
                    disabled={isSelectedCurrentUser}
                    className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none transition focus:border-accent disabled:bg-[#f7f7f4] disabled:text-muted"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-ink" htmlFor="edit-email">
                    Email
                  </label>
                  <input
                    {...updateForm.register("email")}
                    id="edit-email"
                    type="email"
                    disabled={isSelectedCurrentUser}
                    className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none transition focus:border-accent disabled:bg-[#f7f7f4] disabled:text-muted"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-ink" htmlFor="edit-password">
                    Nova senha
                  </label>
                  <input
                    {...updateForm.register("password")}
                    id="edit-password"
                    type="password"
                    disabled={isSelectedCurrentUser}
                    placeholder="Preencha apenas para redefinir"
                    className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none transition focus:border-accent disabled:bg-[#f7f7f4] disabled:text-muted"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-ink" htmlFor="edit-role">
                    Perfil
                  </label>
                  <select
                    {...updateForm.register("role")}
                    id="edit-role"
                    disabled={isSelectedCurrentUser}
                    className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none transition focus:border-accent disabled:bg-[#f7f7f4] disabled:text-muted"
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-3 rounded-lg border border-border px-3 py-3 text-sm text-ink">
                  <input
                    {...updateForm.register("is_active")}
                    type="checkbox"
                    disabled={isSelectedCurrentUser}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span>Usuario ativo</span>
                </label>

                {isSelectedCurrentUser ? (
                  <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-3 text-sm text-[#92400e]">
                    O usuario autenticado fica protegido nesta tela para evitar perda acidental de acesso administrativo.
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={updateUserMutation.isPending || isSelectedCurrentUser}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:bg-[#115e59] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {updateUserMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  <span>{updateUserMutation.isPending ? "Salvando" : "Salvar alteracoes"}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
