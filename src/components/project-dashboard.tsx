"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ProjectStatus = "PLANNING" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELED";
type ProjectMilestoneStatus = "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED";

type ProjectMilestone = {
  id: string;
  title: string;
  deadline: string | null;
  status: ProjectMilestoneStatus;
};

type Project = {
  id: string;
  customer: { name: string } | null;
  name: string;
  deadline: string | null;
  status: ProjectStatus;
  progress: number;
  milestones: ProjectMilestone[];
};

const projectStatusLabels: Record<ProjectStatus, string> = {
  PLANNING: "Pianificazione",
  IN_PROGRESS: "In corso",
  ON_HOLD: "In pausa",
  COMPLETED: "Completato",
  CANCELED: "Cancellato",
};

const milestoneStatusLabels: Record<ProjectMilestoneStatus, string> = {
  TODO: "Da fare",
  IN_PROGRESS: "In corso",
  DONE: "Completato",
  BLOCKED: "Bloccato",
};

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("it-IT");
}

export function ProjectDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProjects() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/projects", { cache: "no-store" });
        if (!response.ok) {
          throw new Error();
        }

        const payload = (await response.json()) as Project[];
        setProjects(payload);
      } catch {
        setError("Impossibile caricare la dashboard progetti");
      } finally {
        setLoading(false);
      }
    }

    void fetchProjects();
  }, []);

  const metrics = useMemo(() => {
    const now = new Date();
    const in14 = new Date();
    in14.setDate(in14.getDate() + 14);

    const active = projects.filter(
      (project) => project.status === "PLANNING" || project.status === "IN_PROGRESS" || project.status === "ON_HOLD",
    );

    const overdue = active.filter((project) => project.deadline && new Date(project.deadline) < now).length;
    const soon = active.filter(
      (project) => project.deadline && new Date(project.deadline) >= now && new Date(project.deadline) <= in14,
    ).length;

    return {
      total: projects.length,
      active: active.length,
      completed: projects.filter((project) => project.status === "COMPLETED").length,
      overdue,
      soon,
    };
  }, [projects]);

  const upcomingMilestones = useMemo(() => {
    return projects
      .flatMap((project) =>
        project.milestones
          .filter((milestone) => milestone.deadline)
          .map((milestone) => ({
            projectName: project.name,
            title: milestone.title,
            deadline: milestone.deadline!,
            status: milestone.status,
          })),
      )
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      .slice(0, 12);
  }, [projects]);

  return (
    <main className="min-h-screen bg-white p-6 text-zinc-900 md:p-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Dashboard Progetti</h1>
            <p className="text-sm text-zinc-600">Monitoraggio avanzamento, milestone e scadenze</p>
          </div>
          <Link
            href="/progetti"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-100"
          >
            Apri gestione progetti
          </Link>
        </header>

        {error && (
          <p className="rounded-md border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm text-zinc-800">
            {error}
          </p>
        )}

        {loading && <p className="text-sm text-zinc-500">Caricamento dati...</p>}

        {!loading && (
          <>
            <section className="grid gap-4 md:grid-cols-5">
              <MetricCard title="Totale progetti" value={String(metrics.total)} />
              <MetricCard title="Progetti attivi" value={String(metrics.active)} />
              <MetricCard title="Completati" value={String(metrics.completed)} />
              <MetricCard title="In ritardo" value={String(metrics.overdue)} />
              <MetricCard title="Scadenza 14 giorni" value={String(metrics.soon)} />
            </section>

            <section className="overflow-hidden rounded-lg border border-zinc-200">
              <div className="border-b border-zinc-200 bg-indigo-50 px-4 py-3 text-indigo-800">
                <h2 className="text-lg font-semibold">Stato progetti</h2>
              </div>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2">Progetto</th>
                    <th className="px-4 py-2">Cliente</th>
                    <th className="px-4 py-2">Deadline</th>
                    <th className="px-4 py-2">Stato</th>
                    <th className="px-4 py-2">Avanzamento</th>
                    <th className="px-4 py-2">Milestone</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project.id} className="border-t border-zinc-200">
                      <td className="px-4 py-2">{project.name}</td>
                      <td className="px-4 py-2">{project.customer?.name || "-"}</td>
                      <td className="px-4 py-2">{formatDate(project.deadline)}</td>
                      <td className="px-4 py-2">{projectStatusLabels[project.status]}</td>
                      <td className="px-4 py-2">{project.progress}%</td>
                      <td className="px-4 py-2">{project.milestones.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="overflow-hidden rounded-lg border border-zinc-200">
              <div className="border-b border-zinc-200 bg-amber-50 px-4 py-3 text-amber-800">
                <h2 className="text-lg font-semibold">Prossime milestone</h2>
              </div>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2">Progetto</th>
                    <th className="px-4 py-2">Milestone</th>
                    <th className="px-4 py-2">Deadline</th>
                    <th className="px-4 py-2">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingMilestones.map((milestone) => (
                    <tr key={`${milestone.projectName}-${milestone.title}-${milestone.deadline}`} className="border-t border-zinc-200">
                      <td className="px-4 py-2">{milestone.projectName}</td>
                      <td className="px-4 py-2">{milestone.title}</td>
                      <td className="px-4 py-2">{formatDate(milestone.deadline)}</td>
                      <td className="px-4 py-2">{milestoneStatusLabels[milestone.status]}</td>
                    </tr>
                  ))}
                  {upcomingMilestones.length === 0 && (
                    <tr className="border-t border-zinc-200">
                      <td className="px-4 py-2 text-zinc-500" colSpan={4}>
                        Nessuna milestone in scadenza.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </article>
  );
}
