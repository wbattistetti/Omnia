/**
 * AI Agent — Metadati statici dei 7 step del wizard di costruzione.
 *
 * Ordine vincolante: Task → KB → Backend → Prompts → Error Handling → Dati → Voce
 */

import {
  BookOpen,
  ClipboardList,
  Database,
  MessagesSquare,
  Mic,
  PlugZap,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import type { AgentWizardStepIndex } from '@domain/aiAgentConstruction/agentConstructionPhase';

export interface AgentWizardStepMeta {
  readonly index: AgentWizardStepIndex;
  readonly displayNumber: number;
  readonly label: string;
  readonly title: string;
  readonly tutorial: string;
  readonly icon: LucideIcon;
}

export const AGENT_WIZARD_STEPS_META: readonly AgentWizardStepMeta[] = [
  {
    index: 0,
    displayNumber: 1,
    label: 'Task',
    title: 'Descrivi il task',
    tutorial: '',
    icon: ClipboardList,
  },
  {
    index: 1,
    displayNumber: 2,
    label: 'Knowledge Base',
    title: 'Documenti e conoscenza',
    tutorial:
      'Carica documenti (.txt, .csv, .xlsx) collegati al task. L\'analisi markdown arricchisce il contesto dell\'agente.',
    icon: BookOpen,
  },
  {
    index: 2,
    displayNumber: 3,
    label: 'Backend',
    title: 'Definisci i backend',
    tutorial: '',
    icon: PlugZap,
  },
  {
    index: 3,
    displayNumber: 4,
    label: 'Prompts',
    title: 'Definisci lo stile conversazionale',
    tutorial:
      'Use case, regole di attivazione (chip) e pannello Dialog control per slot mapping e variabili di snodo.',
    icon: MessagesSquare,
  },
  {
    index: 4,
    displayNumber: 5,
    label: 'Error Handling',
    title: 'Regole conversazionali trasversali',
    tutorial:
      'Definisci regole di error handling e comportamenti speciali che valgono su più use case.',
    icon: ShieldAlert,
  },
  {
    index: 5,
    displayNumber: 6,
    label: 'Dati',
    title: 'Rivedi i dati raccolti',
    tutorial:
      'Controlla gli slot dedotti dai dialoghi. Ogni slot mostra la sua provenienza per facilitare la verifica.',
    icon: Database,
  },
  {
    index: 6,
    displayNumber: 7,
    label: 'Voce',
    title: 'Scegli la voce',
    tutorial:
      'Seleziona la voce TTS dell\'agente. Una voce di default è già precaricata: cambiala se vuoi personalizzare.',
    icon: Mic,
  },
] as const;

export function getAgentWizardStepMeta(index: AgentWizardStepIndex): AgentWizardStepMeta {
  return AGENT_WIZARD_STEPS_META[index];
}
