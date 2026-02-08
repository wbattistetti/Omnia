// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { generateConditionWithAI, suggestConditionCases, normalizePseudoCode, repairCondition } from '@services/ai/groq';
import { parseTemplate, fixDateAliases } from '../domain/scriptDomain';
import { synthesizeDateVariables } from '../domain/scriptDomain';
import type { CaseRow } from '../ConditionTester';

export interface GenerateConditionParams {
  nlText: string;
  variables: string[];
  selectedVars: string[];
  variablesFlatWithPreference: string[];
  titleValue: string;
  duplicateGroups: Array<{ tail: string; options: string[] }>;
  preferredVarByTail: Record<string, string>;
  variablesUsedInScript: string[];
}

export interface GenerateConditionResult {
  script: string;
  label?: string;
  question?: string;
  testRows?: CaseRow[];
  testerHints?: {
    hintTrue?: string;
    hintFalse?: string;
    labelTrue?: string;
    labelFalse?: string;
  };
  pendingDupGroups?: Array<{ tail: string; options: string[] }> | null;
}

export interface NormalizePseudoCodeParams {
  script: string;
  currentCode: string;
  variables: string[];
  label: string;
  provider?: any;
}

export interface RepairConditionParams {
  script: string;
  failures: any[];
  variables: string[];
  provider?: any;
}

/**
 * Service for AI-related operations in Condition Editor.
 * Encapsulates all AI calls (generate, normalize, repair, suggest test cases).
 */
