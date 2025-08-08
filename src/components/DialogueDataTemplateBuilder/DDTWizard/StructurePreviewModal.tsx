import React from 'react';

interface StructurePreviewModalProps {
  open: boolean;
  title: string;
  data: any;
  onCopy: () => void;
  onClose: () => void;
}

const StructurePreviewModal: React.FC<StructurePreviewModalProps> = ({ open, title, data, onCopy, onClose }) => {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '90%', maxWidth: 900, maxHeight: '80vh', overflow: 'auto', background: '#0f172a', color: '#e2e8f0', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #1e293b' }}>
          <div style={{ fontWeight: 700 }}>{title}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onCopy} style={{ background: '#7c3aed', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer' }}>Copy JSON</button>
            <button onClick={onClose} style={{ background: 'transparent', color: '#e2e8f0', border: '1px solid #475569', padding: '6px 12px', borderRadius: 6, cursor: 'pointer' }}>Close</button>
          </div>
        </div>
        <pre style={{ margin: 0, padding: 16, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  );
};

export default StructurePreviewModal;
