import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { QueryProvider } from "@/lib/query-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "FlowCTRL | Asset Platform",
  description: "Plataforma operacional para gestão de carteiras e operações de uma asset financeira.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <QueryProvider>
          <AppShell>{children}</AppShell>
        </QueryProvider>
      </body>
    </html>
  );
}

