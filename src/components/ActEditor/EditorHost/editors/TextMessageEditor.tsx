import React, { useState, useEffect, useMemo } from 'react';
import type { EditorProps } from '../../EditorHost/types';
import EditorHeader from '../../../common/EditorHeader';
import { getAgentActVisualsByType } from '../../../Flowchart/utils/actVisuals';
import { instanceRepository } from '../../../../services/InstanceRepository';
import { useProjectDataUpdate } from '../../../../context/ProjectDataContext';

export default function TextMessageEditor({ act, onClose }: EditorProps) {
  const instanceId = act.instanceId || act.id;
  const pdUpdate = useProjectDataUpdate();

  // Read initial text from instance (create if doesn't exist, like DDTHostAdapter)
  // Use useState initializer function to compute once on mount only
  const [text, setText] = useState(() => {
    if (!instanceId) return '';
    let instance = instanceRepository.getInstance(instanceId);
    if (!instance) {
      const actId = act.id || '';
      instance = instanceRepository.createInstanceWithId(instanceId, actId, []);
    }
    return instance?.message?.text || '';
  });

  // Update instanceRepository when text changes
  useEffect(() => {
    if (instanceId && text !== undefined) {
      instanceRepository.updateMessage(instanceId, { text });
    }
  }, [text, instanceId]);

  // Save to database on close
  const handleClose = async () => {
    if (instanceId) {
      try {
        const { ProjectDataService } = await import('../../../../services/ProjectDataService');
        const pid = pdUpdate?.getCurrentProjectId() || undefined;
        if (pid) {
          void ProjectDataService.updateInstance(pid, instanceId, { message: { text } })
            .catch((e: any) => { try { console.warn('[TextMessageEditor][close][PUT fail]', e); } catch { } });
          // broadcast per aggiornare la riga
          try { document.dispatchEvent(new CustomEvent('rowMessage:update', { detail: { instanceId, text } })); } catch { }
        }
      } catch { }
    }
    onClose?.();
  };

  return (
    <div className="h-full bg-white flex flex-col min-h-0">
      {(() => {
        const type = String(act?.type || 'Message') as any;
        const { Icon, color } = getAgentActVisualsByType(type, false);
        return (
          <EditorHeader
            icon={<Icon size={18} style={{ color }} />}
            title={String(act?.label || 'Message')}
            color="orange"
            onClose={handleClose}
          />
        );
      })()}
      <div className="p-4 flex-1 min-h-0 flex">
        <textarea
          className="w-full h-full rounded-xl border p-3 text-sm"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Scrivi il messaggio..."
        />
      </div>
    </div>
  );
}


