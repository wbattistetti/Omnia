import React from 'react';
import UploadPanel from './UploadPanel';
import SourceList, { SourceItem } from './SourceList';
import EndpointCards, { EndpointCard } from './EndpointCards';
import SourceAccordion from './SourceAccordion';

export default function SourcesEditor() {
  const [sources, setSources] = React.useState<SourceItem[]>([]);
  const [selected, setSelected] = React.useState<string | undefined>(undefined);
  const [endpoints, setEndpoints] = React.useState<EndpointCard[]>([]);
  const [bySource, setBySource] = React.useState<Record<string, EndpointCard[]>>({});
  const [loading, setLoading] = React.useState(false);

  async function handleUpload(files: FileList | null, url?: string) {
    setLoading(true);
    try {
      const id = String(Math.random());
      const name = url || (files?.[0]?.name || 'Spec');
      const specStr = url ? await (await fetch(url)).text() : (files && files[0] ? await files[0].text() : '');
      let spec: any = {};
      try { spec = JSON.parse(specStr); } catch { /* YAML non gestito in questo mock */ }

      const eps: EndpointCard[] = parseSwaggerV2ToCards(spec);
      setSources(prev => [{ id, name, type: 'openapi', endpoints: eps.length }, ...prev]);
      setBySource(prev => ({ ...prev, [id]: eps }));
      setSelected(id);
      setEndpoints(eps);
    } finally { setLoading(false); }
  }

  React.useEffect(() => {
    if (!selected) return;
    setEndpoints(bySource[selected] || []);
  }, [selected, bySource]);

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: 12, height: '100%' }}>
      {/* Toolbar in testa al pannello */}
      <UploadPanel onUpload={handleUpload} />
      {/* Corpo: elenco sorgenti + endpoint */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, minHeight: 0 }}>
        <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <SourceList items={sources} selectedId={selected} onSelect={setSelected} />
        </div>
        <div style={{ overflow: 'auto' }}>
          {loading && <div style={{ color: '#9ca3af' }}>Analisi in corso…</div>}
          {!loading && sources.length > 0 && (
            <SourceAccordion sources={sources} bySource={bySource} initiallyOpenId={selected} />
          )}
          {!loading && sources.length === 0 && <div style={{ color: '#9ca3af' }}>Carica una specifica o seleziona una sorgente</div>}
        </div>
      </div>
    </div>
  );
}

function parseSwaggerV2ToCards(spec: any): EndpointCard[] {
  if (!spec || !spec.paths) return [];
  const out: EndpointCard[] = [];
  for (const path of Object.keys(spec.paths)) {
    const item = spec.paths[path] || {};
    for (const method of Object.keys(item)) {
      const op = item[method];
      if (!op || typeof op !== 'object') continue;
      const params = Array.isArray(op.parameters) ? op.parameters : [];
      const inputs = params.map((p: any) => ({
        name: p.name,
        location: (p.in || 'query') as any,
        type: p.type || (p.schema ? (p.schema.type || 'object') : 'string'),
        domain: (p.enum && p.enum.join(',')) || p.format || undefined,
        enumValues: Array.isArray(p.enum) ? p.enum : undefined,
        example: p.example || undefined,
        alias: suggestAlias(p.name),
      }));
      // responses: prefer a 2xx success code if present
      const responseKeys = Object.keys(op.responses || {});
      const successKey = responseKeys.find((k: string) => /^2\d\d$/.test(k)) || '200';
      const successResp = (op.responses && (op.responses[successKey] || op.responses['default'])) || {};
      const outputs = [{ status: Number(successKey) || 200, desc: String(successResp.description || 'OK'), mainFields: [] as string[] }];
      out.push({
        id: `${method}:${path}`,
        method,
        path,
        purpose: String(op.summary || op.description || ''),
        inputs,
        outputs,
        gaps: detectGapsV2(op)
      });
    }
  }
  return out;
}

function detectGapsV2(op: any): string[] {
  const gaps: string[] = [];
  if (!op.responses || !op.responses['400'] || !op.responses['404']) gaps.push('schema errori assente');
  return gaps;
}

function suggestAlias(name: string): string {
  if (!name) return '';
  // Alias di default: uguale al nome originale, ma più leggibile
  // - rimuove underscore/trattini
  // - comprime spazi
  return String(name)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


