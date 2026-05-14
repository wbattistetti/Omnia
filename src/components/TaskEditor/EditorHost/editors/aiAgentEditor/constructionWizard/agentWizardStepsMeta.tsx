/**
 * AI Agent — Metadati statici dei 5 step del wizard di costruzione.
 *
 * Single source per: etichette UI, icona, descrizione tutorial breve. Disaccoppia la
 * presentazione dalla logica (regole di completamento in `agentWizardStepCompletion.ts`,
 * tipi in `agentConstructionPhase.ts`).
 */

import {
  ClipboardList,
  Database,
  MessagesSquare,
  Mic,
  PlugZap,
  type LucideIcon,
} from 'lucide-react';
import type { AgentWizardStepIndex } from '@domain/aiAgentConstruction/agentConstructionPhase';

export interface AgentWizardStepMeta {
  readonly index: AgentWizardStepIndex;
  /** Numero visivo «1..5» mostrato all'utente. Sempre `index + 1`. */
  readonly displayNumber: number;
  /** Etichetta breve del bottone stepper (≤ 12 caratteri ideale). */
  readonly label: string;
  /** Titolo lungo della vista (header dello step). */
  readonly title: string;
  /** Tutorial breve (1 frase) mostrato in cima alla vista dello step. */
  readonly tutorial: string;
  /** Icona Lucide associata allo step (anche nella schermata di benvenuto). */
  readonly icon: LucideIcon;
}

/**
 * Ordine UFFICIALE (post-riordino):
 *   1) Task     2) Prompts     3) Backend     4) Dati     5) Voce
 *
 * Il vecchio ordine aveva «Backend» al 2° posto e «Conversazione» al 3°: lo step
 * sui prompt arriva ora subito dopo la descrizione del task perch\u00e9 \u00e8 quello che
 * forma davvero l\u2019identit\u00e0 conversazionale dell\u2019agente. I `displayNumber` e
 * gli `index` rispecchiano l\u2019ordine in array; `STEP_COMPLETION_RULES` in
 * `agentWizardStepCompletion.ts` segue lo stesso allineamento posizionale.
 */
export const AGENT_WIZARD_STEPS_META: readonly AgentWizardStepMeta[] = [
  {
    index: 0,
    displayNumber: 1,
    label: 'Task',
    title: 'Descrivi il task',
    /**
     * Volutamente vuoto: il placeholder dettagliato della textarea sottostante
     * (`AI_AGENT_TASK_DESCRIPTION_PLACEHOLDER`) gi\u00e0 contiene una guida estesa con
     * obiettivo, regole, tono ecc. Avere anche un tutorial header sarebbe duplicazione.
     */
    tutorial: '',
    icon: ClipboardList,
  },
  {
    index: 1,
    displayNumber: 2,
    label: 'Prompts',
    title: 'Definisci lo stile conversazionale',
    /**
     * Volutamente vuoto: l\u2019header tutorial sotto il titolo \u00e8 stato eliminato su
     * richiesta esplicita (Img 1, mag 2026). Il sub-wizard del passo (lista use case
     * + bubble conversazioni + JSON) ha gi\u00e0 i propri label contestuali e non serve
     * una riga di guida ridondante.
     */
    tutorial: '',
    icon: MessagesSquare,
  },
  {
    index: 2,
    displayNumber: 3,
    label: 'Backend',
    title: 'Definisci i backend',
    tutorial:
      'Dichiara gli strumenti (API/backend) che l\u2019agente potr\u00e0 chiamare. Puoi saltare questo passo se l\u2019agente \u00e8 puramente conversazionale.',
    icon: PlugZap,
  },
  {
    index: 3,
    displayNumber: 4,
    label: 'Dati',
    title: 'Rivedi i dati raccolti',
    tutorial:
      'Controlla gli slot dedotti dai dialoghi. Ogni slot mostra la sua provenienza (use case di origine) per facilitare la verifica.',
    icon: Database,
  },
  {
    index: 4,
    displayNumber: 5,
    label: 'Voce',
    title: 'Scegli la voce',
    tutorial:
      'Seleziona la voce TTS dell\u2019agente. Una voce di default \u00e8 gi\u00e0 precaricata: cambiala se vuoi personalizzare.',
    icon: Mic,
  },
] as const;

/** Lookup O(1) di un meta dal suo indice. */
export function getAgentWizardStepMeta(index: AgentWizardStepIndex): AgentWizardStepMeta {
  return AGENT_WIZARD_STEPS_META[index];
}
