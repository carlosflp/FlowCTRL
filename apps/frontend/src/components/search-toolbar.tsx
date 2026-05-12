"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const searchSchema = z.object({
  query: z.string().max(100).default(""),
});

type SearchFormValues = z.infer<typeof searchSchema>;

type SearchToolbarProps = {
  placeholder: string;
  onSearch: (query: string) => void;
};

export function SearchToolbar({ placeholder, onSearch }: SearchToolbarProps) {
  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      query: "",
    },
  });

  return (
    <form
      className="mb-5 flex items-center gap-3"
      onSubmit={form.handleSubmit((values) => onSearch(values.query.trim()))}
    >
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          {...form.register("query")}
          type="search"
          placeholder={placeholder}
          className="h-11 w-full rounded-lg border border-border bg-surface pl-10 pr-4 text-sm text-ink outline-none transition focus:border-accent"
        />
      </div>
      <button
        type="submit"
        className="inline-flex h-11 items-center rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:bg-[#115e59]"
      >
        Filtrar
      </button>
    </form>
  );
}

