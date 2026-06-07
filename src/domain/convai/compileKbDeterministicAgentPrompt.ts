/**
 * Compilazione system prompt per deploy deterministico (omnia_dialog_step): persona + slot map
 * senza operational sequence / catalogo UC.
 */

import type { Task } from '@types/taskTypes';
import type { ProjectBackendCatalogBlob } from '@domain/backendCatalog/catalogTypes';
import { buildUseOfBackendsPromptSection, mergeUseOfBackendsIntoContext } from '@domain/backendAnalysis/buildUseOfBackendsPromptSection';
import { mergeConvaiBackendToolIdLists } from '@domain/iaAgentTools/manualCatalogBackendToolIds';
import { parsePersistedStructuredSectionsJson } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/structuredSectionPersist';
import { effectiveBySectionFromPersistedStructured } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/structuredSectionsRevisionReducer';
import { buildKbDialogSlotMapPromptSection } from '@domain/convai/kbDialogSlotMapPrompt';

export const OMNIA_DIALOG_STEP_PROMPT_APPEND = `OMNIA_DIALOG_STEP (webhook POST …/omnia-dialog-step/{projectId}/{agentTaskId}):

## Regola assoluta
Ogni domanda sui dati prestazione (slot tabella KB) **deve** passare dal tool. **Non** pronunciare domande slot senza aver ricevuto \`say\` dal tool nello stesso turno. **Non** inventare domande, opzioni o scuse.

## Turno 0 (bootstrap)
- L'host Omnia può aver già chiamato il tool con \`updates: {}\` e pronunciato la prima domanda. **Non** ripetere bootstrap con \`updates: {}\` se l'utente ha già sentito una domanda slot.
- Se la conversazione è appena iniziata e non c'è ancora una domanda slot attiva: POST con \`updates: {}\` e \`conversationId\` valorizzato, poi leggi **solo** \`say\`.

## Dopo OGNI utterance dell'utente (obbligatorio)
1. Estrai slot e valori dall'ultimo messaggio utente (chiavi nella sezione Slot NLU).
2. POST \`omnia_dialog_step\` con \`updates: { "<slotId>": "<valore normalizzato>", ... }\` — **sempre** se l'utente ha risposto; **vietato** lasciare \`updates\` vuoto dopo una risposta utente.
3. Leggi **solo** \`say\` e pronuncialo. **Non** ripetere domande già superate; **non** avanzare senza tool.

## Parametri
- **conversationId**: obbligatorio — valore runtime \`omnia_conversation_id\` (o binding sessione corrente).
- **updates**: slot→valore; \`{}\` solo al bootstrap iniziale o dopo \`reset: true\`.
- **reset**: solo se l'utente chiede esplicitamente di ricominciare.

## Stati risposta
- \`status\` = \`ask\` o \`invalid\`: leggi \`say\`, attendi risposta; non aggiungere domande non presenti in \`say\`.
- \`status\` = \`complete\`: conferma con \`say\` e \`matchedRow\` (senza id tecnici); poi eventuali tool backend post-prenotazione.

## Errori tool
- Riprova **una volta** con gli stessi parametri; se fallisce di nuovo, scusa brevemente — **non** simulare il flusso e **non** continuare a chiedere slot.

## Saluti fuori tabella
- Breve e naturale; per i dati prestazione usa **sempre** il tool.`;

type TaskLike = Pick<
  Task,
  | 'agentStructuredSectionsJson'
  | 'agentPrompt'
  | 'id'
  | 'agentIaRuntimeOverrideJson'
  | 'agentKnowledgeBaseDocumentsJson'
>;

export type CompileKbDeterministicPromptOptions = {
  manualCatalogBackendTaskIds?: readonly string[];
  backendCatalog?: ProjectBackendCatalogBlob;
};

function resolveBackendToolIds(
  task: TaskLike,
  manualCatalogBackendTaskIds?: readonly string[]
): string[] {
  const raw = task.agentIaRuntimeOverrideJson;
  let fromJson: string[] = [];
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as { convaiBackendToolTaskIds?: unknown };
      if (Array.isArray(parsed.convaiBackendToolTaskIds)) {
        fromJson = parsed.convaiBackendToolTaskIds
          .map((x) => String(x ?? '').trim())
          .filter(Boolean);
      }
    } catch {
      fromJson = [];
    }
  }
  return mergeConvaiBackendToolIdLists(fromJson, manualCatalogBackendTaskIds ?? []);
}

function buildSlimPromptBody(params: {
  goal: string;
  personality: string;
  tone: string;
  context: string;
  slotMap: string;
}): string {
  const chunks: string[] = ['## Prompt'];
  const goal = params.goal.trim();
  if (goal) chunks.push(`### Goal\n\n${goal}`);

  const personaParts = [params.personality.trim(), params.tone.trim()].filter(Boolean);
  if (personaParts.length > 0) {
    chunks.push(`### Persona e tono\n\n${personaParts.join('\n\n')}`);
  }

  const context = params.context.trim();
  if (context) chunks.push(`### Context\n\n${context}`);

  const slotMap = params.slotMap.trim();
  if (slotMap) chunks.push(`### Slot NLU (updates)\n\n${slotMap}`);

  return chunks.join('\n\n').trim();
}

/**
 * Prompt ElevenLabs per modalità kb_deterministic (senza operational sequence / catalogo UC).
 */
export function compileKbDeterministicAgentPrompt(
  task: TaskLike,
  options?: CompileKbDeterministicPromptOptions
): string {
  const parsed = parsePersistedStructuredSectionsJson(
    task.agentStructuredSectionsJson,
    task.agentPrompt ?? ''
  );
  const eff = effectiveBySectionFromPersistedStructured(parsed.sections);

  let context = (eff.context ?? '').trim();
  const backendReceiveSection = buildUseOfBackendsPromptSection({
    catalog: options?.backendCatalog,
    agentTaskId: String(task.id ?? '').trim(),
    manualCatalogBackendTaskIds: resolveBackendToolIds(task, options?.manualCatalogBackendTaskIds),
    mode: 'slim',
  });
  if (backendReceiveSection) {
    context = mergeUseOfBackendsIntoContext(context, backendReceiveSection);
  }

  const slotMap = buildKbDialogSlotMapPromptSection(task.agentKnowledgeBaseDocumentsJson);
  const elBase = buildSlimPromptBody({
    goal: eff.goal ?? '',
    personality: eff.personality ?? '',
    tone: eff.tone ?? '',
    context,
    slotMap,
  });

  const parts = [elBase.trim(), OMNIA_DIALOG_STEP_PROMPT_APPEND.trim()].filter(Boolean);
  return `${parts.join('\n\n')}\n`;
}
