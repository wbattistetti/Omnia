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
 * Parameters for generateFromLabel method
 */
export interface GenerateFromLabelParams {
  label: string;
  variables: string[];
  semanticMatch: string | null;
}

/**
 * Service for AI-related operations in Condition Editor.
 * Encapsulates all AI calls (generate, normalize, repair, suggest test cases).
 */
export class ConditionAIService {
  /**
   * Generates a condition script from a label with complete variable context.
   * Called from ConditionEditorEventHandler where all variables are available.
   *
   * Pipeline:
   * 1. If semantic match found: generate simple predicate
   * 2. If no match: use intelligent AI generation with full context
   *
   * @param params - Label, variables, and optional semantic match
   * @returns Generated script (never empty)
   */
  async generateFromLabel(params: GenerateFromLabelParams): Promise<string> {
    const { label, variables, semanticMatch } = params;

    if (!label || !label.trim()) {
      return 'return false;';
    }

    // If we have a semantic match, generate a simple predicate
    if (semanticMatch) {
      const script = this.generateSimplePredicate(semanticMatch, label);
      return script;
    }

    // No semantic match - use intelligent AI generation
    try {
      const script = await this.generateWithIntelligentAI(label, variables);
      if (script && script.trim()) {
        return script;
      }
    } catch (e) {
      console.warn('[ConditionAIService] AI generation failed', e);
    }

    // Final fallback
    return `// Condition: ${label}\n// Edit this script to match your logic\nreturn false;`;
  }

  /**
   * Generates a condition using intelligent AI prompt with full context.
   * Uses a prompt that allows AI to interpret the label semantically.
   */
  private async generateWithIntelligentAI(label: string, variables: string[]): Promise<string> {
    const varsList = variables.map(v => `"${v}"`).join(', ');

    const prompt = `Interpret the following label as natural language and generate a JavaScript condition that represents its meaning.

Input:
- Label: "${label}"
- Available variables: [${varsList}]

Rules:
1. Use your intelligence to interpret what "${label}" means semantically.
2. Find the most relevant variable from the available list that relates to the label.
3. Generate a simple, readable condition using vars["variableName"] syntax.
4. For yes/no type conditions, compare with "si" or "yes".
5. Do NOT invent variables - only use variables from the provided list.
6. Return ONLY JavaScript code, no explanation.
7. The code should be a simple return statement like: return vars["variableName"] === "si";

Example:
- Label: "User is adult"
- Variables: ["user age", "user name"]
- Output: return Number(vars["user age"]) >= 18;

Generate the condition for "${label}":`;

    try {
      const result = await generateConditionWithAI(prompt, variables);
      if (result?.script && typeof result.script === 'string') {
        // Extract just the return statement if the AI returned more
        const script = result.script.trim();
        if (script.includes('return ')) {
          return script;
        }
        return `return ${script};`;
      }
    } catch (e) {
      console.warn('[ConditionAIService] AI call failed', e);
    }

    return '';
  }

  /**
   * @deprecated Use generateFromLabel instead. Kept for backward compatibility.
   */
  async generateFromEdgeLabel(label: string, variables: string[]): Promise<string> {
    const semanticMatch = this.findSemanticMatch(label, variables);
    return this.generateFromLabel({ label, variables, semanticMatch });
  }

