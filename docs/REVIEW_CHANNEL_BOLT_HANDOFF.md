# Handoff per team Bolt — canale review Omnia

**Da inviare a Bolt** insieme al link al repo: `docs/REVIEW_CHANNEL_BOLT_ARCHITECTURE.md` (dettaglio completo).

---

## 1. Conferma

Siamo **d’accordo** con la vostra impostazione:

- Due verità coordinate: **design Omnia** vs **versione autorizzata nel portale**.
- **Mongo (Express)** = draft proposto al publish.
- **Bolt Database** = reviewed + status (fonte autorevole per approvazione).
- **`draft_content_hash`** sul draft per “Omnia ha pubblicato qualcosa di nuovo” senza invalidare la review approvata.
- Ripubblica → aggiorna draft + `pending`, **non** tocca `reviewed_document` se `approved`.

---

## 2. Correzione importante — “stato attuale del codice”

| Voi (Bolt) | Repo Omnia (`use-case-review-portal/`) |
|------------|----------------------------------------|
| Portale legge draft da Express (`document`) | **Sì** |
| Revisore salva su Bolt Database | **Non ancora** — oggi `PUT` → **Mongo**, stesso `document` |
| reviewedContent già su Bolt | **Target** — da implementare sul **portale Bolt** |

Quindi: il modello che descrivete è **corretto come obiettivo**; il portale nel repo Omnia è ancora il canale **unico** Mongo. Il **portale Bolt** deve implementare schema + UI + notify secondo il contratto sotto.

---

## 3. Cosa chiediamo a Bolt (implementazione)

### 3.1 Schema Bolt Database

Tabella `agent_review_channels` (chiave `project_id` + `task_instance_id` + `audience`):

| Campo | Chi scrive | Uso |
|-------|------------|-----|
| `draft_content_hash`, `draft_updated_at` | Sync da publish Omnia (backend) o copia da GET Express | Badge **New**, “proposta nuova” |
| `reviewed_document` (jsonb) | Portale al save | Lavoro revisore |
| `reviewed_content_hash`, `reviewed_updated_at` | Portale | Diff / storico |
| `status` | Portale | `pending` \| `in_review` \| `approved` \| `rejected` |
| `task_label`, `project_label` | Portale o sync | Elenco home |

SQL di riferimento: `docs/REVIEW_CHANNEL_BOLT_ARCHITECTURE.md` §4.2.

### 3.2 Logica portale

1. **Apertura sessione:** `GET` draft da Omnia Express (`/api/projects/{pid}/agent-tasks/{tid}/review-channel?audience=` + header `X-Review-Token`). Mostrare draft in sola lettura o come base diff.
2. **Prima apertura:** se non esiste riga Bolt, creare con `status=pending`, `reviewed_document` inizializzato da draft (o vuoto + copy esplicita).
3. **Salvataggio revisore:** scrivere **solo** su Bolt (`reviewed_document`, `status=in_review`).
4. **Approva / Rifiuta:** aggiornare `status`; non sovrascrivere draft approvato con il solo fatto di ripubblicare Omnia.
5. **Dopo save/approve:** chiamare Omnia:

```http
POST https://<omnia-backend>/api/projects/{projectId}/agent-tasks/{taskInstanceId}/review-channel/notify
X-Review-Token: <AGENT_REVIEW_CHANNEL_TOKEN>
Content-Type: application/json

{
  "audience": "customer",
  "updatedAt": "2026-05-22T12:00:00.000Z",
  "draftContentHash": "<opzionale, se Omnia ha ripubblicato>",
  "status": "approved",
  "source": "portal"
}
```

6. **Elenco home:** query Bolt; badge **New** se `draft_updated_at` > ultima visita (`localStorage` chiave `omnia-review-seen:{projectId}:{taskId}:{audience}`); poll consigliato 5–10s sulla home.
7. **Sicurezza:** RLS + anon key nel browser; **non** embeddare service role nel frontend.

### 3.3 Quando Omnia ripubblica

- Backend Omnia (fase 2b, nostro): aggiorna Mongo draft + upsert su Bolt `draft_*` + `status=pending`.
- **Regola:** se su Bolt `status === 'approved'`, **non** sostituire `reviewed_document` finché il revisore non avvia un nuovo ciclo (approve/reject esplicito).

---

## 4. Cosa fa Omnia (non Bolt)

| Fase | Lavoro Omnia |
|------|----------------|
| **2b** | Publish scrive draft su Mongo; sync `draft_*` su Bolt (env `SUPABASE_*` solo su server Express) |
| **3** | Editor: Importa da `reviewed` solo se `approved`; Check review se `draft_content_hash` ≠ locale |
| **SSE** | Già attivo: client Omnia si iscrivono a `GET …/review-channel/events` |

URL backend Omnia (locale: ngrok o deploy cloud): da concordare insieme al token review.

---

## 5. Risposta alla vostra domanda

> *Vuoi che implementi questo schema nel portale (migrazione Bolt Database + UI draft vs reviewed + status)?*

**Sì.** Procedete con:

- migrazione tabella §3.1;
- UI stati + badge New;
- save/approve solo su Bolt;
- `POST …/notify` verso Omnia.

Noi parallelizziamo fase **2b** (sync publish Omnia → Bolt draft) e poi fase **3** (import/runtime da approved).

---

## 6. Non serve

- Sostituire Mongo con Bolt per tutto il progetto Omnia.
- Service role Supabase nel frontend del portale.
- Abbandonare Express: resta API draft + notify + (opz.) elenco.

---

## 7. Documenti nel repo Omnia

| File | Contenuto |
|------|-----------|
| `docs/REVIEW_CHANNEL_BOLT_ARCHITECTURE.md` | Architettura completa, SQL, flussi, checklist |
| `docs/REVIEW_CHANNEL_PUSH.md` | SSE e webhook notify |
| `docs/REVIEW_PORTAL_LOCAL.md` | Dev locale + note deploy cloud |
| `use-case-review-portal/` | Portale riferimento (Mongo) — non confondere con deploy Bolt |

---

*Preparato da team Omnia — passare a Bolt con link al branch/commit che contiene questi file.*
