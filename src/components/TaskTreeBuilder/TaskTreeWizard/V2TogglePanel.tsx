import React, { useEffect, useState } from 'react';
import type { StepNotConfirmed } from '../../DialogueDataEngine/model/ddt.v2.types';
import NotConfirmedEditor from '../V2Editor/NotConfirmedEditor';
import DisambiguationEditor from '../V2Editor/DisambiguationEditor';
import { setV2Draft } from './V2DraftStore';

export default function V2TogglePanel() {
  const [enabled, setEnabled] = useState(false);
  const [notConf, setNotConf] = useState<StepNotConfirmed>({ prompts: ['', '', ''], offerHandoffAfter: 3, offerSkipAfter: 3 });
  const [disamb, setDisamb] = useState({ prompt: '', softRanking: true, defaultWithCancel: true, selectionMode: 'numbers' as const });
  const [reason, setReason] = useState<string>('');

  useEffect(() => {
    if (!enabled) return;
    const mainKey = '__main__';
    setV2Draft(mainKey, { notConfirmed: notConf, disambiguation: disamb, ask: { reason } });
  }, [enabled, notConf, disamb, reason]);

  return (
    <div aria-label="v2-toggle-panel" style={{ borderTop: '1px dashed #e5e7eb', marginTop: 12, paddingTop: 12 }}>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280' }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span>V2 authoring (experimental)</span>
      </label>
      {enabled && (
        <div style={{ marginTop: 10, border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>NotConfirmed (main)</div>
          <NotConfirmedEditor value={notConf} onChange={setNotConf} />
          <div style={{ fontWeight: 600, margin: '10px 0 6px' }}>Ask reason (main)</div>
          <input
            aria-label="ask-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ width: '100%', border: '1px solid #ddd', padding: 8, borderRadius: 6 }}
            placeholder="reason key (semantic)"
          />
          <div style={{ fontWeight: 600, margin: '10px 0 6px' }}>Disambiguation</div>
          <DisambiguationEditor value={disamb} onChange={setDisamb as any} />
        </div>
      )}
    </div>
  );
}


