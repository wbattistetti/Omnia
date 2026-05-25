# Mini-manuale Omnia + Portale review — deploy aziendale

Guida per **sistemisti / architetti di sistema** che ricevono il monorepo Omnia e devono pubblicarlo in ambiente aziendale (intranet, reverse proxy, segreti, health check).

Per sviluppo locale del portale review: [REVIEW_PORTAL_LOCAL.md](./REVIEW_PORTAL_LOCAL.md).  
Architettura canale review: [REVIEW_CHANNEL_BOLT_ARCHITECTURE.md](./REVIEW_CHANNEL_BOLT_ARCHITECTURE.md).

---

## 1. Struttura del repository (monorepo unico)

**Un solo repository Git.** Non va diviso in due repository.

```
omnia/                          ← root (package.json principale)
├── src/                        ← UI Omnia (editor task, KB, agenti AI, runtime UI)
├── backend/                    ← API Express (Node) — backend condiviso
│   └── .env                    ← segreti server (NON in Git)
├── newBackend/                 ← API FastAPI (Python) — servizi complementari
├── packages/
│   ├── omnia-domain-core/      ← logica dominio condivisa
│   └── omnia-domain-components/
├── use-case-review-portal/     ← UI «Portale» (review use case, consultazione KB)
├── VBNET/                      ← ApiServer .NET (runtime dialoghi — opzionale)
├── config/                     ← proxy Vite, token review
├── docker-compose.yml          ← Redis (dev / stack completo)
└── dist/                       ← output build Omnia (dopo npm run build)
    use-case-review-portal/dist/ ← output build Portale
```

### A. Omnia (progetto principale)

Tool completo: editor task, Knowledge Base, design agenti AI, runtime UI, moduli condivisi con il Portale.

| Aspetto | Dettaglio |
|---------|-----------|
| Codice UI | `src/` |
| Build | `npm run build` → `dist/` (root) |
| Dev | `npm run dev` → http://localhost:5173 |

### B. Portale review (`use-case-review-portal/`)

Sottoinsieme per revisione contenuti e interfaccia semplificata. **Non è un progetto indipendente:** vive nello stesso repository, dipende dalla root (`file:..` nel `package.json` del portale) e riusa componenti e moduli di Omnia (`src/`, `packages/`, alias Vite).

| Aspetto | Dettaglio |
|---------|-----------|
| Build | `npm run review-portal:build` → `use-case-review-portal/dist/` |
| Dev | `npm run review-portal:dev` → http://localhost:5174 |
| Produzione | `base: '/review-portal/'` nel build Vite (path sotto dominio API o dedicato) |

---

## 2. Cosa deve fare il sistemista

### 2.1 Importare il repository così com’è

- Clone del repository aziendale **intero** (branch/tag concordato con il team dev).
- **Non** dividere in repository separati.
- **Non** modificare la struttura delle cartelle senza accordo con il team dev.

### 2.2 Prerequisiti runtime

| Componente | Versione / nota |
|------------|-----------------|
| **Node.js** | **≥ 20** (`package.json` → `"engines": { "node": ">=20" }`) |
| **npm** | install dalla **root** del repository |
| **MongoDB** | obbligatorio per Express (progetti, KB, canale review) |
| **Redis** | richiesto per stack completo; in produzione: `REDIS_URL` |
| **Python 3** + **uvicorn** | FastAPI su porta **8000** (embeddings, OpenAPI proxy, OAuth portale) |
| **PostgreSQL** | **opzionale** — cache catalogo modelli/voci IA (`DATABASE_URL` o `POSTGRES_URL`) |
| **.NET** | **opzionale** — `VBNET/ApiServer` porta **5000** per runtime dialoghi completo |

> **Nota handoff dev:** verificare che la connection string MongoDB sia configurata via `MONGODB_URI` in `backend/.env` e non hardcoded prima del deploy in produzione.

### 2.3 Installazione dipendenze

Dalla **root** del repository:

```bash
cd /path/to/omnia
npm install
```

Il workspace npm include `use-case-review-portal` e `packages/*`. In genere non serve un secondo `npm install` nel portale se si builda dalla root. In dubbio:

```bash
npm install --prefix use-case-review-portal
```

### 2.4 Due build frontend distinte

| Prodotto | Comando (dalla root) | Output |
|----------|----------------------|--------|
| **Omnia UI** | `npm run build` | `./dist/` |
| **Portale review** | `npm run review-portal:build` | `./use-case-review-portal/dist/` |

Esempio pipeline CI:

```bash
npm ci
npm run build
npm run review-portal:build
```

#### Variabili Vite al momento del build

Impostare in CI o `.env.production` (valori reali in vault aziendale, **non** in Git):

