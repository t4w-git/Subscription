"use client";

import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";

type ProjectStatus = "PLANNING" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELED";
type ProjectMilestoneStatus = "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED";

type Customer = {
  id: string;
  name: string;
};

type Milestone = {
  id?: string;
  title: string;
  description: string | null;
  deadline: string | null;
  status: ProjectMilestoneStatus;
  position: number;
};

type Project = {
  id: string;
  customerId: string | null;
  customer: Customer | null;
  name: string;
  description: string | null;
  startDate: string | null;
  deadline: string | null;
  status: ProjectStatus;
  progress: number;
  milestones: Milestone[];
};

type MilestoneForm = {
  formKey: string;
  title: string;
  description: string;
  deadline: string;
  status: ProjectMilestoneStatus;
};

type ProjectForm = {
  customerId: string;
  name: string;
  description: string;
  startDate: string;
  deadline: string;
  status: ProjectStatus;
  progress: number;
  milestones: MilestoneForm[];
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

function createMilestoneForm(overrides?: Partial<Omit<MilestoneForm, "formKey">>): MilestoneForm {
  return {
    formKey: crypto.randomUUID(),
    title: overrides?.title || "",
    description: overrides?.description || "",
    deadline: overrides?.deadline || "",
    status: overrides?.status || "TODO",
  };
}

const kanbanStatuses: ProjectStatus[] = [
  "PLANNING",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "CANCELED",
];

function toDateInput(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("it-IT");
}

function mapProjectToForm(project: Project): ProjectForm {
  return {
    customerId: project.customerId || "",
    name: project.name,
    description: project.description || "",
    startDate: toDateInput(project.startDate),
    deadline: toDateInput(project.deadline),
    status: project.status,
    progress: project.progress,
    milestones:
      project.milestones.length > 0
        ? project.milestones
            .sort((a, b) => a.position - b.position)
            .map((milestone) => createMilestoneForm({
              title: milestone.title,
              description: milestone.description || "",
              deadline: toDateInput(milestone.deadline),
              status: milestone.status,
            }))
        : [createMilestoneForm()],
  };
}

function mapFormToPayload(form: ProjectForm) {
  return {
    customerId: form.customerId || null,
    name: form.name,
    description: form.description || "",
    startDate: form.startDate ? new Date(form.startDate).toISOString() : "",
    deadline: form.deadline ? new Date(form.deadline).toISOString() : "",
    status: form.status,
    progress: Number(form.progress),
    milestones: form.milestones
      .filter((milestone) => milestone.title.trim().length > 0)
      .map((milestone, index) => ({
        title: milestone.title,
        description: milestone.description || "",
        deadline: milestone.deadline ? new Date(milestone.deadline).toISOString() : "",
        status: milestone.status,
        position: index,
      })),
  };
}

export default function ProgettiPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCreateSection, setShowCreateSection] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(null);
  const [syncingReminders, setSyncingReminders] = useState(false);

  const [createForm, setCreateForm] = useState<ProjectForm>({
    customerId: "",
    name: "",
    description: "",
    startDate: "",
    deadline: "",
    status: "PLANNING",
    progress: 0,
    milestones: [createMilestoneForm()],
  });

  const [editForm, setEditForm] = useState<ProjectForm>({
    customerId: "",
    name: "",
    description: "",
    startDate: "",
    deadline: "",
    status: "PLANNING",
    progress: 0,
    milestones: [createMilestoneForm()],
  });

  const projectSummary = useMemo(() => {
    const inProgress = projects.filter((project) => project.status === "IN_PROGRESS").length;
    const overdue = projects.filter((project) => {
      if (!project.deadline || project.status === "COMPLETED" || project.status === "CANCELED") {
        return false;
      }

      return new Date(project.deadline) < new Date();
    }).length;

    return {
      total: projects.length,
      inProgress,
      overdue,
      completed: projects.filter((project) => project.status === "COMPLETED").length,
    };
  }, [projects]);

  const timelineProjects = useMemo(() => {
    return projects
      .filter((project) => project.startDate && project.deadline)
      .sort((a, b) => {
        const aTime = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;

        return aTime - bTime;
      })
      .slice(0, 12);
  }, [projects]);

  const upcomingMilestones = useMemo(() => {
    return projects
      .flatMap((project) =>
        project.milestones
          .filter((milestone) => milestone.deadline)
          .map((milestone) => ({
            projectId: project.id,
            projectName: project.name,
            milestoneTitle: milestone.title,
            milestoneStatus: milestone.status,
            deadline: milestone.deadline!,
          })),
      )
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      .slice(0, 14);
  }, [projects]);

  async function fetchProjectsAndCustomers() {
    setLoading(true);
    setError(null);

    try {
      const [projectsResponse, customersResponse] = await Promise.all([
        fetch("/api/projects", { cache: "no-store" }),
        fetch("/api/customers", { cache: "no-store" }),
      ]);

      if (!projectsResponse.ok || !customersResponse.ok) {
        throw new Error();
      }

      const projectsPayload = (await projectsResponse.json()) as Project[];
      const customersPayload = (await customersResponse.json()) as Customer[];
      setProjects(projectsPayload);
      setCustomers(customersPayload);
    } catch {
      setError("Impossibile caricare progetti e clienti");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchProjectsAndCustomers();
  }, []);

  function onStartEdit(project: Project) {
    setEditingProjectId(project.id);
    setEditForm(mapProjectToForm(project));
    setError(null);
    setNotice(null);
  }

  function onCancelEdit() {
    setEditingProjectId(null);
    setEditForm({
      customerId: "",
      name: "",
      description: "",
      startDate: "",
      deadline: "",
      status: "PLANNING",
      progress: 0,
      milestones: [createMilestoneForm()],
    });
  }

  async function onCreateProject(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mapFormToPayload(createForm)),
    });

    if (!response.ok) {
      const message = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(message?.error || "Errore inserimento progetto");
      return;
    }

    setCreateForm({
      customerId: "",
      name: "",
      description: "",
      startDate: "",
      deadline: "",
      status: "PLANNING",
      progress: 0,
      milestones: [createMilestoneForm()],
    });
    setShowCreateSection(false);
    setNotice("Progetto inserito con successo");
    await fetchProjectsAndCustomers();
  }

  async function onSaveEdit(projectId: string) {
    setError(null);
    setNotice(null);

    const response = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mapFormToPayload(editForm)),
    });

    if (!response.ok) {
      const message = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(message?.error || "Errore modifica progetto");
      return;
    }

    onCancelEdit();
    setNotice("Progetto aggiornato");
    await fetchProjectsAndCustomers();
  }

  async function onDeleteProject(projectId: string) {
    const confirmed = window.confirm("Confermi la cancellazione del progetto?");
    if (!confirmed) {
      return;
    }

    setError(null);
    setNotice(null);

    const response = await fetch(`/api/projects/${projectId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const message = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(message?.error || "Errore cancellazione progetto");
      return;
    }

    if (editingProjectId === projectId) {
      onCancelEdit();
    }
    setNotice("Progetto cancellato");
    await fetchProjectsAndCustomers();
  }

  async function onChangeProjectStatus(project: Project, status: ProjectStatus) {
    if (project.status === status) {
      return;
    }

    setError(null);
    setNotice(null);

    const payload = {
      ...mapFormToPayload(mapProjectToForm(project)),
      status,
    };

    const response = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const message = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(message?.error || "Errore aggiornamento stato progetto");
      return;
    }

    setNotice(`Stato progetto aggiornato: ${projectStatusLabels[status]}`);
    await fetchProjectsAndCustomers();
  }

  async function onSyncProjectReminders() {
    setSyncingReminders(true);
    setError(null);
    setNotice(null);

    const response = await fetch("/api/projects/reminders/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ daysBeforeDeadline: 3 }),
    });

    if (!response.ok) {
      const message = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(message?.error || "Errore sincronizzazione reminder");
      setSyncingReminders(false);
      return;
    }

    const payload = (await response.json()) as { created?: number; scanned?: number };
    setNotice(
      `Reminder progetto sincronizzati: ${payload.created ?? 0} creati su ${payload.scanned ?? 0} progetti`,
    );
    setSyncingReminders(false);
  }

  function getProgressWidth(project: Project) {
    if (!project.startDate || !project.deadline) {
      return 0;
    }

    const start = new Date(project.startDate).getTime();
    const end = new Date(project.deadline).getTime();
    const now = Date.now();

    if (end <= start) {
      return 0;
    }

    const ratio = (now - start) / (end - start);
    const bounded = Math.max(0, Math.min(1, ratio));
    return Math.round(bounded * 100);
  }

  function getMilestonePosition(project: Project, milestone: Milestone) {
    if (!project.startDate || !project.deadline || !milestone.deadline) {
      return 0;
    }

    const start = new Date(project.startDate).getTime();
    const end = new Date(project.deadline).getTime();
    const current = new Date(milestone.deadline).getTime();

    if (end <= start) {
      return 0;
    }

    const ratio = (current - start) / (end - start);
    const bounded = Math.max(0, Math.min(1, ratio));
    return Math.round(bounded * 100);
  }

  function renderProjectForm(
    form: ProjectForm,
    setForm: (next: ProjectForm) => void,
    onSubmit: (event: FormEvent) => void,
    submitLabel: string,
  ) {
    return (
      <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
        <Input
          label="Nome progetto"
          value={form.name}
          onChange={(value) => setForm({ ...form, name: value })}
          required
        />

        <SelectInput
          label="Cliente"
          value={form.customerId}
          onChange={(value) => setForm({ ...form, customerId: value })}
          options={[
            { value: "", label: "Nessun cliente associato" },
            ...customers.map((customer) => ({ value: customer.id, label: customer.name })),
          ]}
        />

        <Input
          label="Data inizio"
          type="date"
          value={form.startDate}
          onChange={(value) => setForm({ ...form, startDate: value })}
        />

        <Input
          label="Deadline"
          type="date"
          value={form.deadline}
          onChange={(value) => setForm({ ...form, deadline: value })}
        />

        <SelectInput
          label="Stato"
          value={form.status}
          onChange={(value) => setForm({ ...form, status: value as ProjectStatus })}
          options={Object.entries(projectStatusLabels).map(([value, label]) => ({ value, label }))}
        />

        <Input
          label="Avanzamento %"
          type="number"
          min={0}
          max={100}
          value={String(form.progress)}
          onChange={(value) => setForm({ ...form, progress: Number(value || 0) })}
        />

        <TextArea
          className="md:col-span-2"
          label="Descrizione"
          value={form.description}
          onChange={(value) => setForm({ ...form, description: value })}
        />

        <div className="md:col-span-2 rounded-lg border border-zinc-200 bg-white p-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-800">Punti chiave / Milestone</h3>
            <button
              className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700"
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  milestones: [...form.milestones, createMilestoneForm()],
                })
              }
            >
              Aggiungi milestone
            </button>
          </div>

          <div className="space-y-3">
            {form.milestones.map((milestone, index) => (
              <div key={milestone.formKey} className="grid gap-2 rounded-md border border-zinc-200 p-3 md:grid-cols-4">
                <Input
                  label="Titolo"
                  value={milestone.title}
                  onChange={(value) => {
                    const next = [...form.milestones];
                    next[index] = { ...next[index], title: value };
                    setForm({ ...form, milestones: next });
                  }}
                  required={index === 0}
                />

                <Input
                  label="Deadline"
                  type="date"
                  value={milestone.deadline}
                  onChange={(value) => {
                    const next = [...form.milestones];
                    next[index] = { ...next[index], deadline: value };
                    setForm({ ...form, milestones: next });
                  }}
                />

                <SelectInput
                  label="Stato"
                  value={milestone.status}
                  onChange={(value) => {
                    const next = [...form.milestones];
                    next[index] = { ...next[index], status: value as ProjectMilestoneStatus };
                    setForm({ ...form, milestones: next });
                  }}
                  options={Object.entries(milestoneStatusLabels).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />

                <div className="flex items-end">
                  <button
                    className="rounded-md border border-zinc-300 px-2 py-2 text-xs text-zinc-700"
                    type="button"
                    onClick={() => {
                      if (form.milestones.length === 1) {
                        return;
                      }

                      setForm({
                        ...form,
                        milestones: form.milestones.filter((_, milestoneIndex) => milestoneIndex !== index),
                      });
                    }}
                  >
                    Rimuovi
                  </button>
                </div>

                <TextArea
                  className="md:col-span-4"
                  label="Descrizione"
                  value={milestone.description}
                  onChange={(value) => {
                    const next = [...form.milestones];
                    next[index] = { ...next[index], description: value };
                    setForm({ ...form, milestones: next });
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <button className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white" type="submit">
            {submitLabel}
          </button>
        </div>
      </form>
    );
  }

  return (
    <main className="min-h-screen bg-white p-6 text-zinc-900 md:p-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Progetti</h1>
            <p className="text-sm text-zinc-600">Gestione progetti clienti, milestone e avanzamento lavori</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-800"
              type="button"
              onClick={() => {
                void onSyncProjectReminders();
              }}
              disabled={syncingReminders}
            >
              {syncingReminders ? "Sincronizzazione..." : "Sincronizza reminder deadline"}
            </button>
            <button
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white"
              type="button"
              onClick={() => {
                setShowCreateSection((prev) => !prev);
                setError(null);
                setNotice(null);
              }}
            >
              Inserisci nuovo progetto
            </button>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          <Stat title="Progetti totali" value={String(projectSummary.total)} />
          <Stat title="In corso" value={String(projectSummary.inProgress)} />
          <Stat title="In ritardo" value={String(projectSummary.overdue)} />
          <Stat title="Completati" value={String(projectSummary.completed)} />
        </section>

        {error && (
          <p className="rounded-md border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm text-zinc-800">
            {error}
          </p>
        )}

        {notice && (
          <p className="rounded-md border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm text-zinc-700">
            {notice}
          </p>
        )}

        {showCreateSection && (
          <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <h2 className="mb-3 text-lg font-semibold">Nuovo progetto</h2>
            {renderProjectForm(
              createForm,
              setCreateForm,
              (event) => {
                void onCreateProject(event);
              },
              "Salva progetto",
            )}
          </section>
        )}

        <section className="rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 bg-emerald-50 px-4 py-3 text-emerald-800">
            <h2 className="text-lg font-semibold">Kanban progetti</h2>
            <p className="text-xs text-emerald-700">Trascina una card nella colonna per aggiornare lo stato</p>
          </div>
          {loading ? (
            <p className="px-4 py-3 text-sm text-zinc-500">Caricamento...</p>
          ) : (
            <div className="grid gap-3 p-4 lg:grid-cols-5">
              {kanbanStatuses.map((status) => {
                const items = projects.filter((project) => project.status === status);

                return (
                  <div
                    key={status}
                    className="min-h-40 rounded-md border border-zinc-200 bg-zinc-50 p-2"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (!draggingProjectId) {
                        return;
                      }

                      const draggedProject = projects.find((project) => project.id === draggingProjectId);
                      if (!draggedProject) {
                        return;
                      }

                      void onChangeProjectStatus(draggedProject, status);
                      setDraggingProjectId(null);
                    }}
                  >
                    <h3 className="mb-2 text-sm font-semibold text-zinc-800">{projectStatusLabels[status]}</h3>
                    <div className="space-y-2">
                      {items.map((project) => (
                        <article
                          key={project.id}
                          draggable
                          onDragStart={() => setDraggingProjectId(project.id)}
                          onDragEnd={() => setDraggingProjectId(null)}
                          className="cursor-grab rounded-md border border-zinc-200 bg-white p-2 text-xs shadow-sm active:cursor-grabbing"
                        >
                          <p className="font-semibold text-zinc-900">{project.name}</p>
                          <p className="text-zinc-600">{project.customer?.name || "Senza cliente"}</p>
                          <p className="text-zinc-500">{project.progress}%</p>
                        </article>
                      ))}
                      {items.length === 0 && <p className="text-xs text-zinc-500">Nessun progetto</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 bg-amber-50 px-4 py-3 text-amber-800">
            <h2 className="text-lg font-semibold">Timeline milestone (Gantt semplificato)</h2>
          </div>
          {loading ? (
            <p className="px-4 py-3 text-sm text-zinc-500">Caricamento...</p>
          ) : (
            <div className="space-y-4 p-4">
              {timelineProjects.length === 0 ? (
                <p className="text-sm text-zinc-500">Servono data inizio e deadline sul progetto per visualizzare il Gantt.</p>
              ) : (
                timelineProjects.map((project) => (
                  <div key={project.id} className="rounded-md border border-zinc-200 p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <p className="font-semibold text-zinc-900">{project.name}</p>
                      <p className="text-zinc-600">
                        {formatDate(project.startDate)} - {formatDate(project.deadline)}
                      </p>
                    </div>
                    <div className="relative h-4 rounded-full bg-zinc-200">
                      <div
                        className="h-4 rounded-full bg-zinc-700"
                        style={{ width: `${getProgressWidth(project)}%` }}
                      />
                      {project.milestones
                        .filter((milestone) => milestone.deadline)
                        .map((milestone) => {
                          const left = getMilestonePosition(project, milestone);
                          const color =
                            milestone.status === "DONE"
                              ? "bg-emerald-500"
                              : milestone.status === "BLOCKED"
                                ? "bg-rose-500"
                                : "bg-sky-500";

                          return (
                            <span
                              key={`${project.id}-${milestone.title}-${left}`}
                              title={`${milestone.title} - ${formatDate(milestone.deadline)}`}
                              className={`absolute top-[-3px] h-5 w-1.5 rounded ${color}`}
                              style={{ left: `${left}%` }}
                            />
                          );
                        })}
                    </div>
                  </div>
                ))
              )}

              <div className="overflow-hidden rounded-md border border-zinc-200">
                <div className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-700">
                  Prossime milestone
                </div>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="px-3 py-2">Progetto</th>
                      <th className="px-3 py-2">Milestone</th>
                      <th className="px-3 py-2">Deadline</th>
                      <th className="px-3 py-2">Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingMilestones.map((milestone) => (
                      <tr key={`${milestone.projectId}-${milestone.milestoneTitle}-${milestone.deadline}`} className="border-t border-zinc-200">
                        <td className="px-3 py-2">{milestone.projectName}</td>
                        <td className="px-3 py-2">{milestone.milestoneTitle}</td>
                        <td className="px-3 py-2">{formatDate(milestone.deadline)}</td>
                        <td className="px-3 py-2">{milestoneStatusLabels[milestone.milestoneStatus]}</td>
                      </tr>
                    ))}
                    {upcomingMilestones.length === 0 && (
                      <tr className="border-t border-zinc-200">
                        <td className="px-3 py-2 text-zinc-500" colSpan={4}>
                          Nessuna milestone con deadline disponibile.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 bg-indigo-50 px-4 py-3 text-indigo-800">
            <h2 className="text-lg font-semibold">Lista progetti</h2>
          </div>

          {loading ? (
            <p className="px-4 py-3 text-sm text-zinc-500">Caricamento...</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2">Progetto</th>
                  <th className="px-4 py-2">Cliente</th>
                  <th className="px-4 py-2">Deadline</th>
                  <th className="px-4 py-2">Stato</th>
                  <th className="px-4 py-2">Avanzamento</th>
                  <th className="px-4 py-2">Milestone</th>
                  <th className="px-4 py-2">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => {
                  const isEditing = editingProjectId === project.id;

                  return (
                    <Fragment key={project.id}>
                      <tr className="border-t border-zinc-200 align-top">
                        <td className="px-4 py-2 font-medium text-zinc-900">{project.name}</td>
                        <td className="px-4 py-2">{project.customer?.name || "-"}</td>
                        <td className="px-4 py-2">{formatDate(project.deadline)}</td>
                        <td className="px-4 py-2">{projectStatusLabels[project.status]}</td>
                        <td className="px-4 py-2">{project.progress}%</td>
                        <td className="px-4 py-2">{project.milestones.length}</td>
                        <td className="px-4 py-2">
                          <div className="flex gap-2">
                            {!isEditing && (
                              <button
                                className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700"
                                type="button"
                                onClick={() => onStartEdit(project)}
                              >
                                Modifica
                              </button>
                            )}
                            <button
                              className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700"
                              type="button"
                              onClick={() => void onDeleteProject(project.id)}
                            >
                              Elimina
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isEditing && (
                        <tr className="border-t border-zinc-100 bg-zinc-50">
                          <td className="px-4 py-4" colSpan={7}>
                            <div className="mb-3 flex items-center justify-between">
                              <h3 className="text-sm font-semibold">Modifica progetto</h3>
                              <button
                                className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700"
                                type="button"
                                onClick={onCancelEdit}
                              >
                                Annulla
                              </button>
                            </div>
                            {renderProjectForm(
                              editForm,
                              setEditForm,
                              (event) => {
                                event.preventDefault();
                                void onSaveEdit(project.id);
                              },
                              "Salva modifiche",
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{title}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </article>
  );
}

function Input({
  label,
  value,
  onChange,
  required,
  type = "text",
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-zinc-700">{label}</span>
      <input
        className="rounded-md border border-zinc-300 px-3 py-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        min={min}
        max={max}
      />
    </label>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-zinc-700">{label}</span>
      <select
        className="rounded-md border border-zinc-300 px-3 py-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className || ""}`}>
      <span className="font-medium text-zinc-700">{label}</span>
      <textarea
        className="min-h-20 rounded-md border border-zinc-300 px-3 py-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
