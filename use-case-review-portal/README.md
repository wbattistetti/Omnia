# Omnia — Use case review portal

Review esterna sul **canale condiviso** (Mongo). Nessun `projectId` / `taskId` da digitare.

## Deploy su Render (PC spento)

Guida: **[docs/RENDER_DEPLOY_REVIEW_PORTAL.md](../docs/RENDER_DEPLOY_REVIEW_PORTAL.md)** — URL: `https://<servizio>.onrender.com/review-portal`

## Avvio

```bash
cd use-case-review-portal
npm install
npm run dev
```

Backend Omnia su **`127.0.0.1:3100`** (obbligatorio mentre usi il portale):

```bash
# dalla root Omnia, in un terminale separato
npm run be:express
# oppure
npm run dev:beNew
```

Poi il portale: `npm run review-portal:dev` → `http://localhost:5174`.

Se vedi **500** su `/api/agent-review-channels`, quasi sempre il proxy non raggiunge Express (backend spento o non ancora su :3100).

## Config (solo deploy, non per il revisore)

File `use-case-review-portal/.env` (opzionale):

```env
VITE_AGENT_REVIEW_CHANNEL_TOKEN=stesso-valore-di-AGENT_REVIEW_CHANNEL_TOKEN
VITE_REVIEW_API_BASE=
```

`VITE_REVIEW_API_BASE` vuoto in dev → le chiamate passano dal **proxy Vite** (vedi `vite.config.ts`).

`VITE_REVIEW_API_TARGET=http://127.0.0.1:3100` — dove inoltrare `/api/agent-review-channels` e `/api/projects/.../review-channel`.

In Omnia (root `.env`):

```env
VITE_USE_CASE_REVIEW_PORTAL_URL=http://localhost:5174
VITE_AGENT_REVIEW_CHANNEL_TOKEN=...
AGENT_REVIEW_CHANNEL_TOKEN=...
```

## Flusso

1. Omnia → **Pubblica** sul task agente.
2. Portale → home con **elenco** delle review pubblicate.
3. Clic sulla riga → scegli **use case** nella colonna sinistra → modifica + autosave.
4. Omnia → **Controlla** → **Importa** → salva progetto.
