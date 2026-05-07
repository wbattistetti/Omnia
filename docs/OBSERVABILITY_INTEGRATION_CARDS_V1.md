# Omnia — Carte di osservabilità integrazione (catalogo v1)

Documento di **design contrattuale**: il runtime emette payload conformi a queste definizioni; il debugger le rende come **carte**.  
Distinzione richiesta:

- **Carte generali**: valide per **qualsiasi** integrazione app ↔ agente virtuale (schema, sessione, proxy, auth, ecc.).
- **Carte scoped**: **warning opzionali**, rilevate con euristiche; include la famiglia **“opzione proposta ∉ insieme restituito dal backend”**, riutilizzabile oltre l’agenda (catalogo, FAQ, knowledge base).

---

## Convenzioni

| Campo | Significato |
|--------|-------------|
| **Evento** | `snake_case`, nome stabile nel registry (non duplicare sinonimi). |
| **Severity** | `info` \| `warning` \| `error`. Le carte scoped di grounding sono **`warning`**. |
| **integrationStage** | `compile` \| `provision` \| `runtime_tool` \| `notify` \| `proxy`. |
| **Applicabilità** | `generale` — sempre rilevante per integrazioni HTTP/tool; oppure contesti tipici (`agenda_tool`, `catalog_tool`, `faq_tool`) quando la stessa carta si applica in modo ricorrente a quel tipo di tool (stesso evento, più contesti). |

---

## 1. Carte generali (integrazione qualunque)

| Evento | Titolo carta (UI) | Campi obbligatori | Hint default (designer) | Severity | integrationStage | Applicabilità |
|--------|-------------------|-------------------|---------------------------|----------|------------------|---------------|
| `schema_mismatch` | Schema tool non allineato | `toolName`, `expectedShape`, `receivedShape` | Allinea lo schema del tool (compile / OpenAPI) con ciò che il backend si aspetta. | error | compile | generale |
| `openapi_import_stale` | OpenAPI obsoleto o incompleto | `taskId`, `endpoint`, `contentHash` | Riesegui «Recupera» dall’OpenAPI e verifica le righe SEND. | warning | compile | generale |
| `send_binding_incomplete` | SEND incompleto sul Backend Call | `taskId`, `missingFields` | Completa i parametri obbligatori in SEND per l’endpoint scelto. | error | compile | generale |
| `convai_tool_not_wired` | Tool backend non collegato all’agente | `taskId`, `agentTaskId` | Aggiungi il Backend Call in `convaiBackendToolTaskIds` / catalogo agente. | error | compile | generale |
| `agent_provision_failed` | Creazione agente ConvAI fallita | `provider`, `httpStatus`, `detail` | Controlla schema ElevenLabs, quota, residency (EU) e payload tool. | error | provision | generale |
| `elevenlabs_schema_rejected` | Schema rifiutato dal provider | `fieldPath`, `detail` | Rimuovi campi non supportati dal fragment JSON o semplifica lo schema tool. | error | provision | generale |
| `provision_skipped_no_elevenlabs` | Nessun task ElevenLabs da provisionare | `flowId` | Verifica che almeno un nodo sia AI Agent con piattaforma ElevenLabs. | info | provision | generale |
| `tunnel_not_running` | Tunnel pubblico assente o non attivo | `expectedPublicBase` | Avvia il tunnel (ngrok) e assicurati che l’URL pubblico punti al backend Express. | error | proxy | generale |
| `dev_tunnel_misconfigured` | Mappa tunnel / URL errata | `localPort`, `mappedUrl` | Controlla la mappa dev-tunnel e l’URL usato dal webhook del tool. | warning | proxy | generale |
| `proxy_unreachable` | ApiServer (o upstream) non raggiungibile | `targetUrl`, `errorCode` | Verifica che ApiServer sia in esecuzione (es. porta 5000) e il proxy verso di esso. | error | proxy | generale |
| `express_unreachable` | Backend Express non raggiungibile | `baseUrl` | Avvia lo stack backend previsto e controlla firewall/porte. | error | proxy | generale |
| `session_not_found` | Sessione host non registrata | `conversationId`, `sessionAlias` | Esegui un run con `startAgent` e alias allineato al tool; dopo restart ApiServer rifai il run. | error | runtime_tool | generale |
| `conversation_id_mismatch` | ID conversazione incoerente | `toolConversationId`, `runtimeConversationId` | Allinea gli identificativi tra compile, provision e sessione orchestrator. | error | runtime_tool | generale |
| `internal_notify_failed` | Diagnostica non recapitata ad ApiServer | `httpStatus`, `conversationId` | Verifica segreto bridge, ApiServer attivo e sessione ancora valida. | warning | notify | generale |
| `webhook_auth_failed` | Autenticazione webhook rifiutata | `endpoint`, `httpStatus` | Controlla header, segreto interno e variabili d’ambiente lato backend. | error | runtime_tool | generale |
| `validation_rejected` | Body rifiutato dal backend | `endpoint`, `fieldPath`, `message` | Allinea tipi e nomi parametri all’OpenAPI (es. oggetti vs stringhe). | error | runtime_tool | generale |
| `query_constraints_wrong_type` | queryConstraints non valido | `receivedType` | Invia `queryConstraints` come oggetto JSON nel body, non come stringa. | error | runtime_tool | agenda_tool |
| `scope_missing` | Scope persistenza mancante | `conversationId`, `projectId`, `toolName` | Imposta scope coerente con la prima materializzazione / contratto Redis. | error | runtime_tool | generale |
| `redis_unavailable` | Cache non disponibile | `redisHost` | Avvia Redis e verifica l’endpoint di health configurato. | error | runtime_tool | generale |
| `agenda_fetch_failed` | Impossibile ottenere la sorgente agenda | `agendaUrl`, `httpStatus` | Verifica URL feed, rete e tipo agenda (`agenda.type`). | error | runtime_tool | agenda_tool |
| `horizon_missing_for_url` | Finestra date mancante per fetch URL | `agendaUrl` | Imposta `horizon` / `queryConstraints.horizon` per lo scarico da URL. | error | runtime_tool | agenda_tool |
| `snapshot_miss_followup` | Snapshot assente al follow-up | `persistenceKey` | Esegui prima una chiamata con sorgente dati o refresh adeguato. | warning | runtime_tool | generale |
| `tool_http_error` | Chiamata tool in errore HTTP | `endpoint`, `httpStatus`, `toolName` | Leggi il body di errore del backend e correggi parametri o disponibilità. | error | runtime_tool | generale |
| `tool_timeout` | Timeout sulla chiamata tool | `endpoint`, `timeoutMs` | Riduci payload, verifica latenza o timeout infrastrutturali. | error | runtime_tool | generale |
| `rate_limited` | Troppe richieste (provider/backend) | `provider`, `retryAfter` | Attendi o riduci frequenza; controlla quote API. | warning | runtime_tool | generale |

