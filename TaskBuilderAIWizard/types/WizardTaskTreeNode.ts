import { WizardConstraint } from './WizardConstraint';
import { WizardNLPContract } from './WizardNLPContract';

/**
 * Stato di esecuzione della pipeline per un singolo task
 * Ogni task attraversa queste fasi in parallelo con gli altri task
 */
export type TaskPipelineStatus = {
  constraints: 'pending' | 'running' | 'completed';
  parser: 'pending' | 'running' | 'completed';
  messages: 'pending' | 'running' | 'completed';
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
  label: string;
  type?: string;
  icon?: string;

  // ✅ NUOVO: Variabili (generati da VariableNameGeneratorService)
  readableName?: string;      // Nome completo variabile (es: "Data di nascita del paziente")
  dottedName?: string;        // Nome gerarchico (es: "Data di nascita del paziente.Giorno")
  taskId?: string;            // Task ID (per mapping variabili in FlowchartVariablesService)

  // Dati generati dalla pipeline
  constraints?: WizardConstraint[];
  dataContract?: WizardNLPContract;

  // Stato di esecuzione della pipeline per questo task
  pipelineStatus?: TaskPipelineStatus;

  // Subtask (es: Data di nascita -> Giorno, Mese, Anno)
  subNodes?: WizardTaskTreeNode[];
};
