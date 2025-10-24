import React, { useState } from 'react';
import type { EditorProps } from '../../EditorHost/types';
import EditorHeader from '../../../common/EditorHeader';
import { getAgentActVisualsByType } from '../../../Flowchart/utils/actVisuals';

export default function TextMessageEditor({ act, onClose }: EditorProps) {
  const [text, setText] = useState('');
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
            onClose={onClose}
          />
        );
      })()}
      <div className="p-4 flex-1 min-h-0 flex">
        <textarea className="w-full h-full rounded-xl border p-3 text-sm" value={text} onChange={e => setText(e.target.value)} />
      </div>
    </div>
  );
}


