/**
 * Dock toolbar + header chrome dell'AI Agent editor.
 *
 * Quando `hideHeader` \u00e8 true (Response Editor con header collassato), il pulsante primary
 * Create/Refine viene "mirrorato" nella tab toolbar globale via `onToolbarUpdate`. Il pulsante
 * IA secondario «Genera use case» NON appare pi\u00f9 nella tab toolbar: tutta la logica di
 * generazione/regenerazione use case vive ora nel sub-wizard interno al pannello Use Cases /
 * Conversation (vedi `ViewSkaGenerator` + `useUseCaseGeneratorWizard`). Mantenere un punto
 * d'ingresso duplicato nella toolbar globale era fonte di confusione.
 */

import React from 'react';
import { Bot, Loader2, Maximize2, Minimize2, Sparkles } from 'lucide-react';
import type { ToolbarButton } from '../../../../../dock/types';
import type { EditorProps } from '../../types';
import { useHeaderToolbarContext } from '../../../ResponseEditor/context/HeaderToolbarContext';
import { useAiBusyLabel } from '@hooks/useAiBusyLabel';
import { LABEL_CREATE_AGENT, LABEL_REFINE_AGENT, AI_AGENT_HEADER_COLOR } from './constants';

export interface UseAIAgentToolbarControllerParams {
  task: EditorProps['task'];
  hideHeader: boolean | undefined;
  onToolbarUpdate: EditorProps['onToolbarUpdate'];
  hasAgentGeneration: boolean;
  showPrimaryAgentAction: boolean;
  generating: boolean;
  /** Create Agent / Refine — same handler as the in-editor primary button. */
  onPrimaryAgentAction: () => void;
  /** Stato del toggle «espandi a tutto schermo» dell'AI Agent editor. */
  isExpanded: boolean;
  /** Toggle espandi/riduci dell'AI Agent editor. */
  onToggleExpanded: () => void;
  /**
   * Se `true`, il pulsante primary (Create/Refine) NON viene aggiunto alla tab toolbar.
   * Usato quando l'azione \u00e8 gi\u00e0 renderizzata altrove nello stesso editor (es. nello
   * header dello step Task del wizard di costruzione) per evitare duplicazione UI.
   */
  suppressPrimaryAgentActionInToolbar?: boolean;
}

export function useAIAgentToolbarController({
  task,
  hideHeader,
  onToolbarUpdate,
  hasAgentGeneration,
  showPrimaryAgentAction,
  generating,
  onPrimaryAgentAction,
  isExpanded,
  onToggleExpanded,
  suppressPrimaryAgentActionInToolbar = false,
}: UseAIAgentToolbarControllerParams) {
  const headerColor = AI_AGENT_HEADER_COLOR;
  const primaryAgentActionLabel = hasAgentGeneration ? LABEL_REFINE_AGENT : LABEL_CREATE_AGENT;
  /**
   * Busy label dinamica con il modello globale corrente. Coerente con il pulsante in pagina
   * (vedi `CreateAgentHeaderButton`) per dare al designer il feedback "quale modello sta
   * lavorando" durante chiamate lunghe.
   */
  const { busyLabel } = useAiBusyLabel();
  const primaryAgentBusyLabel = busyLabel(
    hasAgentGeneration ? 'Sto raffinando il task' : 'Sto creando il task'
  );

  const primaryToolbarButtons = React.useMemo<ToolbarButton[]>(() => {
    const buttons: ToolbarButton[] = [];
    if (showPrimaryAgentAction && !suppressPrimaryAgentActionInToolbar) {
      buttons.push({
        icon: generating ? (
          <Loader2 size={16} className="animate-spin" aria-hidden />
        ) : (
          <Sparkles size={16} aria-hidden />
        ),
        label: generating ? primaryAgentBusyLabel : primaryAgentActionLabel,
        onClick: () => onPrimaryAgentAction(),
        disabled: generating,
        primary: true,
        title: primaryAgentActionLabel,
      });
    }
    /**
     * Toggle «espandi a tutto schermo». Sempre in coda, icona-only, label vuota per non
     * occupare spazio orizzontale nella toolbar globale. L'etichetta accessibile \u00e8 in `title`.
     */
    buttons.push({
      icon: isExpanded ? (
        <Minimize2 size={16} aria-hidden />
      ) : (
        <Maximize2 size={16} aria-hidden />
      ),
      label: '',
      onClick: () => onToggleExpanded(),
      title: isExpanded ? 'Riduci editor' : 'Espandi editor a tutto schermo',
      primary: false,
    });
    return buttons;
  }, [
    showPrimaryAgentAction,
    suppressPrimaryAgentActionInToolbar,
    generating,
    primaryAgentActionLabel,
    primaryAgentBusyLabel,
    onPrimaryAgentAction,
    isExpanded,
    onToggleExpanded,
  ]);

  React.useEffect(() => {
    if (hideHeader && onToolbarUpdate) {
      onToolbarUpdate(primaryToolbarButtons, headerColor);
      return () => {
        onToolbarUpdate([], headerColor);
      };
    }
  }, [hideHeader, onToolbarUpdate, headerColor, primaryToolbarButtons]);

  const headerContext = useHeaderToolbarContext();
  const setHeaderIcon = headerContext?.setIcon;
  const setHeaderTitle = headerContext?.setTitle;

  React.useEffect(() => {
    if (!setHeaderIcon || !setHeaderTitle) return;
    setHeaderIcon(<Bot size={18} style={{ color: headerColor }} />);
    setHeaderTitle(String(task?.label || 'AI Agent'));
    return () => {
      setHeaderIcon(null);
      setHeaderTitle(null);
    };
  }, [setHeaderIcon, setHeaderTitle, task?.label, headerColor]);

  return { headerColor, primaryAgentActionLabel };
}
