# Piattaforma Gestione Progetti e Abbonamenti

Applicazione web per gestire progetti clienti, piani in abbonamento, scadenze di rinnovo, costi ricorrenti e fatture.

## Funzionalità MVP

- Gestione progetti clienti (definizione progetto, stato e avanzamento)
- Gestione milestone/punti chiave con deadline e stato
- Kanban progetti con drag and drop per stato avanzamento
- Timeline milestone in vista Gantt semplificata
- Reminder automatici sulle deadline progetto
- Inserimento clienti
- Inserimento servizi/piani (mensile, trimestrale, semestrale, annuale)
- Promozioni per servizio (es. primo anno sconto %)
- Creazione abbonamenti con calcolo automatico della prossima scadenza
- Creazione fatture e marcatura come pagate
- Creazione reminder email con invio automatico
- Gestione fornitori e registrazione costi (mensili o una tantum)
- Attribuzione servizi a fornitore con costo fornitore per ciclo
- Statistiche di ricavo, costi e margine per ottimizzazione spesa
- Dashboard con metriche: clienti, abbonamenti attivi, rinnovi in 30 giorni, fatture aperte, MRR stimato, progetti attivi e deadline imminenti

## Stack

- Next.js (App Router) + TypeScript
- Prisma ORM
- SQLite (database locale)
- Tailwind CSS

## Avvio in locale

1. Installa dipendenze:

	```bash
	npm install
	```

2. Genera client Prisma e applica migrazioni:

	```bash
	npx prisma generate
	npx prisma migrate dev
	```

3. Avvia l'app:

	```bash
	npm run dev
	```

4. Apri `http://localhost:3000`

## Build produzione

```bash
npm run build
npm run start
```

## Note

- Database locale: `dev.db`
- Variabili ambiente: `.env` (usa `DATABASE_URL="file:./dev.db"`)

### SMTP per reminder automatici

Per inviare email automatiche di reminder, configura queste variabili in `.env`:

```env
SMTP_HOST="smtp.tuoprovider.it"
SMTP_PORT="587"
SMTP_USER="user"
SMTP_PASS="password"
SMTP_FROM="Abbonamenti <noreply@tuodominio.it>"
```
