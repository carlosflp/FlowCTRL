import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  value: string | boolean;
  label?: string;
};

const statusStyles: Record<string, string> = {
  active: "bg-[#dcfce7] text-[#166534]",
  inactive: "bg-[#f3f4f6] text-[#4b5563]",
  created: "bg-[#dcfce7] text-[#166534]",
  updated: "bg-[#dbeafe] text-[#1d4ed8]",
  deleted: "bg-[#fee2e2] text-[#b91c1c]",
  draft: "bg-[#e5e7eb] text-[#374151]",
  pending_approval: "bg-[#fef3c7] text-[#92400e]",
  queued: "bg-[#fef3c7] text-[#92400e]",
  running: "bg-[#dbeafe] text-[#1d4ed8]",
  processing: "bg-[#dbeafe] text-[#1d4ed8]",
  approved: "bg-[#dbeafe] text-[#1d4ed8]",
  completed: "bg-[#dcfce7] text-[#166534]",
  completed_with_errors: "bg-[#fde68a] text-[#92400e]",
  failed: "bg-[#fee2e2] text-[#b91c1c]",
  settled: "bg-[#dcfce7] text-[#166534]",
  cancelled: "bg-[#fee2e2] text-[#b91c1c]",
  rejected: "bg-[#fee2e2] text-[#b91c1c]",
};

export function StatusBadge({ value, label }: StatusBadgeProps) {
  const normalizedValue = typeof value === "boolean" ? (value ? "active" : "inactive") : value;
  const classes = statusStyles[normalizedValue] ?? "bg-[#f3f4f6] text-[#374151]";

  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", classes)}>
      {label ?? normalizedValue.split("_").join(" ")}
    </span>
  );
}
