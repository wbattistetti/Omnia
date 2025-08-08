import React from 'react';
import { getMessagesFor } from './ddtSelectors';

interface NodeViewerProps {
  node: any;
  stepKey: string;
}

export default function NodeViewer({ node, stepKey }: NodeViewerProps) {
  if (!node || !stepKey) return <div style={{ padding: 32, color: '#bbb', fontStyle: 'italic' }}>No content for this step.</div>;
  const messages = getMessagesFor(node, stepKey);
  if (!messages || (Array.isArray(messages) && messages.length === 0)) {
    return <div style={{ padding: 32, color: '#bbb', fontStyle: 'italic' }}>No content for this step.</div>;
  }
  return (
    <div style={{ padding: 32 }}>
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', fontSize: 16, color: '#333' }}>
        {JSON.stringify(messages, null, 2)}
      </pre>
    </div>
  );
}

