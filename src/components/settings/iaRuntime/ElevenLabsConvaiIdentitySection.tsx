/**
 * ConvAI Agent ID e provisioning ElevenLabs — collocato in Developer tools (non nel pannello principale).
 */

import React from 'react';
import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';
import { FieldHint } from './FieldHint';

export interface ElevenLabsConvaiIdentitySectionProps {
  config: IAAgentConfig;
  onChange: (next: IAAgentConfig) => void;
  onProvisionConvaiAgent?: () => Promise<void>;
}

export function ElevenLabsConvaiIdentitySection({
  config,
  onChange,
  onProvisionConvaiAgent,
}: ElevenLabsConvaiIdentitySectionProps) {
  const [provisionBusy, setProvisionBusy] = React.useState(false);
  const [provisionError, setProvisionError] = React.useState<string | null>(null);

  return (
    <div className="flex max-w-[min(100%,22rem)] flex-col gap-1.5 border-b border-slate-800/80 pb-2">
      <FieldHint
        label="ElevenLabs Agent ID"
        tooltip="ID dell’agente ConvAI ElevenLabs (dashboard ElevenLabs / ConvAI); richiesto per il runtime hosted startAgent/readPrompt."
        className="w-full shrink-0"
      >
        <div data-ia-runtime-focus="agentId">
          <input
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="es. agent_…"
            className="box-border h-8 w-full min-w-[12rem] max-w-[22rem] rounded border border-slate-600 bg-slate-950 px-1.5 font-mono text-xs text-slate-100 placeholder:text-slate-500"
            value={config.convaiAgentId ?? ''}
            onChange={(e) => {
              const v = e.target.value.trim();
              onChange({
                ...config,
                convaiAgentId: v.length > 0 ? v : undefined,
              });
            }}
          />
        </div>
      </FieldHint>
      {onProvisionConvaiAgent && !(config.convaiAgentId ?? '').trim() ? (
        <div className="flex max-w-[min(100%,22rem)] flex-col gap-0.5 shrink-0">
          <button
            type="button"
            disabled={provisionBusy}
            onClick={async () => {
              setProvisionError(null);
              setProvisionBusy(true);
              try {
                await onProvisionConvaiAgent();
              } catch (e) {
                setProvisionError(e instanceof Error ? e.message : String(e));
              } finally {
                setProvisionBusy(false);
              }
            }}
            className="h-8 rounded border border-violet-600/80 bg-violet-950/60 px-2 text-[11px] font-medium text-violet-100 hover:bg-violet-900/50 disabled:opacity-50"
          >
            {provisionBusy ? 'Creazione agente…' : 'Crea agente ConvAI (ElevenLabs API)'}
          </button>
          {provisionError ? (
            <p className="text-[10px] leading-tight text-red-400">{provisionError}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
