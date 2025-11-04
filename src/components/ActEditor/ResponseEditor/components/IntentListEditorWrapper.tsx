import React, { useState, useMemo } from 'react';
import IntentListEditor from './IntentListEditor';
import { instanceRepository } from '../../../../services/InstanceRepository';

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

  // Get current instance to react to changes
  const instance = useMemo(() => {
    return instanceRepository.getInstance(instanceId);
  }, [instanceId]);

  const handleSelect = (intentId: string | null) => {
    setSelectedIntentId(intentId);
    onIntentSelect?.(intentId);
  };

  return (
    <div style={{ width: 300, minWidth: 250, maxWidth: 400, flexShrink: 0 }}>
      <IntentListEditor
        instanceId={instanceId}
        actId={act.id}
        selectedIntentId={selectedIntentId}
        onIntentSelect={handleSelect}
        onIntentChange={(intents) => {
          // Intent changes are automatically saved to instanceRepository
          console.log('[ResponseEditor][IntentListEditor] Intents changed:', {
            instanceId,
            intentsCount: intents.length
          });
        }}
      />
    </div>
  );
}

