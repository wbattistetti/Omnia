# Canale review — architettura Omnia ↔ Portale Bolt ↔ Bolt Database

Documento di allineamento tra **team Omnia** (repo `wbattistetti/Omnia`) e **team portale Bolt** (hosting / Bolt Database).

| Versione | Ruolo |
|----------|--------|
| **Stato attuale (repo Omnia)** | Un solo `document` su Mongo via Express; portale in `use-case-review-portal/` legge/scrive lo stesso campo. |
| **Stato target (accordato)** | **Draft** su Express/Mongo; **reviewed + status** su Bolt Database. |

Vedi anche: [REVIEW_CHANNEL_PUSH.md](./REVIEW_CHANNEL_PUSH.md) (SSE/webhook), [REVIEW_PORTAL_LOCAL.md](./REVIEW_PORTAL_LOCAL.md) (dev locale + note deploy), [REVIEW_CHANNEL_BOLT_HANDOFF.md](./REVIEW_CHANNEL_BOLT_HANDOFF.md) (testo da inviare a Bolt).

---

## 1. Obiettivo condiviso

| Ambiente | Ruolo |
|----------|--------|
| **Omnia** | Design interno (prompt, use case, flow). Non è automaticamente “in produzione”. |
| **Portale Bolt** | Auditing/approvazione: revisore vede il draft, lavora, approva o rifiuta. |
| **Express + Mongo** | Source of truth del **draft** proposto da Omnia. |
| **Bolt Database** | Source of truth del **reviewed** e dello **status**. |

**Pubblica** da Omnia = **proposta** (snapshot), non decisione finale.

**Versione che comanda** per esecuzione/deploy = `reviewed_document` con `status = approved` (consumer Omnia/runtime — fase 3).

---

## 2. Due verità coordinate (non un blob unico)

```
Verità interna (Omnia)   →  progetto / task / flow (DB progetto Omnia)
Verità draft (canale)    →  draftContent in Mongo (snapshot al publish)
Verità esterna (portale) →  reviewedContent + status in Bolt Database
```

### Invarianti

1. Omnia **non** sovrascrive `reviewed_document` approvato con un nuovo publish.
2. Nuovo publish → aggiorna **draft** + su Bolt `draft_*` e `status = pending`; **non** tocca `reviewed_document` se già `approved`.
3. **`draft_content_hash`** → badge **New** nel portale e “Check review” in Omnia (proposta nuova).
4. **`reviewed_content_hash`** → diff sul lavoro del revisore dopo approvazione.
5. Il portale **non** tratta il draft come versione approvata dopo `approved`.

---

## 3. Stato attuale vs affermazioni Bolt (chiarimento repo Omnia)

| Affermazione Bolt | Nel repo Omnia (`use-case-review-portal/`) |
|-------------------|--------------------------------------------|
| Portale legge draft da Express (`document`) | **Sì** — `GET …/review-channel` |
| Revisore salva su Bolt Database | **No (ancora)** — `PUT` Express → Mongo, stesso `document` |
| Bolt = già `reviewedContent` | **Intenzione target**; da implementare sul portale Bolt |
| Un solo `document` mescola le verità | **Sì** — `project_meta.agentReviewChannels` |

Il **portale Bolt** (deploy esterno) implementa il target; il portale in repo resta riferimento API verso Express fino a migrazione.

---

## 4. Modello dati

### 4.1 Mongo — draft (Express / Omnia)

Percorso: `project_meta.agentReviewChannels.{taskInstanceId}.{audience}`.

**Target logico** (evoluzione del campo attuale):

```json
{
  "draftContent": {
    "reviewExportVersion": 1,
    "projectId": "proj_…",
    "taskInstanceId": "…",
    "taskLabel": "…",
    "agentDesignDescription": "…",
    "useCaseBundle": {
      "useCaseBundleSchemaVersion": 3,
      "categories": [],
      "use_cases": []
    },
    "reviewAudience": "customer"
  },
  "draftContentHash": "<sha256 hex payload canonico>",
  "draftUpdatedAt": "2026-05-22T12:00:00.000Z"
}
```

**Compatibilità:** fino alla migrazione, al publish Omnia può continuare a scrivere `document`; il backend espone `draftContentHash` come l’attuale `contentHash`.

**Audience:** `customer` | `internal` | `auditing` — una riga logica per `(projectId, taskInstanceId, audience)`.

### 4.2 Bolt Database — reviewed + status (portale Bolt)

Tabella: `agent_review_channels`.

```sql
create table if not exists agent_review_channels (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  task_instance_id text not null,
  audience text not null
    check (audience in ('customer', 'internal', 'auditing')),
  task_label text,
  project_label text,

  draft_content_hash text,
  draft_updated_at timestamptz,

  reviewed_document jsonb,
  reviewed_content_hash text,
  reviewed_updated_at timestamptz,

  status text not null default 'pending'
    check (status in ('pending', 'in_review', 'approved', 'rejected')),
  version int not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (project_id, task_instance_id, audience)
);

create index if not exists idx_arc_status on agent_review_channels (status);
create index if not exists idx_arc_draft_updated on agent_review_channels (draft_updated_at desc);
```