*Nota:* `query_constraints_wrong_type` resta legato al contratto BookFromAgenda ma è un esempio di validazione tipizzata; eventi analoghi per altri endpoint andrebbero aggiunti al registry con nomi dedicati se il messaggio backend è diverso.

---

## 2. Carte scoped (warning) — opzioni backend vs proposta agente

Definizione ampia condivisa:

> **“Opzione proposta non contenuta tra le opzioni disponibili fornite dal backend.”**

Si applica ogni volta che il backend restituisce un **insieme discreto** di scelte valide (slot temporali, SKU, ID documento, chiavi FAQ, ecc.). Il rilevamento è **euristico** e può generare falsi positivi: severity **`warning`**.

| Evento | Titolo carta (UI) | Campi obbligatori | Hint default (designer) | Severity | integrationStage | Applicabilità |
|--------|-------------------|-------------------|---------------------------|----------|------------------|---------------|
| `grounding_mismatch` | Opzione proposta non tra quelle disponibili | `proposedValue`, `availableOptionsSample`, `toolName` | Verifica che l’agente proponga solo valori inclusi nel JSON restituito dal backend. | warning | runtime_tool | generale; agenda_tool; catalog_tool; faq_tool |

**Linee guida implementative (non normative per il designer):**

- `availableOptionsSample`: sottoinsieme rappresentativo (non l’intero JSON), derivato dal campo del backend che enumera le scelte (es. lista slot, array di id prodotto, elenco titoli FAQ).
- `proposedValue`: valore estratto dal turno dell’agente da confrontare con quell’insieme (normalizzazione consigliata: date, maiuscole, trim).
- Stesso **evento** e stessa carta per agenda, catalogo, FAQ, KB: cambiano solo contesto tool e shape JSON, non il nome registry.

---

## 3. Carta scoped complementare — uso della risposta strutturata

Distinta da `grounding_mismatch`: qui il problema non è una singola opzione fuori lista, ma che **la risposta dell’agente non richiama affatto** il contenuto strutturato restituito dal tool (euristica più debole).

| Evento | Titolo carta (UI) | Campi obbligatori | Hint default (designer) | Severity | integrationStage | Applicabilità |
|--------|-------------------|-------------------|---------------------------|----------|------------------|---------------|
| `tool_payload_not_reflected` | Risposta agente senza riferimento al payload del tool | `toolName`, `payloadSummary`, `turnId` | Rafforza istruzioni di sistema: l’agente deve basarsi sull’ultimo output JSON del tool. | warning | runtime_tool | generale |

---

## 4. Registry e versionamento

- **Versione catalogo:** `v1` (questo documento).
- **Implementazione runtime (UI + inferenza):** `src/domain/observability/integrationObservationCatalog.ts` — titoli/hint allineati al registry; il debugger risolve le carte dalle invocazioni BackendCall (errori BookFromAgenda, HTTP, messaggi noti) e dalle diagnostiche webhook ConvAI (`unreachable` → tunnel). L’orchestratore può inviare **`catalogEvent`**, **`catalogHint`**, **`catalogFields`** nel payload SSE — hanno priorità sull’inferenza (camelCase o PascalCase). Eventi senza segnale ancora emesso restano solo in questa specifica.
- Nuovi eventi: solo aggiunta al registry con revisione documentata; **non** rinominare eventi già pubblicati senza deprecazione esplicita.

---

## Riferimenti

- Principi delega IA / ConfAI: `docs/PIATTAFORMA_IA_DELEGATION_GOVERNED.md`.
