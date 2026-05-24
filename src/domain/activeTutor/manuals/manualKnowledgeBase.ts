/**
 * Active Tutor — manuale fase Knowledge Base (wizard step 1).
 */

export const MANUAL_KNOWLEDGE_BASE = `
## FASE 2 — KNOWLEDGE BASE (step wizard 1)

### Scopo
Caricare documenti sul task (.txt, .xlsx, .pdf, …) e arricchire il contesto dell'agente con analisi markdown e variabili da colonne tabellari.

### Componenti interfaccia
- **Pannello Knowledge Base** (data-tutor-id knowledge-base-panel): vista principale dello step.
- **Lista documenti** (data-tutor-id kb-document-list): elenco file caricati, riordino, rimozione.
- **Analisi documento**: seleziona un file → l'IA produce riassunto markdown (data-tutor-id kb-analysis-result).

### Azioni
1. Apri lo step **Knowledge Base** nello stepper wizard (passo 2/7).
2. Trascina o seleziona file (.txt, .xlsx, …).
3. Seleziona un documento e avvia **Analisi documento** per ottenere il markdown strutturato.
4. I documenti restano nel repository progetto; l'analisi resta sul task.

### Errori comuni
- Caricare documenti enormi senza verificare l'analisi → controlla sempre il riassunto.
- Confondere KB con Backend: KB è uno step dedicato, non un toggle sul Backend.

### FAQ
- «Dove carico i PDF?» → Step Knowledge Base, pulsante aggiungi file nel pannello documenti.
- «Serve per generare use case?» → Sì, la generazione bundle Prompts può usare Task + KB + Backend.

### UI_IDS rilevanti
- knowledge-base-panel, kb-document-list, kb-analysis-result, wizard-step-1
`;