**Sicurezza:** portale → anon key + RLS. Omnia backend (sync publish) → `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` **solo server-side**, mai `VITE_*`.

---

## 5. Chi scrive cosa

| Evento | Express / Mongo | Bolt DB | Portale Bolt |
|--------|-----------------|---------|--------------|
| **Pubblica** (Omnia) | `draftContent`, `draftContentHash`, `draftUpdatedAt` | Upsert `draft_*`, `status=pending`; **non** sovrascrive `reviewed_document` se `approved` | — |
| **Elenco home** | Opz. metadati draft | Query righe + join logico | Poll 5–10s; badge **New** |
| **Apre review** | `GET` draft | `GET` reviewed + status | UI draft (read-only) + editor reviewed |
| **Salva revisore** | — | `reviewed_document`, `status=in_review` | Save + notify |
| **Approva / Rifiuta** | — | `status=approved|rejected` | UI + notify |
| **Importa** (Omnia) | Confronto `draftContentHash` | Legge `reviewed` se `approved` | — |
| **Push desktop Omnia** | `POST …/notify` → SSE | Dopo save/approve portale | Chiamata HTTP |

---

## 6. Flussi

### Publish da Omnia

```
Omnia UI → PUT Express → Mongo (draft)
Omnia backend → UPSERT Bolt (draft_*, status=pending; preserva reviewed se approved)
Express → SSE review_channel_updated (source=omnia)
Portale (home) → poll → badge New se draft_updated_at > lastSeen
```

### Review e approvazione

```
Portale → GET draft da Express
Portale → edit reviewed_document su Bolt
Portale → Approve → status=approved
Portale → POST /api/projects/.../review-channel/notify
Omnia editor → SSE → Check review / Importa
```

### Ripubblicazione con review già approvata

```
Omnia → nuovo draft in Mongo + nuovo draft_content_hash
Bolt → aggiorna draft_* + pending; reviewed approvato invariato fino a nuovo ciclo
```

---

## 7. API Express (Omnia)

| Metodo | Path | Oggi | Target |
|--------|------|------|--------|
| `GET` | `/api/agent-review-channels` | Lista da Mongo | + metadati Bolt (status) |
| `GET` | `/api/projects/:pid/agent-tasks/:tid/review-channel` | `document` | Draft (+ opz. proxy reviewed) |
| `PUT` | `…/review-channel?audience=` | Sovrascrive `document` | Solo draft; sync Bolt |
| `GET` | `…/review-channel/events` | SSE | Invariato |
| `POST` | `…/review-channel/notify` | Webhook portale | Invariato — **obbligatorio** dopo save Bolt |

Payload notify (esempio):

```json
{
  "audience": "customer",
  "updatedAt": "2026-05-22T12:00:00.000Z",
  "draftContentHash": "<hash draft>",
  "status": "approved",
  "source": "portal"
}
```

---

## 8. Responsabilità — Portale Bolt (da implementare)

1. Migrazione schema §4.2 su Bolt Database.
2. Lettura draft: `GET` Express (campo `document` o `draftContent` quando disponibile).
3. Scrittura revisore **solo** su Bolt (`reviewed_document`, `status`).
4. UI: stati `pending` / `in_review` / `approved` / `rejected`; badge **New** (`draft_updated_at` vs `localStorage` `omnia-review-seen:{projectId}:{taskId}:{audience}`).
5. Dopo ogni save/approve: `POST …/review-channel/notify` con token `X-Review-Token`.
6. Publish Omnia: ricevere aggiornamento `draft_*` (sync backend Omnia o webhook) senza cancellare reviewed approvato.

---

## 9. Responsabilità — Team Omnia (repo)

| Fase | Lavoro |
|------|--------|
| **0** | Questo documento + token/URL portale Bolt in env |
| **1** | (Opz.) Badge New su portale legacy Mongo |
| **2b** | Backend: publish draft-only + upsert Bolt (service role) |
| **3** | Import da `approved`; runtime legge reviewed approvato |
| **4** | Deprecare `document` unico su Mongo |

Env backend (fase 2b):

```env
SUPABASE_URL=https://….supabase.co
SUPABASE_SERVICE_ROLE_KEY=…
AGENT_REVIEW_CHANNEL_TOKEN=…
```

---

## 10. Fasi di rollout

| Fase | Deliverable | Owner |
|------|-------------|--------|
| **0** | Allineamento + env | Tutti |
| **1** | New + poll elenco (Mongo ok come MVP) | Portale |
| **2** | Schema Bolt + save/approve + notify | **Bolt** |
| **2b** | Express sync draft → Bolt | **Omnia** |
| **3** | Import/runtime da approved | **Omnia** |

---

## 11. Checklist meeting

- [ ] URL API pubblico + `AGENT_REVIEW_CHANNEL_TOKEN` condiviso tra backend e portale
- [ ] Reviewed + status **solo** su Bolt (no doppio PUT reviewed su Mongo)
- [ ] Publish non sovrascrive `reviewed_document` se `approved`
- [ ] `draft_content_hash` per New / Check review
- [ ] `POST …/notify` dopo ogni save/approve portale
- [ ] Service role Supabase solo su backend Omnia

---

*Aggiornato: maggio 2026 — allineamento con proposta Bolt (draft Mongo + reviewed Bolt).*
