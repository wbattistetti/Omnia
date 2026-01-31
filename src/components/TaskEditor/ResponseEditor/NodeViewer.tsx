import React from 'react';
import { getMessagesFor } from './ddtSelectors';

interface NodeViewerProps {
  node: any;
  stepKey: string;
  translations?: Record<string, string>;
}

export default function NodeViewer({ node, stepKey, translations }: NodeViewerProps) {
  if (!node || !stepKey) return <div style={{ padding: 32, color: '#bbb', fontStyle: 'italic' }}>No content for this step.</div>;
  const data = getMessagesFor(node, stepKey);
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return <div style={{ padding: 32, color: '#bbb', fontStyle: 'italic' }}>No content for this step.</div>;
  }

  const [showJson, setShowJson] = React.useState(false);

  // Resolve actions texts from translations
  const resolvedLines: string[] = [];
  try {
    const stepObj = Array.isArray(data) ? undefined : (typeof data === 'object' ? data : undefined);
    const escalations = stepObj?.escalations;
    if (Array.isArray(escalations)) {
      for (const esc of escalations) {
        const tasks = esc?.tasks || [];
        for (const task of tasks) {
          const params = task?.parameters || [];
          for (const p of params) {
            const key = p?.value;
            if (typeof key === 'string') {
              const text = translations?.[key] || key;
              resolvedLines.push(String(text));
            }
          }
        }
      }
    } else if (typeof stepObj?.textKey === 'string') {
      const key = stepObj.textKey;
      resolvedLines.push(String(translations?.[key] || key));
    }
  } catch {}

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={() => setShowJson(false)} style={{ background: !showJson ? '#7c3aed' : 'transparent', color: !showJson ? '#fff' : '#7c3aed', border: '1px solid #7c3aed', borderRadius: 9999, padding: '6px 12px', cursor: 'pointer' }}>View text</button>
        <button onClick={() => setShowJson(true)} style={{ background: showJson ? '#7c3aed' : 'transparent', color: showJson ? '#fff' : '#7c3aed', border: '1px solid #7c3aed', borderRadius: 9999, padding: '6px 12px', cursor: 'pointer' }}>View JSON</button>
      </div>
      {!showJson ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, color: '#1f2937', fontSize: 16 }}>
          {resolvedLines.length > 0 ? resolvedLines.map((line, idx) => (
            <div key={idx} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }}>{line}</div>
          )) : (
            <div style={{ color: '#6b7280', fontStyle: 'italic' }}>No text</div>
          )}
        </div>
      ) : (
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', fontSize: 14, color: '#333', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

