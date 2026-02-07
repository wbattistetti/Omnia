import React, { useState, useMemo } from 'react';
import IntentListEditor from '@responseEditor/components/IntentListEditor';
import { taskRepository } from '@services/TaskRepository';

interface IntentListEditorWrapperProps {
  act: { id: string; type: string; label?: string; instanceId?: string };
  onIntentSelect?: (intentId: string | null) => void;
}

export default function IntentListEditorWrapper({
  act,
  onIntentSelect,
}: IntentListEditorWrapperProps) {
  const instanceId = (act as any)?.instanceId || act.id;
  const [selectedIntentId, setSelectedIntentId] = useState<string | null>(null);

  // FASE 3: Get current Task to react to changes
  const task = useMemo(() => {
    return taskRepository.getTask(instanceId);
  }, [instanceId]);

  const handleSelect = (intentId: string | null) => {
    setSelectedIntentId(intentId);
    onIntentSelect?.(intentId);
  };

  return (
    <div style={{ width: 300, minWidth: 250, maxWidth: 400, flexShrink: 0 }}>
      <IntentListEditor
        instanceId={instanceId}
        taskId={task.id}
        selectedIntentId={selectedIntentId}
        onIntentSelect={handleSelect}
        onIntentChange={(intents) => {
          // FASE 3: Intent changes are automatically saved to Task (TaskRepository syncs with InstanceRepository automatically)
          console.log('[ResponseEditor][IntentListEditor] Intents changed:', {
            instanceId,
            intentsCount: intents.length
          });
        }}
      />
    </div>
  );
}

