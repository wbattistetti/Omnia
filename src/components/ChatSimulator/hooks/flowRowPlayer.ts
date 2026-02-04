// Row player functions for flow execution
// Simple, linear logic: playMessage for Message rows, playDDT for interactive rows

// TODO: Flow orchestrator will be refactored - temporarily isolated
// import { instanceRepository } from '../../../services/InstanceRepository';
import type { AssembledTaskTree } from '../../TaskTreeBuilder/DDTAssembler/currentDDT.types';
import { getDDTForRow, validateDDT } from './rowHelpers';
import { resolveAsk } from '../messageResolvers';
import { getStepColor } from '../chatSimulatorUtils';

export interface PlayedMessage {
  id: string;
  type: 'bot';
  text: string;
  stepType: 'message' | 'start' | 'ask';
  textKey?: string;
  color: string;
}

/**
 * Play a Message row - emits the message text from instance
 * TODO: Flow orchestrator will be refactored - temporarily isolated
 */
export function playMessage(row: any, generateId: () => string): PlayedMessage[] {
  const instanceId = row?.id;
  if (!instanceId) return [];

  // const instance = instanceRepository.getInstance(instanceId);
  const instance = null; // Temporarily disabled - will be refactored
  const text = instance?.message?.text;

  if (!text) return [];

  return [{
    id: generateId(),
    type: 'bot',
    text,
    stepType: 'message',
    color: getStepColor('message')
  }];
}

/**
 * Play a DDT row - emits the initial message based on DDT kind
 * For intent: emits steps.start
 * For data: emits steps.ask.base
 */
export function playDDT(
  row: any,
  resolveAct: (row: any) => any,
  toAssembled: (raw: any) => AssembledTaskTree | null,
  translations: Record<string, string>,
  legacyDict: Record<string, string>,
  generateId: () => string
): { messages: PlayedMessage[]; ddt: AssembledTaskTree | null; error?: string } {
  try {
    const debugEnabled = localStorage.getItem('debug.chatSimulator') === '1';

    // Get DDT from instance or template
    const ddt = getDDTForRow(row, resolveAct, toAssembled);

    if (!ddt) {
      const error = `DDT not found for row "${row?.text || row?.id || 'unknown'}"`;
      if (debugEnabled) {
        console.warn('[playDDT][NO_DDT]', { rowId: row?.id, rowText: row?.text });
      }
      return { messages: [], ddt: null, error };
    }

    // Validate DDT structure (basic only - message validation happens when emitting)
    const validation = validateDDT(ddt, undefined, true);
    if (!validation.valid) {
      const error = `DDT invalid for row "${row?.text || row?.id || 'unknown'}": ${validation.reason}`;
      if (debugEnabled) {
        console.error('[playDDT][VALIDATION_FAILED]', { rowId: row?.id, reason: validation.reason });
      }
      return { messages: [], ddt, error };
    }

    // Extract legacyMain for resolveAsk
    const legacyMain = Array.isArray(ddt.data) ? ddt.data[0] : ddt.data;
    const main = null; // Not needed for initial message emission - resolveAsk uses legacyMain

    if (debugEnabled) {
      const kind = legacyMain?.kind;
      const stepsKeys = legacyMain?.steps ? Object.keys(legacyMain.steps) : [];
      const startStep = legacyMain?.steps?.start;
      const askStep = legacyMain?.steps?.ask;

      console.log('[playDDT][RESOLVING]', {
        rowId: row?.id,
        rowText: row?.text,
        ddtId: ddt.id,
        kind,
        stepsKeys,
        hasStart: !!startStep,
        hasAsk: !!askStep,
        startStepDetails: startStep ? {
          type: startStep.type,
          escalationsCount: startStep.escalations?.length || 0,
          firstEscalation: startStep.escalations?.[0] ? {
            // ✅ MIGRATION: Support both tasks (new) and actions (legacy)
            actionsCount: (startStep.escalations[0].tasks || startStep.escalations[0].actions)?.length || 0,
            firstAction: (startStep.escalations[0].tasks?.[0] || startStep.escalations[0].actions?.[0]) ? {
              actionId: (startStep.escalations[0].tasks?.[0] || startStep.escalations[0].actions?.[0])?.templateId || (startStep.escalations[0].tasks?.[0] || startStep.escalations[0].actions?.[0])?.actionId,
              parameters: (startStep.escalations[0].tasks?.[0] || startStep.escalations[0].actions?.[0])?.parameters
            } : null
          } : null
        } : null,
        translationsKeys: Object.keys(translations).slice(0, 10),
        legacyDictKeys: Object.keys(legacyDict).slice(0, 10)
      });
    }

    // Resolve initial message using resolveAsk (handles both intent and data uniformly)
    const { text, key, stepType } = resolveAsk(main, undefined, translations, legacyDict, legacyMain, undefined);

    if (debugEnabled) {
      console.log('[playDDT][RESOLVE_RESULT]', {
        rowId: row?.id,
        hasText: !!text,
        textLength: text?.length || 0,
        textPreview: text?.substring(0, 100),
        key,
        stepType,
        legacyMainKind: legacyMain?.kind,
        legacyMainStepsKeys: legacyMain?.steps ? Object.keys(legacyMain.steps) : []
      });
    }

    if (!text) {
      // More detailed error message
      const kind = legacyMain?.kind;
      const hasStart = !!legacyMain?.steps?.start;
      const hasAsk = !!legacyMain?.steps?.ask;
      const startEscalations = legacyMain?.steps?.start?.escalations?.length || 0;
      const askEscalations = legacyMain?.steps?.ask?.base ? 'exists' : 'missing';

      const error = `No initial message found for DDT "${ddt.label || ddt.id}" (kind: ${kind}, hasStart: ${hasStart}, hasAsk: ${hasAsk}, startEscalations: ${startEscalations})`;
      if (debugEnabled) {
        console.warn('[playDDT][NO_MESSAGE]', {
          rowId: row?.id,
          ddtId: ddt.id,
          kind,
          hasStart,
          hasAsk,
          startEscalations,
          legacyMainSteps: legacyMain?.steps ? Object.keys(legacyMain.steps) : [],
          legacyMainFull: JSON.stringify(legacyMain, null, 2).substring(0, 1000)
        });
      }
      return { messages: [], ddt, error };
    }

    // Emit the message
    const finalStepType = (stepType || 'ask') as 'start' | 'ask';
    const message: PlayedMessage = {
      id: generateId(),
      type: 'bot',
      text,
      stepType: finalStepType,
      textKey: key,
      color: getStepColor(finalStepType)
    };

    if (debugEnabled) {
      console.log('[playDDT][SUCCESS]', {
        rowId: row?.id,
        messageId: message.id,
        stepType: finalStepType,
        textLength: text.length
      });
    }

    return { messages: [message], ddt };
  } catch (err) {
    console.error('[playDDT][ERROR]', err, { rowId: row?.id, rowText: row?.text });
    return { messages: [], ddt: null, error: String(err) };
  }
}

