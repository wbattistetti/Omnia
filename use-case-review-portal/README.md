# Omnia — Use case review portal

Review esterna sul **canale condiviso** (Mongo via Express). Nessun `projectId` / `taskId` da digitare.

**Sviluppo locale:** [docs/REVIEW_PORTAL_LOCAL.md](../docs/REVIEW_PORTAL_LOCAL.md)  
**Architettura review:** [docs/REVIEW_CHANNEL_BOLT_ARCHITECTURE.md](../docs/REVIEW_CHANNEL_BOLT_ARCHITECTURE.md)

## Avvio rapido

```bash
# Root Omnia — terminale 1
npm run dev:beNew

# Root Omnia — terminale 2
npm run review-portal:dev
```

Portale: **http://localhost:5174** — backend: **http://127.0.0.1:3100**

```bash
# oppure dalla cartella portale
cd use-case-review-portal
npm install
npm run dev
```

In locale **non serve incollare token**: basta `AGENT_REVIEW_CHANNEL_TOKEN` in `backend/.env` (il portale lo legge da solo).

Se vedi errori di accesso, avvia `npm run dev:beNew` e riprova.

## Config (deploy / override)

Opzionale root `.env` per il link «Apri review web» da Omnia:

```env
VITE_USE_CASE_REVIEW_PORTAL_URL=http://localhost:5174
```

## Flusso

1. Omnia → **Pubblica** sul task agente.
2. Portale → **Aggiorna elenco** → apri review → modifica + autosave.
3. Omnia → **Controlla** → **Importa**.
