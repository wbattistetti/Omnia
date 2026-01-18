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
  // ✅ Pattern per inferire la categoria semantica (compilati in RegExp)
  CATEGORY_PATTERNS?: CompiledCategoryPattern[];
};

// ✅ Tipo per pattern di inferenza categoria (pattern originale)
export type CategoryPattern = {
  pattern: string; // Regex pattern come stringa
  category: string; // ID categoria (es. 'problem-classification', 'choice', 'confirmation')
};

// ✅ Tipo per pattern compilato (usato in cache)
export type CompiledCategoryPattern = {
  pattern: RegExp; // Regex pattern compilato
  category: string; // ID categoria
  originalPattern: string; // Pattern originale (per logging/debug)
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

