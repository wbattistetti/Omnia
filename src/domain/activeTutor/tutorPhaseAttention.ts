/**
 * Active Tutor — elemento UI principale per attenzione per fase.
 */

import { UI_IDS } from './tutorUiIds';
import type { TutorPhaseKey } from './tutorPhaseKey';
import type { TutorPhaseState } from './tutorStateMachine';

export function mainUiIdForPhase(phaseKey: TutorPhaseKey): string {
  switch (phaseKey) {
    case 'task':
      return UI_IDS.taskDescriptionInput;
    case 'knowledgeBase':
      return UI_IDS.knowledgeBasePanel;
    case 'backend':
      return UI_IDS.backendList;
    case 'prompts':
      return UI_IDS.promptsMainEditor;
    case 'errorHandling':
      return UI_IDS.errorHandlingEditor;
    case 'dati':
      return UI_IDS.datiEditor;
    case 'voce':
      return UI_IDS.voceEditor;
    default:
      return UI_IDS.taskDescriptionInput;
  }
}

export function tutorPhaseAttentionAllowed(state: TutorPhaseState): boolean {
  return state !== 'awaiting_confirmation' && state !== 'completed' && state !== 'waiting_for_ai';
}
