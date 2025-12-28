// ✅ UNIFICATO: Usa TaskType enum invece di HeuristicType/InternalType
import { TaskType } from '../../types/taskTypes';

// ❌ ELIMINATO: HeuristicType e InternalType - ora usiamo TaskType enum

export type Lang = 'IT' | 'EN' | 'PT';

// ✅ RuleSet mantiene i nomi legacy per compatibilità con il database
// I pattern nel database usano ancora 'MESSAGE', 'REQUEST_DATA', ecc.
export type RuleSet = {
  AI_AGENT: RegExp[];
  MESSAGE: RegExp[];
  REQUEST_DATA: RegExp[];
  PROBLEM: RegExp | null; // Può essere null se non esiste un pattern valido
  PROBLEM_SPEC_DIRECT: RegExp[];
  // Phrases that express the "reason of the call/contact" etc.
  PROBLEM_REASON?: RegExp[];
  SUMMARY: RegExp[];
  BACKEND_CALL: RegExp[];
  NEGOTIATION: RegExp[];
};

// ✅ Inference ora usa TaskType enum
export type Inference = {
  type: TaskType;  // ✅ Ora è TaskType enum, non HeuristicType string
  lang?: Lang;
  reason?: string;
};

export type InferOptions = {
  languageOrder?: Lang[];
};


