/**
 * Active Tutor — registry ufficiale elementId (condiviso dominio + UI).
 */

export const UI_IDS = {
  taskDescriptionInput: 'task-description-input',
  taskFormattedBox: 'task-formatted-box',
  confirmTaskButton: 'confirm-task-button',
  createAgentButton: 'create-agent-button',
  knowledgeBasePanel: 'knowledge-base-panel',
  kbDocumentList: 'kb-document-list',
  kbAnalysisResult: 'kb-analysis-result',
  kbToggleButton: 'kb-toggle-button',
  promptsMainEditor: 'prompts-main-editor',
  promptsJsonPreview: 'prompts-json-preview',
  promptsSlotMapping: 'prompts-slot-mapping',
  promptsActionsPanel: 'prompts-actions-panel',
  errorHandlingEditor: 'error-handling-editor',
  backendList: 'backend-list',
  backendTestButton: 'backend-test-button',
  interfaceToggleButton: 'interface-toggle-button',
  interfacePanel: 'interface-panel',
  datiEditor: 'dati-editor',
  voceEditor: 'voce-editor',
  scenarioPanel: 'scenario-panel',
  wizardStep0: 'wizard-step-0',
  wizardStep1: 'wizard-step-1',
  wizardStep2: 'wizard-step-2',
  wizardStep3: 'wizard-step-3',
  wizardStep4: 'wizard-step-4',
  wizardStep5: 'wizard-step-5',
  wizardStep6: 'wizard-step-6',
  wizardStep7: 'wizard-step-7',
  tutorChatInput: 'tutor-chat-input',
  /** @deprecated use taskDescriptionInput */
  taskInput: 'task-description-input',
  /** @deprecated use promptsMainEditor */
  useCaseList: 'prompts-main-editor',
  /** @deprecated use datiEditor */
  datiPanel: 'dati-editor',
  /** @deprecated use voceEditor */
  voicePanel: 'voce-editor',
} as const;

export type TutorUiId = (typeof UI_IDS)[keyof typeof UI_IDS];

const WIZARD_STEP_UI_IDS: readonly TutorUiId[] = [
  UI_IDS.wizardStep0,
  UI_IDS.wizardStep1,
  UI_IDS.wizardStep2,
  UI_IDS.wizardStep3,
  UI_IDS.wizardStep4,
  UI_IDS.wizardStep5,
  UI_IDS.wizardStep6,
  UI_IDS.wizardStep7,
];

/** ID stepper per indice wizard 0..7. */
export function wizardStepUiId(index: number): TutorUiId {
  const id = WIZARD_STEP_UI_IDS[index];
  if (!id) throw new Error(`Invalid wizard step index: ${index}`);
  return id;
}

export const TUTOR_ID_ATTR = 'data-tutor-id';

export function tutorDomSelector(id: string): string {
  return `[${TUTOR_ID_ATTR}="${id}"]`;
}

/** Set di tutti gli ID validi per whitelist LLM. */
export function allTutorUiIds(): ReadonlySet<string> {
  return new Set(Object.values(UI_IDS));
}

