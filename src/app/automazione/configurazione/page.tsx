"use client";

import { FormEvent, useEffect, useState } from "react";

type SmtpConfigResponse = {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
  configured: boolean;
};

export default function AutomazioneConfigurazionePage() {
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [testRecipient, setTestRecipient] = useState("");

  const [form, setForm] = useState({
    host: "",
    port: "587",
    user: "",
    pass: "",
    fromEmail: "",
    fromName: "",
  });

  async function fetchConfig() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/settings/smtp", { cache: "no-store" });
      if (!response.ok) {
        throw new Error();
      }

      const payload = (await response.json()) as SmtpConfigResponse;
      setForm({
        host: payload.host,
        port: String(payload.port || 587),
        user: payload.user,
        pass: payload.pass,
        fromEmail: payload.fromEmail,
        fromName: payload.fromName || "",
      });
    } catch {
      setError("Impossibile caricare configurazione SMTP");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchConfig();
  }, []);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const response = await fetch("/api/settings/smtp", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: form.host,
        port: Number(form.port),
        user: form.user,
        pass: form.pass,
        fromEmail: form.fromEmail,
        fromName: form.fromName,
      }),
    });

    if (!response.ok) {
      const message = (await response.json().catch(() => null)) as
        | { error?: string; detail?: string }
        | null;
      setError(message?.detail ? `${message.error} (${message.detail})` : message?.error || "Errore salvataggio SMTP");
      return;
    }

    setNotice("Configurazione SMTP salvata");
  }

  async function onTestSend() {
    setError(null);
    setNotice(null);
    setTesting(true);

    const response = await fetch("/api/settings/smtp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: testRecipient }),
    });

    setTesting(false);

    if (!response.ok) {
      const message = (await response.json().catch(() => null)) as
        | { error?: string; detail?: string }
        | null;
      setError(message?.detail ? `${message.error} (${message.detail})` : message?.error || "Invio test fallito");
      return;
    }

    setNotice("Email di test inviata con successo");
  }

  return (
    <main className="min-h-screen bg-white p-6 text-zinc-900 md:p-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header>
          <h1 className="text-3xl font-bold">Automazione - Configurazione</h1>
          <p className="text-sm text-zinc-600">Sezione invii notifiche: configurazione SMTP</p>
        </header>

        {error && <p className="rounded-md border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm text-zinc-800">{error}</p>}
        {notice && <p className="rounded-md border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm text-zinc-700">{notice}</p>}

        <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 bg-emerald-50 px-4 py-3 text-emerald-800">
            <h2 className="text-lg font-semibold">SMTP</h2>
          </div>

          {loading ? (
            <p className="px-4 py-3 text-sm text-zinc-500">Caricamento...</p>
          ) : (
            <form onSubmit={(event) => void onSave(event)} className="grid gap-3 p-4 md:grid-cols-2">
              <Input
                label="Host SMTP"
                value={form.host}
                onChange={(value) => setForm((prev) => ({ ...prev, host: value }))}
                required
              />

              <Input
                label="Porta SMTP"
                type="number"
                value={form.port}
                onChange={(value) => setForm((prev) => ({ ...prev, port: value }))}
                required
              />

              <Input
                label="Utente SMTP"
                value={form.user}
                onChange={(value) => setForm((prev) => ({ ...prev, user: value }))}
                required
              />

              <Input
                label="Password SMTP"
                type="password"
                value={form.pass}
                onChange={(value) => setForm((prev) => ({ ...prev, pass: value }))}
                required
              />

              <Input
                label="Email mittente"
                type="email"
                value={form.fromEmail}
                onChange={(value) => setForm((prev) => ({ ...prev, fromEmail: value }))}
                required
              />

              <Input
                label="Nome mittente (opzionale)"
                value={form.fromName}
                onChange={(value) => setForm((prev) => ({ ...prev, fromName: value }))}
              />

              <Input
                label="Email destinatario test"
                type="email"
                value={testRecipient}
                onChange={setTestRecipient}
              />

              <button className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white" type="submit">
                Salva configurazione
              </button>

              <button
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
                type="button"
                disabled={testing || !testRecipient}
                onClick={() => void onTestSend()}
              >
                {testing ? "Invio test in corso..." : "Test invio email"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-zinc-600">{label}</span>
      <input
        className="rounded-md border border-zinc-300 bg-white px-3 py-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        required={required}
      />
    </label>
  );
}
