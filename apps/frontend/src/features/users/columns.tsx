"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { StatusBadge } from "@/components/status-badge";
import type { User } from "@/types/domain";

function getRoleBadgeClasses(role: User["role"]): string {
  if (role === "admin") {
    return "bg-[#ccfbf1] text-[#0f766e]";
  }
  if (role === "manager") {
    return "bg-[#dbeafe] text-[#1d4ed8]";
  }
  if (role === "analyst") {
    return "bg-[#fef3c7] text-[#92400e]";
  }
  return "bg-[#f3f4f6] text-[#4b5563]";
}

type UserColumnsOptions = {
  currentUserId: string | null;
  selectedUserId: string | null;
  onSelectUser: (user: User) => void;
};

export function getUserColumns({
  currentUserId,
  selectedUserId,
  onSelectUser,
}: UserColumnsOptions): ColumnDef<User>[] {
  return [
    {
      accessorKey: "full_name",
      header: "Nome",
      cell: ({ row }) => {
        const isCurrentUser = row.original.id === currentUserId;

        return (
          <div>
            <div className="font-medium text-ink">{row.original.full_name}</div>
            <div className="text-xs text-muted">{isCurrentUser ? "usuario atual" : row.original.email}</div>
          </div>
        );
      },
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => row.original.email,
    },
    {
      accessorKey: "role",
      header: "Perfil",
      cell: ({ row }) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getRoleBadgeClasses(row.original.role)}`}
        >
          {row.original.role}
        </span>
      ),
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => <StatusBadge value={row.original.is_active} />,
    },
    {
      accessorKey: "created_at",
      header: "Criado em",
      cell: ({ row }) => row.original.created_at.slice(0, 10),
    },
    {
      id: "actions",
      header: "Acoes",
      cell: ({ row }) => {
        const isSelected = row.original.id === selectedUserId;

        return (
          <button
            type="button"
            onClick={() => onSelectUser(row.original)}
            className={
              isSelected
                ? "inline-flex items-center rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white"
                : "inline-flex items-center rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink transition hover:bg-[#f0efeb]"
            }
          >
            {isSelected ? "Selecionado" : "Editar"}
          </button>
        );
      },
    },
  ];
}
