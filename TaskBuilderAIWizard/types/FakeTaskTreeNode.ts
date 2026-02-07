import { FakeConstraint } from './FakeConstraint';
import { FakeNLPContract } from './FakeNLPContract';

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
export type FakeTaskTreeNode = {
  id: string;
  templateId: string;
  label: string;
  type?: string;
  icon?: string;

  // Dati generati dalla pipeline
  constraints?: FakeConstraint[];
  dataContract?: FakeNLPContract;

  // Stato di esecuzione della pipeline per questo task
  pipelineStatus?: TaskPipelineStatus;

  // Subtask (es: Data di nascita -> Giorno, Mese, Anno)
  subNodes?: FakeTaskTreeNode[];
};
