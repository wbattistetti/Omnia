/**
 * Lazy OpenAPI → SEND/RECEIVE preview for a ConvAI webhook row (workspace, read-only).
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { InterfaceMappingEditor } from '@components/FlowMappingPanel/InterfaceMappingEditor';
import {
  backendInputsToMappingEntries,
  backendOutputsToMappingEntries,
} from '@components/FlowMappingPanel/backendCallMappingAdapter';
import type { OpenApiInputUiKind } from '@services/openApiBackendCallSpec';
import {
  resolveToolBackendSignature,
  type ResolvedToolBackendSignature,
} from '@workspaces/elevenlabs/resolveToolBackendSignature';

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; signature: ResolvedToolBackendSignature }
  | { status: 'error'; message: string; detail?: string };

export type ElevenLabsToolBackendSignaturePanelProps = {
  operationalUrl: string;
  httpMethod?: string;
  /** Stable id for datalist prefixes (tool id). */
  listIdPrefix: string;
  active: boolean;
};

export function ElevenLabsToolBackendSignaturePanel({
  operationalUrl,
  httpMethod,
  listIdPrefix,
  active,
}: ElevenLabsToolBackendSignaturePanelProps): React.ReactElement | null {
  const [load, setLoad] = React.useState<LoadState>({ status: 'idle' });
  const requestKey = `${operationalUrl.trim()}|${(httpMethod || 'POST').trim().toUpperCase()}`;

  React.useEffect(() => {
    if (!active) {
      setLoad({ status: 'idle' });
      return;
    }
    const url = operationalUrl.trim();
    if (!url) {
      setLoad({
        status: 'error',
        message: 'Non sono riuscito a leggere la firma del backend.',
        detail: 'URL endpoint mancante.',
      });
      return;
    }

    let cancelled = false;
    setLoad({ status: 'loading' });
    void resolveToolBackendSignature(url, httpMethod).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setLoad({ status: 'ok', signature: res.signature });
        return;
      }
      setLoad({
        status: 'error',
        message: res.message,
        detail: res.detail,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [active, requestKey, operationalUrl, httpMethod]);

  if (!active) return null;

  if (load.status === 'loading' || load.status === 'idle') {
    return (
      <div className="flex items-center gap-2 py-1 text-[11px] text-slate-500" aria-busy="true">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-sky-400" aria-hidden />
        Lettura firma backend (OpenAPI)…
      </div>
    );
  }

  if (load.status === 'error') {
    return (
      <div className="py-1" role="status">
        <p className="text-xs font-medium text-amber-200/95">{load.message}</p>
        {load.detail?.trim() ? (
          <p className="mt-1 font-mono text-[10px] leading-snug text-slate-500">{load.detail.trim()}</p>
        ) : null}
        <p className="mt-2 text-[10px] text-slate-600">
          Verifica URL e metodo, oppure che lo spec OpenAPI sia raggiungibile (es. …/openapi.json).
        </p>
      </div>
    );
  }

  const { signature } = load;
  const sendEntries = backendInputsToMappingEntries(signature.inputs);
  const receiveEntries = backendOutputsToMappingEntries(signature.outputs);
  const apiOptions = [
    ...new Set(
      signature.inputs
        .map((r) => r.apiParam?.trim())
        .filter((x): x is string => Boolean(x))
    ),
  ];

  return (
    <div className="min-w-0" aria-label="Firma backend OpenAPI">
      <div className="pointer-events-none select-none opacity-[0.98]" aria-readonly="true">
        <InterfaceMappingEditor
          variant="backend"
          showVariantToggle={false}
          compactBackendPanels
          scrollMappingInParent
          showEndpoint={false}
          backendSend={sendEntries}
          backendReceive={receiveEntries}
          onBackendSendChange={() => {}}
          onBackendReceiveChange={() => {}}
          apiOptions={apiOptions}
          variableOptions={[]}
          listIdPrefix={listIdPrefix}
          backendSendParamKindByWireKey={
            signature.inputUiKindByWireKey as Record<string, OpenApiInputUiKind>
          }
          backendSendParamEnumByWireKey={signature.inputEnumByWireKey}
        />
      </div>
    </div>
  );
}
