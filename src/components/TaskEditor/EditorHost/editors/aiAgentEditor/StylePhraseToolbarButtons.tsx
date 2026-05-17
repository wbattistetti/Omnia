/**
 * Pulsanti lista combinazioni + Magic (polish / creative) per varianti di stile.
 */

import React from 'react';
import { List, Loader2, Sparkles, Wand2 } from 'lucide-react';
import {
  TOOLTIP_AGENT_MSG_GENERATE_STYLE_EXAMPLES,
  TOOLTIP_AGENT_MSG_STYLE_CREATIVE,
  TOOLTIP_AGENT_MSG_STYLE_POLISH,
} from './constants';
import { UC_AGENT_ROW_EDIT_BTN, UC_AGENT_STYLE_TOOL_BTN } from './useCaseComposerPresentation';

export type StylePhraseToolbarButtonsProps = {
  hasStyleTokens: boolean;
  /** Messaggio non vuoto: abilita varianti creative anche senza token «stile». */
  canRunCreative?: boolean;
  open: boolean;
  generating: 'polish' | 'creative' | null;
  canUseAi: boolean;
  busy?: boolean;
  showMagic: boolean;
  iconSize?: number;
  /** In modifica messaggio i pulsanti devono restare visibili (non solo al hover riga). */
  alwaysVisible?: boolean;
  onLoadLocalCombinatorics: () => void;
  onRunPolish: () => void;
  onRunCreative: () => void;
};

export function StylePhraseToolbarButtons({
  hasStyleTokens,
  canRunCreative = false,
  open,
  generating,
  canUseAi,
  busy = false,
  showMagic,
  iconSize = 18,
  alwaysVisible = false,
  onLoadLocalCombinatorics,
  onRunPolish,
  onRunCreative,
}: StylePhraseToolbarButtonsProps): React.ReactElement | null {
  const showCombinatorics = hasStyleTokens;
  const showCreative = Boolean(showMagic && (canRunCreative || hasStyleTokens));

  if (!showCombinatorics && !showCreative) return null;

  const btnClass = alwaysVisible ? UC_AGENT_STYLE_TOOL_BTN : UC_AGENT_ROW_EDIT_BTN;
  const styleBusy = busy || generating !== null;

  return (
    <>
      {showCombinatorics ? (
        <button
          type="button"
          disabled={styleBusy}
          aria-pressed={open}
          title={TOOLTIP_AGENT_MSG_GENERATE_STYLE_EXAMPLES}
          className={`${btnClass} ${open ? 'text-sky-300' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onLoadLocalCombinatorics();
          }}
        >
          <List size={iconSize} aria-hidden />
        </button>
      ) : null}
      {showMagic ? (
        <>
          {showCombinatorics ? (
            <button
              type="button"
              disabled={styleBusy || !canUseAi}
              title={TOOLTIP_AGENT_MSG_STYLE_POLISH}
              className={`${btnClass} ${generating === 'polish' ? 'text-sky-300' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onRunPolish();
              }}
            >
              {generating === 'polish' ? (
                <Loader2 size={iconSize} className="animate-spin" aria-hidden />
              ) : (
                <Wand2 size={iconSize} aria-hidden />
              )}
            </button>
          ) : null}
          {showCreative ? (
            <button
              type="button"
              disabled={styleBusy || !canUseAi}
              title={TOOLTIP_AGENT_MSG_STYLE_CREATIVE}
              className={`${btnClass} ${generating === 'creative' ? 'text-violet-300' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onRunCreative();
              }}
            >
              {generating === 'creative' ? (
                <Loader2 size={iconSize} className="animate-spin" aria-hidden />
              ) : (
                <Sparkles size={iconSize} aria-hidden />
              )}
            </button>
          ) : null}
        </>
      ) : null}
    </>
  );
}
