/**
 * Riga messaggio semantico: testo libero + token `[slot_id]` cliccabili con picker slot/descrizione.
 */

import React from 'react';
import { splitTokenizedText } from '@domain/useCaseGeneratorWizard/tokenizedText';
import type { ProjectSlotLexicon } from '@domain/useCaseBundle/projectSlotLexicon';
import { getSlotDefinition } from '@domain/useCaseBundle/dynamicSlotRegistry';
import { normalizeSlotId } from '@domain/useCaseBundle/projectSlotLexicon';
import {
  SlotIdPickerPopover,
  type SlotIdPickerCommitPayload,
} from './SlotIdPickerPopover';

export type SemanticTokenMessageLayerProps = {
  text: string;
  lexicon: ProjectSlotLexicon;
  mappedOptions: readonly string[];
  otherOptions: readonly string[];
  disabled?: boolean;
  interactive?: boolean;
  onSlotCommit: (oldToken: string, payload: SlotIdPickerCommitPayload) => void;
  className?: string;
};

function isGenericSlotName(name: string): boolean {
  return /^(undefined|slot)\d*$/u.test(name);
}

/** Evidenziazione token slot (layer semantico): blu, distinto dal giallo del messaggio leggibile. */
const SEMANTIC_SLOT_PILL =
  'rounded-[0.28rem] px-0.5 font-mono text-[0.92em] bg-sky-400/24 text-sky-100 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.58)]';
const SEMANTIC_SLOT_PILL_HOVER = 'hover:bg-sky-400/34';
const SEMANTIC_SLOT_PILL_ACTIVE = 'ring-1 ring-sky-400/75';
const GENERIC_SLOT_PILL =
  'rounded-[0.28rem] px-0.5 font-mono text-[0.92em] bg-rose-400/15 text-rose-200 shadow-[inset_0_0_0_1px_rgba(251,113,133,0.35)]';
const GENERIC_SLOT_PILL_HOVER = 'hover:bg-rose-400/25';

export function SemanticTokenMessageLayer({
  text,
  lexicon,
  mappedOptions,
  otherOptions,
  disabled = false,
  interactive = true,
  onSlotCommit,
  className = '',
}: SemanticTokenMessageLayerProps): React.ReactElement {
  const segments = React.useMemo(() => splitTokenizedText(text), [text]);
  const [activeToken, setActiveToken] = React.useState<string | null>(null);
  const anchorRef = React.useRef<HTMLButtonElement | null>(null);

  const closePicker = React.useCallback(() => {
    setActiveToken(null);
  }, []);

  const handleCommit = React.useCallback(
    (payload: SlotIdPickerCommitPayload) => {
      if (!activeToken) return;
      onSlotCommit(activeToken, payload);
      closePicker();
    },
    [activeToken, closePicker, onSlotCommit]
  );

  return (
    <>
      <p className={`text-sm leading-relaxed whitespace-pre-wrap ${className}`}>
        {segments.map((seg, i) => {
          if (seg.kind === 'text') {
            return <React.Fragment key={`t-${i}`}>{seg.text}</React.Fragment>;
          }
          const def = getSlotDefinition(lexicon, normalizeSlotId(seg.name));
          const generic = isGenericSlotName(seg.name);
          const title = def?.description?.trim()
            ? `${seg.name} — ${def.description.trim()}`
            : seg.name;
          if (!interactive || disabled) {
            return (
              <span
                key={`k-${i}`}
                title={title}
                className={generic ? GENERIC_SLOT_PILL : SEMANTIC_SLOT_PILL}
              >
                [{seg.name}]
              </span>
            );
          }
          return (
            <button
              key={`k-${i}`}
              type="button"
              title={`${title} — clicca per modificare`}
              ref={activeToken === seg.name ? anchorRef : undefined}
              onClick={(e) => {
                e.stopPropagation();
                setActiveToken(seg.name);
              }}
              className={[
                'mx-0.5 inline transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400/80',
                generic ? GENERIC_SLOT_PILL : SEMANTIC_SLOT_PILL,
                generic ? GENERIC_SLOT_PILL_HOVER : SEMANTIC_SLOT_PILL_HOVER,
                activeToken === seg.name ? SEMANTIC_SLOT_PILL_ACTIVE : '',
              ].join(' ')}
            >
              [{seg.name}]
            </button>
          );
        })}
      </p>
      {activeToken && interactive ? (
        <SlotIdPickerPopover
          key={activeToken}
          currentToken={activeToken}
          lexicon={lexicon}
          mappedOptions={mappedOptions}
          otherOptions={otherOptions}
          anchorRef={anchorRef}
          disabled={disabled}
          onCommit={handleCommit}
          onClose={closePicker}
        />
      ) : null}
    </>
  );
}