| Variabile | Build | Scopo |
|-----------|-------|--------|
| `VITE_BACKEND_URL` | Omnia | URL pubblico API Express (es. `https://api.azienda.it`) |
| `VITE_USE_CASE_REVIEW_PORTAL_URL` | Omnia | link «Apri review web» (es. `https://intranet.azienda.it/portal`) |
| `VITE_REVIEW_API_BASE` | Portale | se Portale su host **diverso** da Express |
| `VITE_AGENT_REVIEW_CHANNEL_TOKEN` | Portale (prod) | stesso valore di `AGENT_REVIEW_CHANNEL_TOKEN` sul server |
| `VITE_GROQ_KEY` / `VITE_GROQ_API_KEY` | Omnia (se previsto) | chiamate AI dal browser; molte passano dal backend |

### 2.5 Pubblicare due URL (due SPA)

| SPA | Cartella da servire | URL esempio |
|-----|---------------------|-------------|
| Omnia | `dist/` | `https://intranet.azienda.it/omnia/` |
| Portale | `use-case-review-portal/dist/` | `https://intranet.azienda.it/portal/` oppure `https://api.azienda.it/review-portal/` |

**Due modalità per il Portale:**

1. **CDN / nginx dedicato** (URL separato) — consigliato se il portale è su host diverso da Omnia. Impostare `VITE_REVIEW_API_BASE` al build verso l’API Express.
2. **Stesso processo Express** — dopo `review-portal:build`, Express serve la SPA su `/review-portal/` (vedi `backend/server.js`). Utile per PoC o un solo dominio.

Omnia **non** è servita da Express nel codice attuale: va su **nginx / IIS / static hosting** con fallback SPA su `index.html`.

### 2.6 Reverse proxy

Per **ogni** SPA:

- fallback su `index.html` (routing lato client)
- asset statici con cache appropriata
- proxy delle API verso Express (e, se esposto, FastAPI)

Esempio concettuale nginx:

```nginx
# Omnia SPA
location /omnia/ {
  alias /var/www/omnia/dist/;
  try_files $uri $uri/ /omnia/index.html;
}

# Portale SPA (host separato)
location / {
  root /var/www/omnia-portal/dist;
  try_files $uri $uri/ /index.html;
}

# API Express
location /api/ {
  proxy_pass http://127.0.0.1:3100;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

location /design/ { proxy_pass http://127.0.0.1:3100; }

# FastAPI (se esposto)
location /api/openapi-proxy { proxy_pass http://127.0.0.1:8000; }
location /api/auth/portal { proxy_pass http://127.0.0.1:8000; }
```

**Non esporre** Redis (6379), MongoDB, porte interne Python/.NET se non strettamente necessarie.

---

## 3. Backend unico (Omnia + Portale)

Un solo backend Express serve entrambe le UI. FastAPI e Redis completano funzionalità specifiche.

### 3.1 Processi e porte

| Servizio | Porta default | Avvio produzione |
|----------|---------------|------------------|
| **Express** | `3100` (`PORT`) | `node backend/server.js` oppure `npm run be:express` |
| **FastAPI** | `8000` | `uvicorn newBackend.app:app --host 127.0.0.1 --port 8000` (senza `--reload`) |
| **Redis** | `6379` | `docker compose up -d redis` o istanza gestita |
| **ApiServer .NET** | `5000` | solo se serve runtime VB completo |

**Non esiste** `npm run start` alla root del repository.

#### Comandi sviluppo (riferimento)

```bash
# Terminale 1 — Redis + Express + FastAPI
npm run dev:beNew

# Terminale 2 — UI Omnia
npm run dev

# Terminale 3 — Portale review
npm run review-portal:dev
```

Alternativa «una porta» (solo portale buildato + Express):

```bash
npm run review-portal:build
npm run be:express
# Portale: http://127.0.0.1:3100/review-portal/
```

### 3.2 File di configurazione

| File | Uso |
|------|-----|
| `backend/.env` | Express — **principale** (`dotenv` in `server.js`) |
| `.env` / `.env.local` (root) | Vite dev; FastAPI legge anche `backend/.env` |
| `use-case-review-portal/.env` | override build portale (opzionale) |

Template: `backend/.env.example`, `.env.example`, `use-case-review-portal/.env.example`.

### 3.3 Variabili `backend/.env` (checklist)

**Critiche in produzione**

