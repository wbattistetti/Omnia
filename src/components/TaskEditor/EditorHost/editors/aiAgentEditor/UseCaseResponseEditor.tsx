/**

 * Use case operational response editor: TaskSequenceEditor + focus provider.

 */



import React from 'react';

import {

  TaskSequenceEditor,

  TaskSequenceFocusProvider,

} from '@responseEditor/taskSequence';

import type { TaskSequenceRow } from '@responseEditor/taskSequence';

import {

  ensureUseCaseResponse,

  getUseCaseResponseTasks,

} from '@domain/aiAgentUseCase/useCaseResponseTasks';

import type { PatchUseCaseResponseTasksFn } from './usePatchUseCaseResponseTasks';

import type { AIAgentUseCase } from '@types/aiAgentUseCases';



const AI_AGENT_RESPONSE_ALLOWED_TEMPLATES = [

  'sayMessage',

  'message',

  'Message',

  'sendSMS',

  'readFromBackend',

  'writeToBackend',

  'escalateToHuman',

  'waitForAgent',

] as const;



export interface UseCaseResponseEditorProps {

  useCase: AIAgentUseCase;

  onPatchResponseTasks: PatchUseCaseResponseTasksFn;

  /** One-time seed when `response` was missing on load (optional). */

  onSeedUseCase?: (next: AIAgentUseCase) => void;

  disabled?: boolean;

  className?: string;

}



export function UseCaseResponseEditor({

  useCase,

  onPatchResponseTasks,

  onSeedUseCase,

  disabled = false,

  className = '',

}: UseCaseResponseEditorProps): React.ReactElement {

  const persistedTasks = getUseCaseResponseTasks(useCase);

  const tasks =

    persistedTasks.length > 0

      ? persistedTasks

      : getUseCaseResponseTasks(ensureUseCaseResponse(useCase));



  const onSeedRef = React.useRef(onSeedUseCase);

  onSeedRef.current = onSeedUseCase;

  const didSeedRef = React.useRef(false);



  React.useEffect(() => {

    didSeedRef.current = false;

  }, [useCase.id]);



  React.useEffect(() => {

    if (didSeedRef.current) return;

    if (useCase.response?.tasks && useCase.response.tasks.length > 0) {

      didSeedRef.current = true;

      return;

    }

    const seeded = ensureUseCaseResponse(useCase);

    if (!seeded.response?.tasks?.length) return;

    didSeedRef.current = true;

    onSeedRef.current?.(seeded);

  }, [useCase.id, useCase.response?.tasks?.length, useCase]);



  const onTasksChange = React.useCallback(

    (updater: (prev: readonly TaskSequenceRow[]) => TaskSequenceRow[]) => {

      if (disabled) return;

      onPatchResponseTasks(useCase.id, updater);

    },

    [disabled, onPatchResponseTasks, useCase.id]

  );



  const hasOnlyMessage =

    tasks.length === 1 &&

    String(tasks[0]?.templateId ?? '')

      .toLowerCase()

      .replace(/-/g, '') === 'saymessage';



  return (

    <div

      className={[

        'rounded-lg',

        hasOnlyMessage

          ? 'border border-amber-400/70 bg-amber-950/10'

          : 'border border-amber-400/50 bg-slate-950/40',

        disabled ? 'pointer-events-none opacity-60' : '',

        className,

      ]

        .filter(Boolean)

        .join(' ')}

      aria-label="Response — sequenza messaggio e azioni"

    >

      <TaskSequenceFocusProvider>

        <div className="p-2">

          <TaskSequenceEditor

            tasks={tasks}

            onTasksChange={onTasksChange}

            listIndex={0}

            color="#fbbf24"

            allowedTemplateIds={AI_AGENT_RESPONSE_ALLOWED_TEMPLATES}

            fillAvailableHeight={false}

            emptyIdleLabel="Trascina un messaggio o un'azione dal pannello Azioni."

            emptyOverLabel="Rilascia per aggiungere al response"

          />

        </div>

      </TaskSequenceFocusProvider>

    </div>

  );

}


