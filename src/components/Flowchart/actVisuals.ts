import { Ear, CheckCircle2, Megaphone } from 'lucide-react';
import { SIDEBAR_TYPE_COLORS } from '../Sidebar/sidebarTheme';
import { classifyActMode } from '../../nlp/actInteractivity';

export type ActMode = 'Message' | 'DataRequest' | 'DataConfirmation';

function dbgEnabled(): boolean {
  try { return Boolean(localStorage.getItem('debug.mode')); } catch { return false; }
}

export function findAgentAct(projectData: any, row: any) {
  try {
    const id = row?.actId || row?.baseActId || row?.factoryId;
    if (!id || !projectData?.agentActs) return null;
    for (const cat of projectData.agentActs) {
      const f = (cat.items || []).find(
        (it: any) =>
          it.id === id ||
          it._id === id ||
          it.id === row?.factoryId ||
          it._id === row?.factoryId
      );
      if (f) return f;
    }
  } catch {}
  return null;
}

export function resolveActMode(row: any, act: any): ActMode {
  // 1) Fonte primaria: il mode passato dall'Intellisense (row.mode)
  if (row?.mode) {
    try { if (dbgEnabled()) console.log('[Mode][resolve]', { source: 'row.mode(primary)', rowMode: row.mode, rowText: row?.text }); } catch {}
    return row.mode as ActMode;
  }
  // 2) Fallback: mode dell'Act (se non-Message)
  if (act?.mode && act.mode !== 'Message') {
    try { if (dbgEnabled()) console.log('[Mode][resolve]', { source: 'act.mode(non-Message)', actMode: act.mode, rowText: row?.text }); } catch {}
    return act.mode as ActMode;
  }
  // 3) Heuristics sull'Act: userActs presenti ⇒ richiesta dati
  if (Array.isArray(act?.userActs) && act.userActs.length > 0) {
    try { if (dbgEnabled()) console.log('[Mode][resolve]', { source: 'act.userActs', decided: 'DataRequest', rowText: row?.text }); } catch {}
    return 'DataRequest';
  }
  // 4) Classificazione dal titolo/label
  const guess = classifyActMode(act?.name || act?.label || row?.text || row?.name);
  try { if (dbgEnabled()) console.log('[Mode][resolve]', { source: 'classifyActMode', guess, actName: act?.name || act?.label, rowText: row?.text }); } catch {}
  return guess as ActMode;
}

export function hasActDDT(row: any, act: any): boolean {
  return Boolean(row?.ddt || act?.ddt || act?.ddtSnapshot);
}

export function getAgentActVisuals(mode: ActMode, hasDDT: boolean) {
  // Palette centralizzata dal tema
  const green = (SIDEBAR_TYPE_COLORS as any)?.agentActs?.color || '#22c55e';
  const blue = (SIDEBAR_TYPE_COLORS as any)?.backendActions?.color || '#60a5fa';
  const gray = '#6b7280';

  if (mode === 'DataRequest') {
    const out = { Icon: Ear, color: hasDDT ? blue : gray };
    try { if (dbgEnabled()) console.log('[Mode][visuals]', { mode, hasDDT, color: out.color }); } catch {}
    return out;
  }
  if (mode === 'DataConfirmation') {
    const out = { Icon: CheckCircle2, color: green };
    try { if (dbgEnabled()) console.log('[Mode][visuals]', { mode, hasDDT, color: out.color }); } catch {}
    return out;
  }
  const out = { Icon: Megaphone, color: green };
  try { if (dbgEnabled()) console.log('[Mode][visuals]', { mode, hasDDT, color: out.color }); } catch {}
  return out;
}


