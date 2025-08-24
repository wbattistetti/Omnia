import React from 'react';

interface UploadPanelProps {
  onUpload: (files: FileList | null, url?: string) => void;
}

export default function UploadPanel({ onUpload }: UploadPanelProps) {
  const [url, setUrl] = React.useState('');
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  function triggerFile() {
    fileInputRef.current?.click();
  }

  return (
    <div style={{ border: '1px solid #333', borderRadius: 8, padding: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Ingesta specifiche</div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={e => onUpload(e.target.files)} />
        <button onClick={triggerFile} style={{ background: '#374151', color: '#e5e7eb', border: '1px solid #4b5563', borderRadius: 6, padding: '8px 12px', fontWeight: 700 }}>Aggiungi file</button>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 36vw) auto', gap: 8, alignItems: 'center' }}>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Importa URL (Swagger/Postman/GraphQL/WSDL)" style={{ background: '#0b1220', color: '#e5e7eb', border: '1px solid #1f2937', borderRadius: 6, padding: '8px 10px' }} />
          <button onClick={() => onUpload(null, url)} style={{ background: '#2563eb', color: '#fff', border: '1px solid #1d4ed8', borderRadius: 6, padding: '8px 12px', fontWeight: 700 }}>Importa URL</button>
        </div>
      </div>
    </div>
  );
}


