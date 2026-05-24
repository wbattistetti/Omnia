# Portale review — sviluppo locale

Guida per perfezionare il flusso in locale. Per il deploy in produzione, l’architetto di sistema usa lo stesso repo (vedi § Deploy cloud).

## Prerequisiti

- Node ≥ 20
- Mongo raggiungibile (come per Omnia)
- Redis (per `npm run dev:beNew`)

## Avvio (3 terminali)

```bash
# 1 — Backend Express + API + Redis
npm run dev:beNew

# 2 — Portale review (proxy → :3100)
npm run review-portal:dev

# 3 — UI Omnia
npm run dev
```

| Servizio | URL |
|----------|-----|
| Omnia UI | http://localhost:5173 |
| Portale review | http://localhost:5174 |
| API Express | http://127.0.0.1:3100 |
| API FastAPI (Read API backend) | http://127.0.0.1:8000 |

**Recupera specifiche** nel tab Backend del portale usa `/api/openapi-proxy` (FastAPI). Con `npm run dev:beNew` FastAPI è già avviato; il proxy Vite del portale lo inoltra automaticamente.

Alternativa **una porta** (portale buildato servito da Express):

```bash
npm run review-portal:build
npm run be:express
# Portale: http://127.0.0.1:3100/review-portal/
```

## Variabili (solo per chi deploya — il designer non le vede)

In **locale** token e header sono gestiti in automatico: Vite legge `AGENT_REVIEW_CHANNEL_TOKEN` da `backend/.env` e il backend accetta le API review senza incollare nulla nel browser.

Opzionale in root `.env` (link da Omnia al portale):

```env
VITE_USE_CASE_REVIEW_PORTAL_URL=http://localhost:5174
```

Per **produzione**, l’architetto di sistema imposta `AGENT_REVIEW_CHANNEL_TOKEN` sul server e `VITE_AGENT_REVIEW_CHANNEL_TOKEN` al build del portale (stesso valore).

## Verifica API

```powershell
$h = @{ "X-Review-Token" = "omnia" }
Invoke-RestMethod -Uri "http://127.0.0.1:3100/api/agent-review-channels" -Headers $h
```

Deve restituire `{ items: [...] }`.

## Flusso

1. Omnia → task agente → **Pubblica for review**
2. Portale → **Aggiorna elenco** → apri review → modifica (autosave su Mongo via Express)
3. Omnia → **Check review** / **Importa**

Vedi anche: [REVIEW_CHANNEL_PUSH.md](./REVIEW_CHANNEL_PUSH.md), [REVIEW_CHANNEL_BOLT_ARCHITECTURE.md](./REVIEW_CHANNEL_BOLT_ARCHITECTURE.md).

---

## Deploy cloud (architetto di sistema)

Componenti:

1. **Express** — `node backend/server.js`, MongoDB in env.
2. **Portale statico** — `npm run review-portal:build` → `use-case-review-portal/dist`, servito da Express su `/review-portal/` o CDN.
3. **Segreti** — `AGENT_REVIEW_CHANNEL_TOKEN` uguale su backend e build portale (`VITE_AGENT_REVIEW_CHANNEL_TOKEN` se token in build).
4. **URL API pubblico** — se portale su host diverso: `VITE_REVIEW_API_BASE=https://api.example.com` in build.

Build:

```bash
npm install
npm install --prefix use-case-review-portal
npm run review-portal:build
```

Health check: `GET /api/ping`.
