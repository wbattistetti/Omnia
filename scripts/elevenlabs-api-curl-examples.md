# ElevenLabs API — comandi curl (smoke test)

Sostituisci `<API_KEY>` con `xi-api-key` dalla console ElevenLabs.  
Per **EU data residency** sostituisci l’host con `https://api.eu.residency.elevenlabs.io/v1` (stesso valore di `ELEVENLABS_API_BASE` nel backend Omnia).

## 1. Lista modelli LLM ConvAI

Omnia sync usa lo stesso endpoint (`backend/services/iaCatalog/catalogSync.js` → `GET {ELEVENLABS_API_BASE}/convai/llm/list`).

```bash
curl -sS -X GET "https://api.elevenlabs.io/v1/convai/llm/list" \
  -H "xi-api-key: <API_KEY>"
```

**Atteso:** JSON con `llms` o `models` (array di oggetti o stringhe).  
**401:** chiave errata o host errato (globale vs EU).  
**404:** path sbagliato (verifica `/v1` nella base).

## 2. Lista voci TTS

Omnia sync voci: `GET {ELEVENLABS_API_BASE}/voices`.

```bash
curl -sS -X GET "https://api.elevenlabs.io/v1/voices" \
  -H "xi-api-key: <API_KEY>"
```

**Interpretazione:** molte voci `premade` hanno `labels.language` assente → in catalogo Omnia diventano `language: "und"`. Il filtro UI lingua **Italiano** richiedeva match esatto su `it` in `VoicePicker` (ora usa `voiceMatchesLanguageTag`, che include `und`).

## 3. Diagnostica live dal backend Omnia

Con Express in ascolto (es. `3100`):

```bash
curl -sS "http://127.0.0.1:3100/api/ia-catalog/diagnostics/elevenlabs-live"
```

Restituisce `convaiLlmList` (HTTP, campioni id) senza esporre la chiave.

## 4. createAgent (ConvAI)

L’API ufficiale per creare un agente non è un POST minimale `prompt` + `llm`; Omnia usa **ApiServer** → `POST /elevenlabs/createAgent` con `conversation_config` (vedi `convaiAgentCreatePayload.ts` / VB `ElevenLabsEndpoints`).

Smoke **diretto** ElevenLabs (payload reale da documentazione ConvAI; adatta i campi):

```bash
curl -sS -X POST "https://api.elevenlabs.io/v1/convai/agents/create" \
  -H "xi-api-key: <API_KEY>" \
  -H "Content-Type: application/json" \
  -d "{\"conversation_config\":{\"agent\":{\"prompt\":{\"llm\":\"eleven_flash_v2_5\",\"prompt\":\"test\"},\"language\":\"it\"}}}}"
```

**Modello valido (non‑EN):** tipicamente `eleven_flash_v2_5` o `eleven_turbo_v2` (messaggio errore ElevenLabs: *Non-english Agents must use turbo or flash v2_5*).

**Modello non valido (esempio):** `gpt-4-turbo` nel campo `prompt.llm` → errore di validazione ConvAI.

## 5. Salvataggio `config/llmMapping.json` da UI

Il `POST /api/ia-catalog/ui/llm-mapping` è consentito solo se nel processo Node è impostato:

`OMNIA_WRITABLE_CONFIG=1`

Altrimenti risposta **403** `WRITE_DISABLED`.
