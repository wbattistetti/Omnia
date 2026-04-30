# Omnia — Delega a agenti IA esterni, confinata nel flusso deterministico

Questo documento descrive la logica **già codificata** con cui Omnia consente di **affidare turni di dialogo** a modelli o piattaforme esterne (LLM, agenti conversazionali, voci) **senza** fare del flusso un unico blocco non deterministico: il **grafo e il motore** restano la spina deterministica; l’IA esterna opera **solo dentro** i passi e i contratti previsti (payload, stato, uscita).

*Nota di allineamento richieste prodotto:* in repository **non** compare un connettore dedicato a “Google Apps” come prodotto distinto; i canali documentabili dal codice sono i **task `AIAgent`**, la **configurazione runtime per piattaforma** (incluso `google` per aspetti di modello/UX lato setup), **ElevenLabs / ConvAI**, e il **bridge HTTP** verso un LLM con **schema di risposta vincolato**. Eventuali estensioni verso ecosistemi enterprise (Workspace, automazioni) si appoggiano a questi confini o a integrazioni future esplicite.

---

## 1. Principio: deterministico al perimetro, stocastico solo “in vetrina”

- **Deterministico (Omnia):** quale **nodo** / **task** è attivo, le **transizioni** del flow, l’ordine **DDT / subflow**, quando un passo `AIAgent` **inizia** e quando il motore considera il passo **completato** e **esce** verso il resto del flusso.
- **Non deterministico (provider esterno):** il contenuto del turno generato dal modello o dall’agente cloud (testo, aggiornamento dello stato interno al passo) **entro** i vincoli del contratto sotto.
- **Confinamento:** le regole di business del passo agente sono **compilate** come testo di regole e iniettate nello stato; la risposta del modello deve rispettare un **formato JSON** fissato (`new_state`, `assistant_message`, `status`) così l’orchestrazione può **proseguire in modo controllato**.

---

## 2. Task `AIAgent` e compilazione

- Tipo di task: `TaskType.AIAgent` (vedi `src/types/taskTypes.ts` e `VBNET/Shared/TaskTypes.vb`).
- In compilazione, il task diventa un `CompiledAIAgentTask` con campi come `Platform`, `Rules`, `LlmEndpoint`, per ElevenLabs `AgentId`, `BackendBaseUrl`, `DynamicVariables` (vedi `VBNET/Compiler/DTO/Runtime/CompiledTask.vb` — `CompiledAIAgentTask`).

L’orchestratore del motore invoca l’executor dedicato (es. `FlowOrchestrator` → `AIAgentTaskExecutor` in `VBNET/Engine/TaskExecutors/AIAgentTaskExecutor.vb`).

---

## 3. Due rami di runtime (stesso concetto di “delega confinata”)

### 3.1 Ramo “LLM via HTTP” (bridge Node + contract JSON)

- L’executor VB.NET costruisce un payload con `state` e `user_message` e inietta le **regole compilate** sotto la chiave **`__omnia_runtime_rules`** nello state (costante allineata a `AIAgentRuntimeBridgeService.js` e `AIAgentTaskExecutor.RuntimeRulesStateKey`).
- Il backend Node (`backend/services/AIAgentRuntimeBridgeService.js`) invoca un provider (es. Groq/OpenAI secondo `resolveProvider`) con:
  - un **system prompt di runtime** che obbliga **solo JSON** con chiavi `new_state`, `assistant_message`, `status` (`in_progress` | `completed`);
  - validazione stratta del JSON restituito (`validateLlmPayload`).
- **Effetto:** il modello esterno è “libero” nel linguaggio naturale del messaggio e nell’aggiornamento dello **stato del task**, ma **non** può uscire dal contratto senza errore; `status: completed` è il segnale con cui il **motore deterministico** può lasciare il nodo.

### 3.2 Ramo ElevenLabs (ConvAI) — agente esterno, ancora ancorato a Omnia

