import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  value: string | boolean;
  label?: string;
};

const statusStyles: Record<string, string> = {
  active: "bg-[#dcfce7] text-[#166534]",
  inactive: "bg-[#f3f4f6] text-[#4b5563]",
  draft: "bg-[#e5e7eb] text-[#374151]",
  pending_approval: "bg-[#fef3c7] text-[#92400e]",
  approved: "bg-[#dbeafe] text-[#1d4ed8]",
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
