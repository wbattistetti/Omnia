/**

 * Active Tutor — manuale fase Voce (wizard step 4).

 */



export const MANUAL_VOCE = `

## FASE 7 — VOCE (step wizard 6)



### Scopo

Configurare **voce TTS**, **runtime IA** e parametri agente (piattaforma, system prompt runtime, tool, modello LLM) quando l'agente è usato in modalità vocale — es. **ElevenLabs ConvAI**.



Titolo stepper: **Scegli la voce**.



### Componenti interfaccia

- **IAAgentSetup** (pannello principale Agent setup, data-tutor-id voce-editor):

  - Configurazione override **per questo task agente** (non solo globale).

  - Tab/pill **Piattaforma**: ElevenLabs, OpenAI, Gemini, Anthropic, … — determina campi visibili.

- **Voce TTS**:

  - Selezione voce per piattaforma.

  - Una **voce default è già precaricata** — cambiala per personalizzare.

  - Modello TTS se applicabile (es. ElevenLabs).

- **Runtime agente** (dipende da piattaforma):

  - System prompt runtime (override rispetto al Task design-time).

  - Modello LLM, max tokens, endpoint.

  - Lingua agente.

  - Tool/backend inclusi (ElevenLabs: tool derivati da backend catalogo manuale).

- **Salva** (bottone esplicito header pannello):

  - Persiste agentIaRuntimeOverrideJson su DB — sopravvive senza save progetto completo.

  - Stati indicatore: idle, ● Modifiche non salvate (dirty), saving, saved, error.

  - **Obbligatorio** dopo modifiche prima di uscire o deploy.

- **Provisioning ConvAI** (ElevenLabs):

  - Creazione/aggiornamento agente remoto ElevenLabs quando applicabile.

  - Flag elevenLabsNeedsReprovision se cambi voce/modello TTS.

  - Binding sessione agente ConvAI.

- **Conferma fase Voce**: pannello Tutor — distinta da Salva (Salva = persistenza tecnica; Conferma = approvazione fase design).



### Tutorial ufficiale step

«Seleziona la voce TTS dell'agente. Una voce di default è già precaricata: cambiala se vuoi personalizzare.»



### Flusso consigliato

1. Apri passo **Voce** nello stepper.

2. Verifica **piattaforma target** (ElevenLabs per deploy vocale ConvAI).

3. Scegli **voce** adatta al tono definito nel Task (formale vs cordiale).

4. Regola parametri visibili: LLM, system prompt runtime, tool backend se ElevenLabs.

5. Clicca **Salva** e attendi conferma saved.

6. Opzionale: provisioning/anteprima piattaforma (ConvAI create agent).

7. Verifica coerenza con menu **Deploy** in header wizard se previsto.

8. Conferma al Tutor.



### Logica Tutor — Voce

- Ingresso: «Qui definisci la voce e il comportamento vocale dell'agente.»

- Non configurato / default: «Scegli una voce adatta al tono del Task. Ricorda di Salva dopo le modifiche.»

- Configurato (dirty): «Hai modifiche non salvate — clicca Salva nel pannello setup.»

- Configurato (saved): «Puoi regolare voce e parametri runtime; Conferma fase Voce al Tutor quando pronto.»

- Attenzione UI: pannello setup voce/runtime (voce-editor).



### Cosa controllare

- Tono voce coerente con Task (formale vs cordiale vs ironico)

- Piattaforma allineata al deploy previsto (Deploy menu vs setup Voce)

- Tool/backend inclusi se l'agente deve agire in vocale (ElevenLabs)

- System prompt runtime coerente con Prompts e Task

- Configurazione **Salva**ta (indicatore saved, non dirty)

- Re-provisioning ConvAI se cambi voce/modello TTS



### Errori comuni

- Confondere voce TTS con «tono» testuale del Task (collegati ma distinti: Task = design, Voce = runtime TTS)

- Dimenticare **Salva** dopo modifiche (● Modifiche non salvate)

- Piattaforma voce diversa da quella di deploy nel menu Deploy

- Cercare un unico bottone «Test voce» — anteprima dipende dalla piattaforma integrata in IAAgentSetup

- Confermare fase Voce al Tutor senza aver salvato la configurazione

- Non includere tool backend in ConvAI quando gli use case invocano API

`;