- `AIAgentTaskExecutor` descrive il percorso **ElevenLabs**: conversazione/conversazione ID, bridge HTTP sull’ApiServer (`/elevenlabs/*`), base URL risolvibile da task o da env (`OMNIA_API_PUBLIC_BASE_URL`).
- Lato UI e compile, `ensureConvaiAgentsProvisioned` e i servizi di **provisioning** allineano un agente cloud al **task** (identità per `taskId` / payload ConvAI) — vedi `src/components/DialogueEngine/ensureConvaiAgentsProvisioned.ts` e `src/utils/iaAgentRuntime/convaiAgentCreatePayload.ts`.
- La **configurazione runtime** unificata (`IAAgentConfig` in `src/types/iaAgentRuntimeSetup.ts`) supporta `platform: 'elevenlabs'` con voce, TTS, workflow ConvAI, ecc.; il progetto può vincolare **quali modelli LLM** sono ammessi per lingua (es. mapping progetto ↔ ElevenLabs, test in `src/utils/iaAgentRuntime/__tests__/omniaProjectElevenLabsLlmMapping.test.ts`, inclusi modelli **Gemini** nominati come **allowlist** sul canale ElevenLabs).

Questo è il modo in cui “**modelli Google / cataloghi esterni**” entrano nel sistema **oggi**: tipicamente come **model id** selezionabile nel perimetro ElevenLabs + policy progetto, non come flusso arbitrario fuori dal task.

### 3.3 Piattaforme nel setup IA (`IAAgentPlatform`)

In `src/types/iaAgentRuntimeSetup.ts` le piattaforme esposte sono: **`elevenlabs`**, **`openai`**, **`anthropic`**, **`google`**, **`custom`**.  
`platformHelpers.ts` definisce campi visibili per ciascuna (es. per `google`: `top_p`, `safety_settings`, ecc.). La **governance** resta: un **task** per volta, **config** persistita e **errori di compile** se la config non è coerente (vedi `src/domain/compileErrors/collectIaAgentRuntimeCompileErrors.ts` per errori su task `AIAgent` e provisioning).

---

## 4. Cosa resta “non deterministico” e cosa no

| Aspetto | Comportamento |
|--------|----------------|
| **Ordine dei passi nel flow** | Determinato dal modello di flusso / TaskTree / orchestratore. |
| **Scelta del nodo `AIAgent`** | Il grafo decide **quando** delegare. |
| **Testo e micro-stato del turno IA** | Stocastici (LLM / agente cloud). |
| **Uscita dal nodo** | Vincolata: `status` e regole; altrimenti errori o retry lato implementazione. |
| **Conformità config (chiavi API, agent id, voci)** | Validazioni e errori di compilazione/provisioning dove previsto. |

---

## 5. Rapporto con la pipeline di design strutturato

Il backend (`StructuredDesignPipelineService.js`, vedi commento in testa al file) separa **estrazione LLM → IR** da **compilazione deterministica** per il design dell’agente. È un’analogia di filosofia: **l’LLM non è l’unica fonte di verità del programma**; qui il **programma** è il flow compilato, e l’IA esterna esegue **sotto-contratto** sul singolo task.

---

## 6. Riferimenti file (per audit tecnico)

| Area | File |
|------|------|
| Bridge runtime LLM + JSON contract | `backend/services/AIAgentRuntimeBridgeService.js` |
| Executor VB.NET, chiave rules, payload | `VBNET/Engine/TaskExecutors/AIAgentTaskExecutor.vb` |
| DTO compilato `CompiledAIAgentTask` | `VBNET/Compiler/DTO/Runtime/CompiledTask.vb` |
| Tipo piattaforme e config runtime | `src/types/iaAgentRuntimeSetup.ts`, `src/utils/iaAgentRuntime/platformHelpers.ts` |
| Merge config task | `src/utils/iaAgentRuntime/resolveTaskIaConfig.ts` |
| Errori compile IA / provisioning | `src/domain/compileErrors/collectIaAgentRuntimeCompileErrors.ts` |
| Provisioning ConvAI / ElevenLabs | `src/components/DialogueEngine/ensureConvaiAgentsProvisioned.ts` |
| Endpoint bridge documentato in server | `backend/server.js` (handler `runAIAgentRuntimeStep` / VB bridge) |

---

*Aggiornare questo documento quando cambiano il contratto JSON del bridge, le piattaforme in `IAAgentPlatform`, o il percorso ElevenLabs.*
