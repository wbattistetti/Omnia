import React from 'react';
import IntentEditorShell from './IntentEditorShell';

export default function IntentHostAdapter(_props: { act: { id: string; type: string; label?: string }, onClose?: () => void }) {
  try { if (localStorage.getItem('debug.intent') === '1') console.log('[IntentHostAdapter] mount', _props.act); } catch {}
  return <IntentEditorShell />;
}