| Variabile | Descrizione |
|-----------|-------------|
| `MONGODB_URI` | Connection string MongoDB |
| `AGENT_REVIEW_CHANNEL_TOKEN` | Token canale review (header `X-Review-Token`) |
| `OPENAI_API_KEY` / `GROQ_API_KEY` | Provider AI lato server |
| `ELEVENLABS_API_KEY` | Voce / ConvAI (se usato) |
| `OMNIA_PORTAL_TOKEN_ENCRYPTION_KEY` | Fernet OAuth portale (`openssl rand -base64 32`) |
| `OMNIA_GOOGLE_OAUTH_CLIENT_ID` / `OMNIA_GOOGLE_OAUTH_CLIENT_SECRET` | OAuth API protette |
| `OMNIA_OAUTH_REDIRECT_URI` | Deve coincidere con Google Cloud Console |

**Infrastruttura**

| Variabile | Default | Note |
|-----------|---------|------|
| `PORT` | `3100` | Express |
| `REDIS_URL` | `redis://localhost:6379` | |
| `REDIS_KEY_PREFIX` | `omnia:` | |
| `EMBEDDING_SERVICE_URL` | `http://localhost:8000` | FastAPI |
| `OMNIA_FASTAPI_BASE` | `http://127.0.0.1:8000` | Express → FastAPI |
| `DATABASE_URL` / `POSTGRES_URL` | — | opzionale, catalogo IA |
| `OMNIA_API_SERVER_URL` | `http://127.0.0.1:5000` | ApiServer .NET se presente |

**Sicurezza**

- `OMNIA_REVIEW_CHANNEL_STRICT_AUTH=1` — comportamento review come in produzione
- Non pubblicare file `.env` in artefatti né in Git
- `OMNIA_WRITABLE_CONFIG=1` solo dove serve scrittura config su disco

### 3.4 Health check

```bash
curl http://127.0.0.1:3100/api/ping
curl http://127.0.0.1:8000/api/ping
```

Verifica canale review (PowerShell, sostituire il token):

```powershell
$h = @{ "X-Review-Token" = "<AGENT_REVIEW_CHANNEL_TOKEN>" }
Invoke-RestMethod -Uri "http://127.0.0.1:3100/api/agent-review-channels" -Headers $h
```

Risposta attesa: oggetto con `items: [...]`.

---

## 4. Schema deploy (panoramica)

```
Browser
  ├── Omnia SPA          → nginx /static → dist/
  └── Portale SPA        → nginx /static → use-case-review-portal/dist/
                              oppure Express /review-portal/

Reverse proxy
  ├── /api/*, /design/*  → Express :3100
  └── /api/openapi-proxy, /api/auth/portal → FastAPI :8000 (se esposto)

Application
  ├── Express  → MongoDB, Redis, (Postgres opz.), FastAPI, (ApiServer .NET opz.)
  └── FastAPI  → embeddings, OpenAPI proxy, OAuth portale
```

---

## 5. Cosa NON deve fare il sistemista

- **Non** dividere il repository in due repo
- **Non** duplicare componenti UI o moduli `packages/`
- **Non** rinominare o spostare `use-case-review-portal/` senza accordo dev
- **Non** pubblicare file `.env` o chiavi API in Git / artefatti pubblici
- **Non** esporre MongoDB, Redis, porte interne non necessarie su Internet
- **Non** usare script inesistenti (`build:omnia`, `build:portal`, `npm run start` alla root)

---

## 6. Per altri sviluppatori (processo Git)

- Repository **unico**, versioning unico
- Pull request sul repository unico; etichettare issue/PR per area (`omnia` / `portal`)
- Modifiche al Portale spesso toccano `src/`, `packages/`, `config/` — review incrociata
- Verifica locale consigliata: `npm run verify:refactor` (include build portale)

---

## 7. Checklist handoff dev → sistemista

Il team dev consegna:

1. Branch o tag da deployare
2. Valori `backend/.env` in vault aziendale (da `backend/.env.example`)
3. URI MongoDB configurabile (`MONGODB_URI`), non credenziali in codice
4. URL pubblici finali (Omnia, Portale, API) per variabili `VITE_*` al build
5. `AGENT_REVIEW_CHANNEL_TOKEN` + allineamento build portale (`VITE_AGENT_REVIEW_CHANNEL_TOKEN`)
6. Scelta deploy Portale: host nginx separato vs `/review-portal/` su Express
7. Se serve runtime dialoghi completo: procedura avvio `VBNET/ApiServer`
8. Piano backup MongoDB ed eventuale PostgreSQL

---

## Riferimenti rapidi comandi

| Azione | Comando |
|--------|---------|
| Install | `npm install` (root) |
| Build Omnia | `npm run build` |
| Build Portale | `npm run review-portal:build` |
| Avvio Express (prod) | `npm run be:express` |
| Stack dev completo | `npm run dev:beNew` + `npm run dev` + `npm run review-portal:dev` |
| Redis (docker) | `npm run redis:up` |
