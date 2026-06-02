/**
 * Platform pills for ConvAI sync when task runtime is not ElevenLabs yet.
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Bot, Cpu, Globe2, Mic, Sparkles } from 'lucide-react';
import type { IAAgentPlatform } from 'types/iaAgentRuntimeSetup';
import { AGENT_PLATFORM_DISPLAY_LABEL } from '@utils/iaAgentRuntime/globalVoiceByPlatform';

const PLATFORM_META: ReadonlyArray<{
  id: IAAgentPlatform;
  label: string;
  Icon: LucideIcon;
}> = [
  { id: 'openai', label: AGENT_PLATFORM_DISPLAY_LABEL.openai, Icon: Sparkles },
  { id: 'anthropic', label: AGENT_PLATFORM_DISPLAY_LABEL.anthropic, Icon: Bot },
  { id: 'google', label: AGENT_PLATFORM_DISPLAY_LABEL.google, Icon: Globe2 },
  { id: 'elevenlabs', label: AGENT_PLATFORM_DISPLAY_LABEL.elevenlabs, Icon: Mic },
  { id: 'custom', label: AGENT_PLATFORM_DISPLAY_LABEL.custom, Icon: Cpu },
];

export type ConvaiSyncPlatformPickerProps = {
  currentPlatform: IAAgentPlatform;
  onSelect: (platform: IAAgentPlatform) => void;
  busy?: boolean;
  nonElevenLabsHint?: string | null;
};

export function ConvaiSyncPlatformPicker({
  currentPlatform,
  onSelect,
  busy = false,
  nonElevenLabsHint = null,
}: ConvaiSyncPlatformPickerProps): React.ReactElement {
  return (
    <div className="space-y-2 rounded-lg border border-amber-700/50 bg-amber-950/35 px-3 py-2.5">
      <p className="text-xs leading-relaxed text-amber-100">
        Il runtime IA del task non è su <strong>ElevenLabs</strong>. Scegli la piattaforma per
        abilitare sync agente ConvAI (prompt, webhook, KB).
      </p>
      <div className="flex flex-wrap gap-1.5">
        {PLATFORM_META.map(({ id, label, Icon }) => {
          const active = currentPlatform === id;
          const isEl = id === 'elevenlabs';
          return (
            <button
              key={id}
              type="button"
              disabled={busy}
              title={label}
              onClick={() => onSelect(id)}
              className={
                'inline-flex h-8 items-center gap-1 rounded border px-2 py-1 text-[11px] transition-colors disabled:opacity-50 ' +
                (active
                  ? isEl
                    ? 'border-violet-500 bg-violet-950/70 text-violet-100'
                    : 'border-amber-500 bg-amber-950/60 text-amber-100'
                  : 'border-slate-600 bg-slate-900 text-slate-300 hover:border-slate-500')
              }
            >
              <Icon size={14} className="shrink-0 opacity-90" aria-hidden />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      {nonElevenLabsHint ? (
        <p className="text-[11px] text-amber-200/90" role="status">
          {nonElevenLabsHint}
        </p>
      ) : null}
    </div>
  );
}
