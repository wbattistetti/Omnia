import { WizardConstraint } from './WizardConstraint';
import type { DataContract } from '@components/DialogueDataEngine/contracts/contractLoader';

/**
 * Stato di esecuzione della pipeline per un singolo task
 * Ogni task attraversa queste fasi in parallelo con gli altri task
 */
export type TaskPipelineStatus = {
  constraints: 'pending' | 'running' | 'completed' | 'failed';
  parser: 'pending' | 'running' | 'completed' | 'failed';
  messages: 'pending' | 'running' | 'completed' | 'failed';
  constraintsProgress?: number;
  parserProgress?: number;
  messagesProgress?: number;
};

/**
 * Nodo dell'albero gerarchico dei task
 * Ogni nodo può avere subtask e ciascuno ha il proprio stato di pipeline
 */
export type WizardTaskTreeNode = {
  id: string;
  templateId: string;
  label: string; // ✅ Pure text (no emoji) - used in contracts sent to backend
  type?: string;
  emoji?: string; // ✅ Emoji as separate field (UI-only) - e.g. "📅", "👤", "📍"

  // ✅ NUOVO: Variabili (generati da VariableNameGeneratorService)
  readableName?: string;      // Nome completo variabile (es: "Data di nascita del paziente")
  dottedName?: string;        // Nome gerarchico (es: "Data di nascita del paziente.Giorno")
  taskId?: string;            // Task ID (used for variable creation in VariableCreationService)
  variableRefId?: string;     // Stable promised variable GUID reused as VariableInstance.varId

  // ✅ NEW: Generalization fields (solo sul nodo root)
  shouldBeGeneral?: boolean;
  generalizedLabel?: string | null;
  generalizationReason?: string | null;
  generalizedMessages?: string[] | null;

  // Dati generati dalla pipeline
  constraints?: WizardConstraint[];
  dataContract?: DataContract;

  // Stato di esecuzione della pipeline per questo task
  pipelineStatus?: TaskPipelineStatus;

  // Subtask (es: Data di nascita -> Giorno, Mese, Anno)
  subNodes?: WizardTaskTreeNode[];
};