  /**
   * Finds a variable that semantically matches the given label.
   * Uses multiple matching strategies:
   * 1. Exact match (case-insensitive)
   * 2. Label contains variable name
   * 3. Variable name contains label
   * 4. Partial word overlap
   */
  private findSemanticMatch(label: string, variables: string[]): string | null {
    if (!variables || variables.length === 0) return null;

    const labelNorm = this.normalizeText(label);
    const labelWords = this.extractWords(labelNorm);

    // Strategy 1: Exact match
    for (const v of variables) {
      const varNorm = this.normalizeText(v);
      if (varNorm === labelNorm) {
        return v;
      }
    }

    // Strategy 2: Label contains variable (e.g., "Ha un ticket" contains "ticket")
    for (const v of variables) {
      const varNorm = this.normalizeText(v);
      const varLastPart = varNorm.split('.').pop() || varNorm;
      if (labelNorm.includes(varLastPart) && varLastPart.length > 3) {
        return v;
      }
    }

    // Strategy 3: Variable contains label keywords
    for (const v of variables) {
      const varNorm = this.normalizeText(v);
      // Check if variable contains significant label words
      const significantWords = labelWords.filter(w => w.length > 3);
      const matchCount = significantWords.filter(w => varNorm.includes(w)).length;
      if (matchCount >= Math.ceil(significantWords.length * 0.5) && matchCount > 0) {
        return v;
      }
    }

    // Strategy 4: Word overlap scoring
    let bestMatch: { var: string; score: number } | null = null;
    for (const v of variables) {
      const varWords = this.extractWords(this.normalizeText(v));
      const overlap = labelWords.filter(w => varWords.some(vw => vw.includes(w) || w.includes(vw)));
      const score = overlap.length / Math.max(labelWords.length, 1);
      if (score > 0.4 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { var: v, score };
      }
    }

    return bestMatch?.var || null;
  }

  /**
   * Generates a simple predicate script for a matched variable.
   * Infers the expected value based on the label semantics.
   */
  private generateSimplePredicate(variableName: string, label: string): string {
    const labelLower = label.toLowerCase();

    // Detect negation patterns
    const isNegation = /\b(non|no|senza|not|without|isn't|doesn't|hasn't)\b/i.test(labelLower);

    // Detect boolean question patterns (yes/no)
    const isBooleanQuestion = /\b(ha|has|have|is|are|was|were|does|did|can|could|should|will|would)\b/i.test(labelLower);

    // Detect numeric patterns
    const isNumeric = /\b(maggiore|minore|uguale|greater|less|equal|more|fewer|>=|<=|>|<)\b/i.test(labelLower);

    let comparison: string;
    let value: string;

    if (isNumeric) {
      // Numeric comparison - user needs to fill in
      comparison = '>';
      value = '0';
    } else if (isBooleanQuestion) {
      // Boolean yes/no question
      comparison = '===';
      value = isNegation ? '"no"' : '"si"';
    } else {
      // Default: check if truthy
      comparison = '===';
      value = isNegation ? '"no"' : '"si"';
    }

    // Generate clean script with comment
    return `// Condition: ${label}
// Variable: ${variableName}
return vars["${variableName}"] ${comparison} ${value};`;
  }

  /**
   * Normalizes text for comparison (lowercase, remove accents, trim).
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^\w\s.]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extracts meaningful words from text.
   */
  private extractWords(text: string): string[] {
    const stopWords = new Set([
      'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una',
      'di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra',
      'e', 'o', 'ma', 'se', 'che', 'non', 'come', 'quando',
      'the', 'a', 'an', 'of', 'to', 'in', 'for', 'on', 'with',
      'and', 'or', 'but', 'if', 'as', 'at', 'by', 'is', 'are'
    ]);

    return text
      .split(/[\s.]+/)
      .filter(w => w.length > 2 && !stopWords.has(w));
  }

  /**
   * Generates a condition using AI when semantic match fails.
   */
  private async generateConditionFromLabel(label: string, variables: string[]): Promise<string> {
    const varsList = variables.map(v => `- ${v}`).join('\n');
    const prompt = `Generate a JavaScript condition that evaluates to true when: "${label}"

Available variables (access as vars["variable_name"]):
${varsList}

Rules:
- Return ONLY the JavaScript code for the condition body
- Use vars["..."] syntax to access variables
- Return a boolean expression
- Keep it simple and readable
- Add a brief comment explaining the logic

Example output format:
// Check if user has a ticket
return vars["ha un ticket"] === "si";`;

    try {
      const result = await generateConditionWithAI(prompt, variables);
      if (result?.script && typeof result.script === 'string') {
        return result.script;
      }
    } catch (e) {
      console.warn('[ConditionAIService] AI call failed', e);
    }

    return '';
  }

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
