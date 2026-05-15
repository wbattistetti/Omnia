/**
 * Default persisted fields when creating a new AI Agent task in the repository.
 * Single source for: flow row type picker ({@link RowTypeHandler}), gear lazy-open ({@link TaskTreeOpener}), editor bootstrap.
 */

import { DEFAULT_AGENT_PROMPT_PLATFORM } from '@domain/agentPrompt';
import { AI_AGENT_DEFAULT_PREVIEW_STYLE_ID } from '@types/aiAgentPreview';
import { AGENT_WIZARD_FIRST_STEP_INDEX } from '@domain/aiAgentConstruction/agentConstructionPhase';
import { EMPTY_OUTPUT_MAPPINGS } from './constants';

/**
 * Payload passed to `taskRepository.createTask` for a fresh AI Agent row.
 */
export function createDefaultAIAgentTaskPayload(): Record<string, unknown> {
  return {
    agentDesignDescription: '',
    agentPrompt: '',
    agentStructuredSectionsJson: '',
    outputVariableMappings: { ...EMPTY_OUTPUT_MAPPINGS },
    agentProposedFields: [],
    agentSampleDialogue: [],
    agentPreviewByStyle: {},
    agentPreviewStyleId: AI_AGENT_DEFAULT_PREVIEW_STYLE_ID,
    agentInitialStateTemplateJson: '{}',
    agentRuntimeCompactJson: '',
    agentDesignFrozen: false,
    agentDesignHasGeneration: false,
    agentLogicalStepsJson: '[]',
    agentUseCasesJson: '[]',
    agentUseCaseWizardStateJson: '',
    agentUseCaseGlobalStyleId: '',
    agentUseCaseStyleLearningNotes: '',
    agentPromptTargetPlatform: DEFAULT_AGENT_PROMPT_PLATFORM,
    agentIaRuntimeOverrideJson: '',
    agentImmediateStart: false,
    /** Nuovi task partono in modalità wizard di costruzione, dal primo step. */
    agentConstructionPhase: 'wizard',
    agentWizardCurrentStep: AGENT_WIZARD_FIRST_STEP_INDEX,
    /** Tutor mai vista per task vergini: la prima apertura mostra la schermata di benvenuto. */
    agentWizardTutorAcknowledged: false,
    /** v1 deprecato: vuoto. v2 usa `agentConversationStyleSelections`. */
    agentConversationStyleExample: '',
    /** Checkbox globale «Lascia che Omnia scelga uno stile» — default OFF (esempi obbligatori). */
    agentConversationStyleAuto: false,
    /** v2 multi-stile: nessuna entry attivata → costringe il designer a sceglierne almeno una. */
    agentConversationStyleSelections: {},
    /** Upload disabilitato di default finché il designer non sceglie uno stile target. */
    agentConversationDeployStyleId: null,
    /**
     * "Logga Use Case": OFF di default. Il designer può abilitarlo dalla dropdown
     * `AIAgentDeployMenu` quando vuole il trace `USECASE: "<NOME>"` in coda alle
     * risposte runtime.
     */
    agentLogUseCase: false,
  };
}
