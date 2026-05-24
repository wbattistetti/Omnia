/**
 * Active Tutor — messaggi deterministici per fase × stato (7 step wizard).
 */

import type { TutorPhaseId } from './tutorPhase';
import { TUTOR_PHASE_LABELS } from './tutorPhase';
import type { TutorPhaseState } from './tutorStateMachine';
import type { TutorBackendSubView } from './tutorPhase';
import { UI_IDS, wizardStepUiId } from './tutorUiIds';
import {
  EMPTY_TUTOR_SCRIPT_CONTEXT,
  isTaskDescriptionEmpty,
  type TutorScriptContext,
} from './tutorScriptContext';
import {
  tutorStructuredFromScriptMessage,
} from './tutorStructuredFromScript';
import type { TutorStructuredMessage } from './tutorStructuredMessage';

export type { TutorScriptContext } from './tutorScriptContext';

export interface TutorScriptMessage {
  readonly text: string;
  readonly attentionTargetId?: string;
  readonly attentionType?: 'blink' | 'pulse' | 'highlight' | 'glow';
  readonly uiActions?: ReadonlyArray<{
    action: 'openTab' | 'openPanel' | 'expandSection' | 'focus' | 'scrollTo';
    targetId: string;
  }>;
}

function phaseLabel(phase: TutorPhaseId): string {
  return TUTOR_PHASE_LABELS[phase];
}

function nextPhaseLabel(phase: TutorPhaseId): string | null {
  if (phase >= 6) return null;
  return TUTOR_PHASE_LABELS[(phase + 1) as TutorPhaseId];
}

export function getTutorStructuredScript(
  phase: TutorPhaseId,
  state: TutorPhaseState,
  subView: TutorBackendSubView = 'main',
  context: TutorScriptContext = EMPTY_TUTOR_SCRIPT_CONTEXT
): TutorStructuredMessage | null {
  const legacy = getTutorScriptMessage(phase, state, subView, context);
  if (!legacy) return null;
  return tutorStructuredFromScriptMessage(legacy, phaseLabel(phase));
}

export function getTutorScriptMessage(
  phase: TutorPhaseId,
  state: TutorPhaseState,
  subView: TutorBackendSubView = 'main',
  context: TutorScriptContext = EMPTY_TUTOR_SCRIPT_CONTEXT
): TutorScriptMessage | null {
  if (state === 'waiting_for_ai') return null;

  switch (state) {
    case 'idle':
      return getIdleScript(phase, subView, context);
    case 'ai_completed':
      return getAiCompletedScript(phase, subView);
    case 'iterating':
      return {
        text: 'Stai correggendo il risultato. Se hai dubbi, chiedimi pure — poi riprendiamo da qui.',
      };
    case 'awaiting_confirmation':
      return {
        text: `Quando sei soddisfatto, conferma la fase ${phaseLabel(phase)}. Poi potrai passare allo step successivo dallo stepper in alto.`,
      };
    case 'completed': {
      const next = nextPhaseLabel(phase);
      if (!next) {
        return {
          text: 'Ottimo lavoro! Hai completato tutte le fasi del wizard.',
        };
      }
      return {
        text: `Fase ${phaseLabel(phase)} completata. Prossimo passo: ${next}.`,
        uiActions: [{ action: 'openTab', targetId: wizardStepUiId(phase + 1) }],
      };
    }
    default:
      return null;
  }
}

function taskIdleScript(context: TutorScriptContext): TutorScriptMessage {
  if (isTaskDescriptionEmpty(context)) {
    return {
      text: 'Inizia descrivendo cosa deve fare il tuo agente. Scrivi liberamente nell’area qui sotto.',
      uiActions: [
        { action: 'scrollTo', targetId: UI_IDS.taskInput },
        { action: 'focus', targetId: UI_IDS.taskInput },
      ],
      attentionTargetId: UI_IDS.taskInput,
      attentionType: 'glow',
    };
  }

  if (context.hasAgentGeneration) {
    return {
      text: 'Hai già una descrizione. Puoi raffinarla qui sotto, poi usa Refine comportamento per aggiornare le sezioni strutturate.',
      uiActions: [{ action: 'scrollTo', targetId: UI_IDS.taskInput }],
      attentionTargetId: UI_IDS.createAgentButton,
      attentionType: 'pulse',
    };
  }

  return {
    text: 'Hai già una bozza. Completa o correggi la descrizione, poi clicca Create Agent per strutturarla in sezioni.',
    uiActions: [{ action: 'scrollTo', targetId: UI_IDS.createAgentButton }],
    attentionTargetId: UI_IDS.createAgentButton,
    attentionType: 'blink',
  };
}

