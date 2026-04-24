/**
 * Designer-facing compile UX: resolves VB `code` + structured fields only.
 * No parsing of message/technicalDetail; labels from dialogueStepUserLabels via getDialogueStepUserLabel.
 */

import type { CompilationError } from '@components/FlowCompiler/types';
import { getDialogueStepUserLabel } from '@utils/dialogueStepUserLabels';

/** Codes emitted by VB for the Error Report designer panel (aligned with CompilationErrorCode enum JSON names). */
export const COMPILE_ERROR_REPORT_UX_CODES = [
  'EscalationActionsMissing',
  'ParserMissing',
  'ResponseMessageMissing',
  'EscalationTerminationMissing',
  'SubflowChildNotRunnable',
  'IaElevenLabsMissingAgentId',
  'IaElevenLabsMissingVoice',
  'IaElevenLabsMissingLanguage',
  'IaElevenLabsMissingLlmModel',
  'IaOpenAiMissingModel',
  'IaOpenAiMissingMaxTokens',
  'IaAnthropicMissingModel',
  'IaGeminiMissingModel',
  'IaCustomMissingModel',
  'IaProvisionProviderError',
] as const;

export type CompileUxMessageCode = (typeof COMPILE_ERROR_REPORT_UX_CODES)[number];

const UX_CODE_SET = new Set<string>(COMPILE_ERROR_REPORT_UX_CODES);

/** True when this error should appear in the Error Report (VB-only contract for designer copy). */
export function isCompileErrorReportUxCode(code: string | undefined): boolean {
  const c = (code ?? '').trim();
  return c.length > 0 && UX_CODE_SET.has(c);
}

/**
 * Single UX line for the Error Report, or null when `code` is not part of the designer contract.
 */
export function resolveCompileUxMessage(error: CompilationError): string | null {
  const code = (error.code ?? '').trim();
  const stepLabel = getDialogueStepUserLabel(error.stepKey);
  switch (code) {
    case 'EscalationActionsMissing':
      return `Mancano azioni in «${stepLabel}».`;
    case 'ParserMissing':
      return 'Manca il parser.';
    case 'ResponseMessageMissing':
      return 'Manca il messaggio di risposta.';
    case 'EscalationTerminationMissing':
      return 'Manca la condizione di terminazione.';
    case 'SubflowChildNotRunnable':
      return 'Il flusso collegato al task è vuoto.';
    case 'IaElevenLabsMissingAgentId':
      return 'ElevenLabs: manca ConvAI Agent ID.';
    case 'IaElevenLabsMissingVoice':
      return 'ElevenLabs: manca la voce.';
    case 'IaElevenLabsMissingLanguage':
      return 'ElevenLabs: manca la lingua.';
    case 'IaElevenLabsMissingLlmModel':
      return 'ElevenLabs: manca il modello LLM.';
    case 'IaOpenAiMissingModel':
      return 'OpenAI: manca il modello.';
    case 'IaOpenAiMissingMaxTokens':
      return 'OpenAI: max token non valido.';
    case 'IaAnthropicMissingModel':
      return 'Anthropic: manca il modello.';
    case 'IaGeminiMissingModel':
      return 'Gemini: manca il modello.';
    case 'IaCustomMissingModel':
      return 'Provider personalizzato: manca il modello.';
    case 'IaProvisionProviderError': {
      const m = (error.message ?? '').trim();
      return m.length > 0 ? m : 'Provisioning IA non riuscito (vedi dettaglio tecnico se presente).';
    }
    default:
      return null;
  }
}
