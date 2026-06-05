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
- **All'avvio e ogni turno** di raccolta dati: chiama \`omnia_dialog_step\` **prima** di parlare. Primo passo: \`updates: {}\`.
- **Pronuncia solo** il campo \`say\` della risposta Omnia. Non inventare domande, opzioni o scuse.
- **conversationId**: obbligatorio — usa **omnia_conversation_id** (variabile runtime).
- **updates**: slot→valore dal messaggio utente (chiavi nella sezione Slot NLU). Vuoto solo al primo passo.
- **reset**: solo se l'utente chiede esplicitamente di ricominciare.
- Se \`status\` è \`ask\` o \`invalid\`, leggi \`say\` e attendi la risposta; non proseguire con domande non presenti in \`say\`.
- Se \`status\` è \`complete\`, conferma con \`say\` e \`matchedRow\` (senza id tecnici); poi eventuali tool backend post-prenotazione.
- **Se il tool fallisce**: riprova **una volta** con gli stessi parametri; se fallisce ancora, chiedi scusa brevemente e invita a riprovare — **non** simulare il flusso domande e **non** dire «problema tecnico» continuando a interrogare.
- Saluto/eccezioni fuori tabella: breve e naturale; per i dati prestazione usa sempre il tool.`;

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