function getIdleScript(
  phase: TutorPhaseId,
  subView: TutorBackendSubView,
  context: TutorScriptContext
): TutorScriptMessage {
  switch (phase) {
    case 0:
      return taskIdleScript(context);
    case 1:
      return {
        text: 'Carica documenti per arricchire la conoscenza dell’agente. Seleziona un file e usa l’analisi documento.',
        uiActions: [{ action: 'scrollTo', targetId: UI_IDS.kbDocumentList }],
        attentionTargetId: UI_IDS.knowledgeBasePanel,
        attentionType: 'glow',
      };
    case 2:
      if (subView === 'interface') {
        return {
          text: 'Definisci il contratto INPUT/OUTPUT dell’agente. Usa Interface per allineare variabili e tipi.',
          uiActions: [{ action: 'scrollTo', targetId: UI_IDS.interfacePanel }],
          attentionTargetId: UI_IDS.interfaceToggleButton,
          attentionType: 'glow',
        };
      }
      return {
        text: 'Aggiungi i backend che l’agente può chiamare. Puoi importarne uno esistente o crearne le specifiche.',
        uiActions: [{ action: 'scrollTo', targetId: UI_IDS.backendList }],
        attentionTargetId: UI_IDS.backendList,
        attentionType: 'glow',
      };
    case 3:
      return {
        text: 'Qui definisci use case, conversazioni e stile. Puoi incollare un draft o generare da zero.',
        uiActions: [{ action: 'scrollTo', targetId: UI_IDS.promptsMainEditor }],
        attentionTargetId: UI_IDS.promptsMainEditor,
        attentionType: 'glow',
      };
    case 4:
      return {
        text: 'Definisci regole conversazionali trasversali (error handling) che valgono su più scenari.',
        uiActions: [{ action: 'scrollTo', targetId: UI_IDS.errorHandlingEditor }],
        attentionTargetId: UI_IDS.errorHandlingEditor,
        attentionType: 'glow',
      };
    case 5:
      return {
        text: 'Controlla i dati inferiti per l’agente. Verifica che slot e tipi siano corretti.',
        uiActions: [{ action: 'scrollTo', targetId: UI_IDS.datiEditor }],
        attentionTargetId: UI_IDS.datiEditor,
        attentionType: 'glow',
      };
    case 6:
      return {
        text: 'Scegli voce e parametri runtime. Quando sei pronto, il tuo agente avrà la sua identità sonora.',
        uiActions: [{ action: 'scrollTo', targetId: UI_IDS.voceEditor }],
        attentionTargetId: UI_IDS.voceEditor,
        attentionType: 'glow',
      };
    default:
      return { text: `Fase ${phaseLabel(phase)}: inizia quando sei pronto.` };
  }
}

