"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, LoaderCircle, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { PageHeader } from "@/components/page-header";
import { getApiErrorMessage, useAuth } from "@/features/auth/auth-provider";
import { ApiError } from "@/lib/api/client";
import { changeOwnPassword, updateOwnProfile } from "@/lib/api/entities";

const profileSchema = z.object({
  full_name: z.string().min(3, "Informe um nome com pelo menos 3 caracteres."),
  email: z.string().email("Informe um email valido."),
});

const passwordSchema = z
  .object({
    current_password: z.string().min(8, "A senha atual precisa ter ao menos 8 caracteres."),
    new_password: z.string().min(8, "A nova senha precisa ter ao menos 8 caracteres."),
    confirm_password: z.string().min(8, "Confirme a nova senha com pelo menos 8 caracteres."),
  })
  .refine((values) => values.new_password === values.confirm_password, {
    message: "A confirmacao precisa ser igual a nova senha.",
    path: ["confirm_password"],
  });

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;
type FeedbackTone = "success" | "error";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.detail ?? "Nao foi possivel concluir a operacao.";
  }
  return getApiErrorMessage(error);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function FeedbackMessage({
  message,
  tone,
}: {
  message: string | null;
  tone: FeedbackTone;
}) {
  if (!message) {
    return null;
  }

  return (
    <div
      className={
        tone === "error"
          ? "rounded-lg border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-sm text-[#b91c1c]"
          : "rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm text-[#166534]"
      }
    >
      {message}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-[#b91c1c]">{message}</p>;
}

export function ProfileSettings() {
  const { updateCurrentUser, user: currentUser } = useAuth();
  const [profileFeedback, setProfileFeedback] = useState<string | null>(null);
  const [profileFeedbackTone, setProfileFeedbackTone] = useState<FeedbackTone>("success");
  const [passwordFeedback, setPasswordFeedback] = useState<string | null>(null);
  const [passwordFeedbackTone, setPasswordFeedbackTone] = useState<FeedbackTone>("success");

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: currentUser?.full_name ?? "",
      email: currentUser?.email ?? "",
    },
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
  });

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    profileForm.reset({
      full_name: currentUser.full_name,
      email: currentUser.email,
    });
  }, [currentUser, profileForm]);

  const profileMutation = useMutation({
    mutationFn: updateOwnProfile,
    onSuccess: (updatedUser) => {
      updateCurrentUser(updatedUser);
      setProfileFeedbackTone("success");
      setProfileFeedback("Perfil atualizado com sucesso.");
      profileForm.reset({
        full_name: updatedUser.full_name,
        email: updatedUser.email,
      });
    },
    onError: (error) => {
      setProfileFeedbackTone("error");
      setProfileFeedback(getErrorMessage(error));
    },
  });

  const passwordMutation = useMutation({
    mutationFn: changeOwnPassword,
    onSuccess: () => {
      setPasswordFeedbackTone("success");
      setPasswordFeedback("Senha atualizada com sucesso.");
      passwordForm.reset({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
    },
    onError: (error) => {
      setPasswordFeedbackTone("error");
      setPasswordFeedback(getErrorMessage(error));
    },
  });

  if (!currentUser) {
    return null;
  }

  return (
    <section className="space-y-8">
      <PageHeader
        title="Minha conta"
        description="Mantenha seus dados de acesso atualizados e troque sua senha sem depender da tela administrativa."
      />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-5">
          <div className="rounded-lg border border-border bg-surface p-5 shadow-panel">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-lg bg-accentSoft p-2 text-accent">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <div className="text-base font-semibold text-ink">Resumo da conta</div>
                <div className="text-sm text-muted">Visao rapida do acesso autenticado nesta sessao.</div>
              </div>
            </div>

            <div className="space-y-4 text-sm">
              <div className="rounded-lg border border-border px-4 py-3">
                <div className="text-muted">Nome</div>
                <div className="mt-1 font-medium text-ink">{currentUser.full_name}</div>
              </div>
              <div className="rounded-lg border border-border px-4 py-3">
                <div className="text-muted">Email</div>
                <div className="mt-1 font-medium text-ink">{currentUser.email}</div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-lg border border-border px-4 py-3">
                  <div className="text-muted">Perfil</div>
                  <div className="mt-1 font-medium capitalize text-ink">{currentUser.role}</div>
                </div>
                <div className="rounded-lg border border-border px-4 py-3">
                  <div className="text-muted">Status</div>
                  <div className="mt-1 font-medium text-ink">
                    {currentUser.is_active ? "Conta ativa" : "Conta inativa"}
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-border px-4 py-3">
                <div className="text-muted">Criado em</div>
                <div className="mt-1 font-medium text-ink">{formatDateTime(currentUser.created_at)}</div>
              </div>
              <div className="rounded-lg border border-border px-4 py-3">
                <div className="text-muted">Ultima atualizacao</div>
                <div className="mt-1 font-medium text-ink">{formatDateTime(currentUser.updated_at)}</div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-5 shadow-panel">
            <div className="mb-3 flex items-center gap-3">
              <div className="rounded-lg bg-accentSoft p-2 text-accent">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="text-base font-semibold text-ink">Escopo desta tela</div>
            </div>
            <p className="text-sm leading-6 text-muted">
              Esta area serve para manutencao do proprio cadastro. Perfil de acesso, ativacao da conta e
              privilegios administrativos continuam protegidos pela tela de usuarios.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-lg border border-border bg-surface p-5 shadow-panel">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-lg bg-accentSoft p-2 text-accent">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <div className="text-base font-semibold text-ink">Dados do perfil</div>
                <div className="text-sm text-muted">Atualize nome e email usados na sua conta.</div>
              </div>
            </div>

            <FeedbackMessage message={profileFeedback} tone={profileFeedbackTone} />

            <form
              className="mt-4 space-y-4"
              onSubmit={profileForm.handleSubmit(async (values) => {
                setProfileFeedback(null);
                await profileMutation.mutateAsync(values);
              })}
            >
              <div className="space-y-2">
                <label className="text-sm font-medium text-ink" htmlFor="profile-full-name">
                  Nome completo
                </label>
                <input
                  {...profileForm.register("full_name")}
                  id="profile-full-name"
                  className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none transition focus:border-accent"
                />
                <FieldError message={profileForm.formState.errors.full_name?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-ink" htmlFor="profile-email">
                  Email
                </label>
                <input
                  {...profileForm.register("email")}
                  id="profile-email"
                  type="email"
                  className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none transition focus:border-accent"
                />
                <FieldError message={profileForm.formState.errors.email?.message} />
              </div>

              <button
                type="submit"
                disabled={profileMutation.isPending}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:bg-[#115e59] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {profileMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                <span>{profileMutation.isPending ? "Salvando" : "Salvar perfil"}</span>
              </button>
            </form>
          </div>

          <div className="rounded-lg border border-border bg-surface p-5 shadow-panel">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-lg bg-accentSoft p-2 text-accent">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <div className="text-base font-semibold text-ink">Troca de senha</div>
                <div className="text-sm text-muted">
                  Confirme a senha atual antes de registrar uma nova credencial.
                </div>
              </div>
            </div>

            <FeedbackMessage message={passwordFeedback} tone={passwordFeedbackTone} />

            <form
              className="mt-4 space-y-4"
              onSubmit={passwordForm.handleSubmit(async (values) => {
                setPasswordFeedback(null);
                await passwordMutation.mutateAsync({
                  current_password: values.current_password,
                  new_password: values.new_password,
                });
              })}
            >
              <div className="space-y-2">
                <label className="text-sm font-medium text-ink" htmlFor="current-password">
                  Senha atual
                </label>
                <input
                  {...passwordForm.register("current_password")}
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none transition focus:border-accent"
                />
                <FieldError message={passwordForm.formState.errors.current_password?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-ink" htmlFor="new-password">
                  Nova senha
                </label>
                <input
                  {...passwordForm.register("new_password")}
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none transition focus:border-accent"
                />
                <FieldError message={passwordForm.formState.errors.new_password?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-ink" htmlFor="confirm-password">
                  Confirmar nova senha
                </label>
                <input
                  {...passwordForm.register("confirm_password")}
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none transition focus:border-accent"
                />
                <FieldError message={passwordForm.formState.errors.confirm_password?.message} />
              </div>

              <button
                type="submit"
                disabled={passwordMutation.isPending}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:bg-[#115e59] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {passwordMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                <span>{passwordMutation.isPending ? "Atualizando" : "Atualizar senha"}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