export class ConditionAIService {
  /**
   * Generates a condition script from natural language description.
   * Handles template parsing, duplicate variable selection, and fallback generation.
   */
  async generateCondition(params: GenerateConditionParams): Promise<GenerateConditionResult> {
    const {
      nlText,
      variablesFlatWithPreference,
      selectedVars,
      titleValue,
      duplicateGroups,
      preferredVarByTail,
      variablesUsedInScript,
    } = params;

    // Parse template
    const parsed = parseTemplate(nlText);

    if (!parsed.when) {
      // If user wrote any non-empty line after the second comment, still proceed using entire editor content as pseudo
      const hasAnyContent = /\S/.test(nlText.replace(/^\s*\/\/[^\n]*$/gm, ''));
      if (!hasAnyContent) {
        return {
          script: '',
          question: 'Compila la sezione sotto: "Descrivi qui sotto in modo dettagliato quando la condizione è true".',
        };
      }
      parsed.when = nlText.trim();
    }

    // Check for duplicate variable groups
    const nlNorm = parsed.when.toLowerCase();
    const relevant = duplicateGroups.filter(g => {
      const tailText = g.tail.split('.').slice(-2).join(' ').toLowerCase();
      return nlNorm.includes(tailText) || nlNorm.includes(g.tail.toLowerCase());
    });
    const missingChoice = relevant.filter(g => !preferredVarByTail[g.tail]);

    if (relevant.length > 0 && missingChoice.length > 0) {
      return {
        script: '',
        question: 'Seleziona la variabile corretta per la condizione.',
        pendingDupGroups: relevant,
      };
    }

    try {
      // 1) Try normalize pseudo+chat+current code into clean JS
      try {
        const allowedVars = (parsed.vars && parsed.vars.length > 0)
          ? parsed.vars
          : ((selectedVars && selectedVars.length > 0) ? selectedVars : variablesFlatWithPreference);

        const norm = await normalizePseudoCode({
          chat: [] as any,
          pseudo: parsed.when || '',
          currentCode: '',
          variables: allowedVars,
          mode: 'predicate',
          provider: (window as any).__AI_PROVIDER || undefined,
          label: parsed.label || titleValue
        });

        const candidate = (norm as any)?.script;
        if (candidate && typeof candidate === 'string' && candidate.trim()) {
          return {
            script: candidate,
            label: parsed.label,
          };
        }
      } catch (e) {
        // Fall through to fallback
      }

      // 2) Fallback to previous condition generator
      const varsForAI = (selectedVars && selectedVars.length > 0) ? selectedVars : variablesFlatWithPreference;
      const varsList = (varsForAI || []).map(v => `- ${v}`).join('\n');
      const guidance = `${nlText}\n\nConstraints:\n- Use EXACTLY these variable keys when reading input; do not invent or rename keys.\n${varsList}\n- Access variables strictly as vars["<key>"] (no dot access).\n- Return a boolean (predicate).\n\nPlease return well-formatted JavaScript for function main(ctx) with detailed inline comments explaining each step and rationale. Use clear variable names, add section headers, and ensure readability (one statement per line).`;

      const out = await generateConditionWithAI(guidance, varsForAI);
      const aiLabel = (out as any)?.label as string | undefined;
      const aiScript = (out as any)?.script as string | undefined;
      const question = (out as any)?.question as string | undefined;

      if (question && !aiScript) {
        return {
          script: '',
          question,
        };
      }

      let nextScript = aiScript || 'try { return false; } catch { return false; }';
      nextScript = fixDateAliases(nextScript, varsForAI || []);

      // Generate test cases
      let testRows: CaseRow[] = [];
      let testerHints: GenerateConditionResult['testerHints'] = {};

      try {
        const cases = await suggestConditionCases(nlText, varsForAI);
        if (cases.trueCase) {
          testRows.push({
            id: String(Math.random()),
            label: 'true',
            vars: synthesizeDateVariables(cases.trueCase, variablesUsedInScript) || cases.trueCase
          });
        }
        if (cases.falseCase) {
          testRows.push({
            id: String(Math.random()),
            label: 'false',
            vars: synthesizeDateVariables(cases.falseCase, variablesUsedInScript) || cases.falseCase
          });
        }
        testerHints = {
          hintTrue: (cases as any).hintTrue,
          hintFalse: (cases as any).hintFalse,
          labelTrue: (cases as any).labelTrue,
          labelFalse: (cases as any).labelFalse,
        };
      } catch {}

      return {
        script: nextScript,
        label: aiLabel,
        testRows: testRows.length > 0 ? testRows : undefined,
        testerHints: Object.keys(testerHints).length > 0 ? testerHints : undefined,
      };
    } catch (e) {
      const msg = String((e as any)?.message || '').toLowerCase();
      let errorMessage = 'Si è verificato un errore durante la generazione. Riprova.';

      if (msg.includes('backend_error:')) {
        errorMessage = 'Errore backend: ' + msg.replace('backend_error:', '').trim();
      } else if (msg.includes('missing vite_groq_key')) {
        errorMessage = 'AI non configurata: imposta VITE_GROQ_KEY (o VITE_GROQ_API_KEY) nel file .env.local e riavvia il dev server.';
      } else if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('cors')) {
        errorMessage = 'AI non raggiungibile (rete/CORS). Verifica connessione o proxy.';
      }

      return {
        script: 'try { return false; } catch { return false; }',
        question: errorMessage,
      };
    }
  }

  /**
   * Normalizes pseudo-code into clean JavaScript.
   */
  async normalizePseudoCode(params: NormalizePseudoCodeParams): Promise<{ script: string }> {
    const { script, currentCode, variables, label, provider } = params;

    const norm = await normalizePseudoCode({
      chat: [] as any,
      pseudo: script || '',
      currentCode: currentCode || '',
      variables,
      mode: 'predicate',
      provider: provider || (window as any).__AI_PROVIDER || undefined,
      label
    });

    const candidate = (norm as any)?.script;
    if (candidate && typeof candidate === 'string' && candidate.trim()) {
      return { script: candidate };
    }

    return { script: script || '' };
  }

  /**
   * Repairs a condition script based on test failures.
   */
  async repairCondition(params: RepairConditionParams): Promise<{ script: string; error?: string }> {
    const { script, failures, variables, provider } = params;

    try {
      const resp = await repairCondition(script, failures, variables, provider || (window as any).__AI_PROVIDER || undefined);

      if (resp?.script && typeof resp.script === 'string') {
        return { script: resp.script };
      }

      const err = (resp as any)?.error || 'repair_failed';
      return { script, error: String(err) };
    } catch (e) {
      return { script, error: String((e as any)?.message || 'repair_failed') };
    }
  }

  /**
   * Suggests test cases for a condition.
   */
  async suggestTestCases(nlText: string, variables: string[]): Promise<{
    trueCase?: any;
    falseCase?: any;
    hintTrue?: string;
    hintFalse?: string;
    labelTrue?: string;
    labelFalse?: string;
  }> {
    try {
      return await suggestConditionCases(nlText, variables);
    } catch {
      return {};
    }
  }
}