function getAiCompletedScript(
  phase: TutorPhaseId,
  subView: TutorBackendSubView
): TutorScriptMessage {
  switch (phase) {
    case 0:
      return {
        text: 'Ho riformattato il tuo Task. Dai un’occhiata alle sezioni qui sotto.',
        uiActions: [{ action: 'scrollTo', targetId: UI_IDS.taskFormattedBox }],
        attentionTargetId: UI_IDS.taskFormattedBox,
        attentionType: 'blink',
      };
    case 1:
      return {
        text: 'L’analisi del documento è pronta. Controlla che il riassunto sia fedele.',
        uiActions: [{ action: 'scrollTo', targetId: UI_IDS.kbAnalysisResult }],
        attentionTargetId: UI_IDS.kbAnalysisResult,
        attentionType: 'blink',
      };
    case 2:
      if (subView === 'interface') {
        return {
          text: 'Contratto Interface aggiornato. Verifica input, output e mapping.',
          uiActions: [{ action: 'scrollTo', targetId: UI_IDS.interfacePanel }],
          attentionTargetId: UI_IDS.interfacePanel,
          attentionType: 'blink',
        };
      }
      return {
        text: 'Backend interpretato. Verifica input, output e nomi dei campi.',
        uiActions: [{ action: 'scrollTo', targetId: UI_IDS.backendList }],
        attentionTargetId: UI_IDS.backendList,
        attentionType: 'pulse',
      };
    case 3:
      return {
        text: 'L’AI ha prodotto un risultato. Leggilo con calma e correggi se serve.',
        uiActions: [{ action: 'scrollTo', targetId: UI_IDS.promptsMainEditor }],
        attentionTargetId: UI_IDS.promptsMainEditor,
        attentionType: 'blink',
      };
    case 4:
      return {
        text: 'Regole conversazionali aggiornate. Controlla che coprano i casi critici.',
        uiActions: [{ action: 'scrollTo', targetId: UI_IDS.errorHandlingEditor }],
        attentionTargetId: UI_IDS.errorHandlingEditor,
        attentionType: 'blink',
      };
    case 5:
      return {
        text: 'I dati proposti sono pronti. Controlla slot e tipi.',
        uiActions: [{ action: 'scrollTo', targetId: UI_IDS.datiEditor }],
        attentionTargetId: UI_IDS.datiEditor,
        attentionType: 'blink',
      };
    case 6:
      return {
        text: 'Configurazione voce aggiornata. Ascolta l’anteprima se disponibile.',
        uiActions: [{ action: 'scrollTo', targetId: UI_IDS.voceEditor }],
        attentionTargetId: UI_IDS.voceEditor,
        attentionType: 'glow',
      };
    default:
      return { text: 'Risultato AI pronto. Controlla e correggi se necessario.' };
  }
}

export const TUTOR_OUT_OF_MANUAL_STRUCTURED: TutorStructuredMessage = {
  title: 'Fuori dal manuale',
  body: 'Questa informazione non è presente nel manuale ufficiale.\nPosso aiutarti solo con ciò che è documentato.',
  actions: [{ icon: 'ArrowRight', label: 'Continua con la fase corrente', kind: 'continue' }],
  uiRefs: [],
  ensureView: null,
};

export const TUTOR_CONTINUE_STRUCTURED: TutorStructuredMessage = {
  title: 'Prossimo passo',
  body: 'Vuoi continuare con la fase corrente?',
  actions: [{ icon: 'Check', label: 'Sì, continuiamo', kind: 'continue' }],
  uiRefs: [],
  ensureView: null,
};

/** Messaggio welcome assorbito nella tab Task (primo ingresso). */
export const TUTOR_WELCOME_STRUCTURED: TutorStructuredMessage = {
  title: 'Benvenuto! Costruiamo il tuo agente IA',
  body:
    'Qui puoi creare un agente IA passo passo. Ogni fase si attiva quando hai completato la precedente. Usa le tab qui sopra o chiedimi pure.',
  actions: [{ icon: 'ArrowRight', label: 'Cominciamo', kind: 'continue' }],
  uiRefs: [{ elementId: UI_IDS.wizardStep0, label: 'Passo 1 — Task', type: 'glow' }],
  ensureView: null,
};

/** @deprecated Usare TUTOR_OUT_OF_MANUAL_STRUCTURED */
export const TUTOR_OUT_OF_MANUAL_REPLY =
  'Questa informazione non è presente nel manuale ufficiale.\nPosso aiutarti solo con ciò che è documentato.\nVuoi continuare con la fase corrente?';

/** @deprecated Usare TUTOR_CONTINUE_STRUCTURED */
export const TUTOR_CONTINUE_PROMPT = 'Vuoi continuare con la fase corrente?';
