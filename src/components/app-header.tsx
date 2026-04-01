import Link from "next/link";

type MenuItem = {
  label: string;
  href?: string;
};

type MenuGroup =
  | {
      label: string;
      href: string;
    }
  | {
      label: string;
      items: MenuItem[];
    };

const menu: MenuGroup[] = [
  {
    label: "Home",
    href: "/",
  },
  {
    label: "Dashboard",
    items: [
      { label: "Servizi & Abbonamenti", href: "/dashboard-servizi-abbonamenti" },
      { label: "Progetti", href: "/dashboard-progetti" },
    ],
  },
  {
    label: "Anagrafica",
    items: [
      { label: "Clienti", href: "/clienti" },
      { label: "Fornitori", href: "/fornitori" },
    ],
  },
  {
    label: "Progetti",
    items: [{ label: "Gestione", href: "/progetti" }],
  },
  {
    label: "Servizi",
    items: [
      { label: "Gestione", href: "/servizi/modifica" },
    ],
  },
  {
    label: "Abbonamenti",
    items: [
      { label: "Gestione", href: "/abbonamenti/modifica" },
    ],
  },
  {
    label: "Costi",
    items: [
      { label: "Gestione", href: "/costi" },
      { label: "Analisi economica", href: "/analisi-economica" },
    ],
  },
  {
    label: "Automazione",
    items: [
      { label: "Reminder" },
      { label: "Configurazione SMTP", href: "/automazione/configurazione" },
    ],
  },
];

export function AppHeader() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 p-4 md:px-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-semibold">
            Gestione Clienti e Servizi
          </Link>
        </div>
        <nav>
          <ul className="flex flex-wrap gap-2">
            {menu.map((group) => (
              <li key={group.label} className={"href" in group ? "" : "group relative pb-1"}>
                {"href" in group ? (
                  <Link
                    href={group.href}
                    className="block rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-800"
                  >
                    {group.label}
                  </Link>
                ) : (
                  <>
                    <button className="rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-800" type="button">
                      {group.label}
                    </button>
                    <ul className="invisible absolute left-0 top-[calc(100%-2px)] z-20 w-48 rounded-md border border-zinc-200 bg-white p-1 opacity-0 shadow-sm transition group-hover:visible group-hover:opacity-100">
                      {group.items.map((item) => (
                        <li key={item.label}>
                          {item.href ? (
                            <Link
                              href={item.href}
                              className="block w-full rounded-sm px-2 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100"
                            >
                              {item.label}
                            </Link>
                          ) : (
                            <span className="block w-full rounded-sm px-2 py-1.5 text-left text-sm text-zinc-400">
                              {item.label}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}