/**
 * Sezione prompt: mappa slot NLU per deploy deterministico (chiavi `updates` → selectorSpec KB).
 */

import { listKbDocumentsReadyForDialogDeploy } from '@domain/convai/kbDialogDeployReadiness';
import { slugifySelectorColumnId } from '@domain/knowledgeBase/kbSelectorSpec';
import type { SelectorColumnSpec } from '@domain/knowledgeBase/kbSelectorSpec';

function formatSelectorColumn(col: SelectorColumnSpec): string {
  const key = slugifySelectorColumnId(col.headerLabel);
  const label = String(col.promptTemplate ?? col.headerLabel ?? key).trim();
  const kind = col.promptType === 'closed_list' ? 'elenco chiuso' : 'domanda aperta';
  const policy = col.askPolicy === 'optional' ? 'opzionale' : 'obbligatoria';
  return `- \`${key}\`: ${label} (${kind}, ${policy})`;
}

/** Chiavi slot selector (ordine tabella) per schema tool e prompt. */
export function collectKbDialogSlotColumnIds(
  agentKnowledgeBaseDocumentsJson: string | undefined | null
): string[] {
  const docs = listKbDocumentsReadyForDialogDeploy(agentKnowledgeBaseDocumentsJson);
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const doc of docs) {
    const spec = doc.documentSelectorSpec;
    if (!spec?.columns?.length) continue;
    const selectors = spec.columns
      .filter((c) => c.role === 'selector')
      .sort((a, b) => a.sortOrder - b.sortOrder || a.headerLabel.localeCompare(b.headerLabel, 'it'));
    for (const col of selectors) {
      const key = slugifySelectorColumnId(col.headerLabel);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      ids.push(key);
    }
  }
  return ids;
}

/** Blocco markdown con slot da compilare in `updates` per omnia_dialog_step. */
export function buildKbDialogSlotMapPromptSection(
  agentKnowledgeBaseDocumentsJson: string | undefined | null
): string {
  const docs = listKbDocumentsReadyForDialogDeploy(agentKnowledgeBaseDocumentsJson);
  if (docs.length === 0) return '';

  const blocks: string[] = [];
  for (const doc of docs) {
    const spec = doc.documentSelectorSpec;
    if (!spec?.columns?.length) continue;
    const selectors = spec.columns
      .filter((c) => c.role === 'selector')
      .sort((a, b) => a.sortOrder - b.sortOrder || a.headerLabel.localeCompare(b.headerLabel, 'it'));
    if (selectors.length === 0) continue;

    const lines = selectors.map(formatSelectorColumn);
    const header =
      docs.length === 1
        ? 'Usa **solo** queste chiavi in `updates` (non inventare altri nomi):'
        : `Documento «${doc.name}» — chiavi \`updates\`:`;
    blocks.push([header, ...lines].join('\n'));
  }

  if (blocks.length === 0) return '';

  return [
    blocks.join('\n\n'),
    '',
    'Normalizza il parlato utente al valore tabella quando possibile (es. «cardiologia» → valore canonico della colonna specialità).',
    'Se l’utente risponde con più slot in un turno, includili tutti in `updates`.',
  ].join('\n');
}
