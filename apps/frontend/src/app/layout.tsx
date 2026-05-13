import type { Metadata } from "next";

import { RootProviders } from "@/components/root-providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "FlowCTRL | Asset Platform",
  description: "Operational platform for portfolio and investment operations management.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
