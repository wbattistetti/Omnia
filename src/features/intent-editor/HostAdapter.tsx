import React, { useRef, useState, useMemo } from 'react';

import { getTaskVisualsByType } from '../../components/Flowchart/utils/taskVisuals';

import EmbeddingEditorShell, { EmbeddingEditorShellRef } from './EmbeddingEditorShell';

import type { EditorProps } from '../../components/TaskEditor/EditorHost/types';

import type { ToolbarButton } from '../../dock/types';

import { useHeaderToolbarContext } from '../../components/TaskEditor/ResponseEditor/context/HeaderToolbarContext';

import { Brain, Loader2 } from 'lucide-react';

import { useProblemClassificationPersistence } from './hooks/useProblemClassificationPersistence';



/**

 * Full-window embeddings editor host: hydrates/persists intent state via useProblemClassificationPersistence.

 */

export default function IntentHostAdapter({ task, onClose: _onClose, hideHeader, onToolbarUpdate }: EditorProps) {

  if (!task) {

    console.error('❌ [IntentHostAdapter] Task is undefined/null', { task });

    return (

      <div className="h-full w-full bg-red-900 text-white p-4 flex items-center justify-center">

        <div className="text-center">

          <h2 className="text-xl font-bold mb-2">Errore</h2>

          <p>Task non disponibile</p>

        </div>

      </div>

    );

  }



  const instanceId = task.instanceId || task.id;

  const projectId = (() => {

    try {

      return localStorage.getItem('currentProjectId') || '';

    } catch {

      return '';

    }

  })();



  useProblemClassificationPersistence({

    instanceId,

    projectId,

    templateTaskId: task.id,

    debounceMs: 700,

  });



  const taskType = task.type ?? 5;

  const { Icon, color } = getTaskVisualsByType(taskType, true);



  const editorRef = useRef<EmbeddingEditorShellRef>(null);

  const [trainState, setTrainState] = useState({ training: false, modelReady: false, canTrain: false });



  const toolbarButtons = useMemo<ToolbarButton[]>(() => {

    return [

      {

        icon: trainState.training ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} />,

        label: trainState.training ? 'Training...' : 'Train Model',

        onClick: () => editorRef.current?.handleTrain(),

        title: trainState.training

          ? 'Training in corso...'

          : trainState.modelReady

            ? 'Model ready - Click to retrain'

            : 'Train embeddings model',

        disabled: !trainState.canTrain || trainState.training,

      },

    ];

  }, [trainState.training, trainState.modelReady, trainState.canTrain]);



  const headerColor = '#f59e0b';

  React.useEffect(() => {

    if (hideHeader && onToolbarUpdate) {

      onToolbarUpdate(toolbarButtons, headerColor);

    }

  }, [hideHeader, toolbarButtons, onToolbarUpdate, headerColor]);



  const headerContext = useHeaderToolbarContext();

  React.useEffect(() => {

    if (headerContext) {

      headerContext.setIcon(<Icon size={18} style={{ color }} />);

      headerContext.setTitle(String(task?.label || 'Problem'));



      return () => {

        headerContext.setIcon(null);

        headerContext.setTitle(null);

      };

    }

  }, [headerContext, task?.label, Icon, color]);



  return (

    <div className="w-full flex flex-col flex-1 min-h-0">

      <div className="flex-1 min-h-0 overflow-hidden">

        <EmbeddingEditorShell

          ref={editorRef}

          instanceId={instanceId}

          onTrainStateChange={setTrainState}

          training={trainState.training}

          modelReady={trainState.modelReady}

          canTrain={trainState.canTrain}

        />

      </div>

    </div>

  );

}

