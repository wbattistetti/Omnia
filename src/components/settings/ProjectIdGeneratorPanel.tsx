/**
 * Mostra il Project ID deterministico BookFromAgenda (`Omnia_<cliente>_<progetto>_<versione>`) per il progetto
 * corrente e consente la copia negli appunti (stessi segmenti della compile).
 */

import React from 'react';
import { Check, Copy } from 'lucide-react';
import type { ProjectData } from 'types/project';
import { generateProjectId } from '../../utils/projectId/generateProjectId';
import { readOmniaCompileProjectSegments } from '../../utils/projectId/omniaCompileSegments';

export type ProjectIdGeneratorPanelProps = {
  /** Metadati progetto aperto; se assenti si usano fallback (localStorage / env) come in compile. */
  projectData?: ProjectData | null;
};

export function ProjectIdGeneratorPanel({ projectData }: ProjectIdGeneratorPanelProps) {
  const generated = React.useMemo(() => {
    const s = readOmniaCompileProjectSegments(projectData ?? null);
    return generateProjectId(s.cliente, s.nomeProgetto, s.versione);
  }, [projectData]);

  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generated);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [generated]);

  return (
    <div style={{ maxWidth: 560 }}>
      <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>Project ID</label>
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 8,
          borderRadius: 8,
          border: '1px solid #334155',
          background: '#111827',
          overflow: 'hidden',
        }}
      >
        <input
          readOnly
          value={generated}
          aria-readonly
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            background: 'transparent',
            color: '#e2e8f0',
            fontSize: 14,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            padding: '10px 12px',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => void handleCopy()}
          aria-label={copied ? 'Copiato' : 'Copia negli appunti'}
          title={copied ? 'Copiato' : 'Copia negli appunti'}
          style={{
            flexShrink: 0,
            width: 44,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            borderLeft: '1px solid #334155',
            background: copied ? '#065f46' : '#1e293b',
            color: '#e2e8f0',
            cursor: 'pointer',
          }}
        >
          {copied ? <Check size={18} strokeWidth={2.25} aria-hidden /> : <Copy size={18} strokeWidth={2.25} aria-hidden />}
        </button>
      </div>
    </div>
  );
}
