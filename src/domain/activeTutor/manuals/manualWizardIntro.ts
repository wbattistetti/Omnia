/**
 * Active Tutor — introduzione wizard e meta (condiviso tra le fasi).
 */

export const MANUAL_WIZARD_INTRO = `
# MANUALE OMNIA DESIGNER — WIZARD DI COSTRUZIONE AGENTE (v2)

## Introduzione
Omnia guida il designer non tecnico nella costruzione di un agente conversazionale in 5 fasi:
1. **Task** — cosa deve fare l'agente (descrizione + sezioni strutturate)
2. **Prompts** — use case, conversazioni, compilazione prompt/JSON, stile conversazionale
3. **Backend** — azioni API + Knowledge Base documenti + Interface agente
4. **Dati** — slot e campi dedotti dai dialoghi
5. **Voce** — configurazione TTS/runtime IA (es. ElevenLabs ConvAI)

Ordine ufficiale stepper: **Task → Prompts → Backend → Dati → Voce**.

## Stepper (barra passi in alto)
- Cinque bottoni numerati: Task, Prompts, Backend, Dati, Voce.
- Stato visivo: ✅ completato, ? da completare, 🔒 bloccato se i passi precedenti mancano (gating soft; in review si può bypassare).
- Sul passo **Backend**: toggle aggiuntivi **Knowledge Base** e **Interface**.
- Sul passo **Prompts**: toggle **Error handling**.
- Icona **Costi** ($): pannello stima costi IA — non è una fase wizard.

## Tutor attivo (pannello destro)
- Barra tab interna: **[TASK] [PROMPTS] [BACKEND] [DATI] [VOCE]** — una conversazione separata per fase.
- Click tab Tutor ↔ sincronizza stepper wizard (bidirezionale).
- Il Tutor risponde **SOLO** in base a questo manuale; se l'informazione non c'è, lo dice esplicitamente.
- **Conferma fase**: bottone «Conferma fase …» nel pannello Tutor quando lo stato è ai_completed o iterating — **non** esiste «Conferma Task» nel canvas centrale.
- Tab Tutor sempre cliccabili; fase incompleta → avviso ma nessun blocco.
- Durante elaborazione AI (waiting_for_ai): Tutor silenzioso, input disabilitato.
- Domande libere: il Tutor classifica keyword e può rispondere nella tab della fase rilevata anche se sei su un'altra tab.

## Macchina a stati (per ogni fase, indipendente)
Stati: idle → waiting_for_ai → ai_completed → iterating → awaiting_confirmation → completed.
- **waiting_for_ai**: click su bottone IA (Create Agent, Genera use case, Recupera specifiche, Analisi documento, …).
- **ai_completed / iterating**: risultato IA pronto; designer rivede e può iterare.
- **completed**: fase confermata al Tutor.

## Completamento step (regole stepper)
- **Task ✅**: descrizione non vuota.
- **Prompts ✅**: almeno 1 use case **e** almeno 1 conversazione.
- **Backend, Dati, Voce**: navigabili (soft gate); conviene configurarli comunque.

## Attenzione visiva (glow/lampeggio)
Il Tutor evidenzia controlli reali via registry UI_IDS: campo descrizione Task, lista use case, lista backend, tabella dati, pannello voce, ecc.
`;

export const MANUAL_TUTOR_FAQ = `
## FAQ generali
- Puoi tornare indietro e modificare qualsiasi fase in qualsiasi ordine.
- Puoi correggere prima di confermare una fase al Tutor.
- Durante elaborazione AI: attendi; il Tutor non disturba.
- Nomi UI reali spesso in inglese dove il prodotto li mostra così: «Create Agent», «Add backend», «Test API».
- Non serve essere tecnici: segui i bottoni visibili e chiedi al Tutor cosa fare dopo.
`;
