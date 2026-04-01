import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-50 to-white p-6 text-zinc-900 md:p-10">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="text-center">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Piattaforma Operativa</h1>
          <p className="mt-3 text-sm text-zinc-600 md:text-base">
            Seleziona l&apos;area di lavoro da aprire
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <Link
            href="/dashboard-servizi-abbonamenti"
            className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Accesso 1</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-900">Gestione Servizi &amp; Abbonamenti</h2>
            <p className="mt-3 text-sm text-zinc-600">
              Clienti, piani, rinnovi, fatture, costi, reminder e analisi economica.
            </p>
            <span className="mt-6 inline-block rounded-md bg-zinc-900 px-3 py-2 text-sm text-white">
              Apri dashboard
            </span>
          </Link>

          <Link
            href="/dashboard-progetti"
            className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Accesso 2</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-900">Dashboard Progetti</h2>
            <p className="mt-3 text-sm text-zinc-600">
              Stato avanzamento, milestone, scadenze e monitoraggio attività clienti.
            </p>
            <span className="mt-6 inline-block rounded-md bg-zinc-900 px-3 py-2 text-sm text-white">
              Apri dashboard
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}
