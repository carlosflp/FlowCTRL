import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export function ReportsPage() {
  return (
    <section>
      <PageHeader
        title="Relatórios"
        description="Área preparada para execução assíncrona de relatórios CSV, XLSX e PDF com persistência em MinIO."
      />

      <EmptyState
        title="Módulo de relatórios em preparação"
        description="A fundação já contempla template, execução, worker e storage local. O próximo passo é criar os fluxos de geração e download."
      />
    </section>
  );
}

