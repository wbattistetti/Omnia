import { Ear, CheckCircle2, Megaphone, GitBranch, FileText, Server } from 'lucide-react';
import { SIDEBAR_TYPE_ICONS, SIDEBAR_ICON_COMPONENTS, SIDEBAR_TYPE_COLORS } from '../../Sidebar/sidebarTheme';
import { classifyActMode } from '../../../nlp/actInteractivity';
import type { ActType } from '../../types/project';
import { instanceRepository } from '../../../services/InstanceRepository';

export type ActMode = 'Message' | 'DataRequest' | 'DataConfirmation';

function dbgEnabled(): boolean {
  try { return Boolean(localStorage.getItem('debug.mode')); } catch { return false; }
}

export function findAgentAct(projectData: any, row: any) {
  try {
    const id = row?.actId || row?.baseActId || row?.factoryId || row?.instanceId;
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
  } catch { }
  return null;
}

export function resolveActMode(row: any, act: any): ActMode {
  // 1) Fonte primaria: il mode passato dall'Intellisense (row.mode)
  if (row?.mode) {
    try { if (dbgEnabled()) console.log('[Mode][resolve]', { source: 'row.mode(primary)', rowMode: row.mode, rowText: row?.text }); } catch { }
    return row.mode as ActMode;
  }
  // 2) Fallback: mode dell'Act (se non-Message)
  if (act?.mode && act.mode !== 'Message') {
    try { if (dbgEnabled()) console.log('[Mode][resolve]', { source: 'act.mode(non-Message)', actMode: act.mode, rowText: row?.text }); } catch { }
    return act.mode as ActMode;
  }
  // 3) Heuristics sull'Act: userActs presenti ⇒ richiesta dati
  if (Array.isArray(act?.userActs) && act.userActs.length > 0) {
    try { if (dbgEnabled()) console.log('[Mode][resolve]', { source: 'act.userActs', decided: 'DataRequest', rowText: row?.text }); } catch { }
    return 'DataRequest';
  }
  // 4) Classificazione dal titolo/label
  const guess = classifyActMode(act?.name || act?.label || row?.text || row?.name);
  try { if (dbgEnabled()) console.log('[Mode][resolve]', { source: 'classifyActMode', guess, actName: act?.name || act?.label, rowText: row?.text }); } catch { }
  return guess as ActMode;
}

export function hasActDDT(row: any, act: any): boolean {
  // ✅ CONTROLLA SOLO L'ISTANZA (non più row?.ddt o act?.ddt)
  const actType = resolveActType(row, act);
  const instanceId = row?.id || row?.instanceId;

  if (!instanceId) {
    return false;
  }

  try {
    const instance = instanceRepository.getInstance(instanceId);

    if (!instance) {
      return false;
    }

    // Per Message: controlla se c'è un messaggio
    if (actType === 'Message') {
      const hasMessage = Boolean(instance?.message?.text && instance.message.text.trim().length > 0);
      return hasMessage;
    }

    // Per altri tipi: controlla se c'è un DDT nell'istanza
    const hasDDT = Boolean(instance?.ddt);
    return hasDDT;
  } catch (err) {
    return false;
  }
}

// New: resolve explicit ActType with type as primary source
export function resolveActType(row: any, act: any): ActType {
  if (row?.type) {
    // quiet by default
    // try { if (dbgEnabled()) console.log('[Type][resolve]', { source: 'row.type(primary)', type: row.type, rowText: row?.text }); } catch {}
    return row.type as ActType;
  }
  if (act?.type) {
    // quiet by default
    // try { if (dbgEnabled()) console.log('[Type][resolve]', { source: 'act.type', type: act.type, rowText: row?.text }); } catch {}
    return act.type as ActType;
  }
  // Back-compat: map mode -> type when only legacy field is present
  const legacyMode = resolveActMode(row, act);
  if (legacyMode === 'DataRequest') return 'DataRequest';
  if (legacyMode === 'DataConfirmation') return 'Summarizer'; // DataConfirmation → Summarizer (confirmation è proprietà opzionale)
  return 'Message';
}

export function getAgentActVisualsByType(type: ActType, hasDDT: boolean) {
  const green = (SIDEBAR_TYPE_COLORS as any)?.agentActs?.color || '#22c55e';
  const blue = '#3b82f6';
  const indigo = '#6366f1';
  const amber = '#f59e0b';
  const cyan = '#06b6d4';
  const gray = '#94a3b8';

  let Icon: any = Megaphone;
  let labelColor = green; // Colore della label: sempre del tipo (anche senza DDT)
  let iconColor = gray; // Colore dell'icona: grigio se no DDT, colore del tipo se ha DDT

  switch (type) {
    case 'DataRequest':
      Icon = Ear;
      labelColor = blue; // Label sempre blu
      iconColor = hasDDT ? blue : gray; // Icona: blu se ha DDT, grigio se no
      break;
    case 'ProblemClassification':
      Icon = GitBranch;
      labelColor = amber; // Label sempre arancione
      iconColor = hasDDT ? amber : gray; // Icona: arancione se ha DDT, grigio se no
      break;
    case 'Summarizer':
      Icon = FileText;
      labelColor = cyan; // Label sempre cyan
      iconColor = hasDDT ? cyan : gray; // Icona: cyan se ha DDT, grigio se no
      break;
    case 'Negotiation':
      Icon = CheckCircle2;
      labelColor = indigo; // Label sempre indigo
      iconColor = hasDDT ? indigo : gray; // Icona: indigo se ha DDT, grigio se no
      break;
    case 'BackendCall':
      Icon = Server;
      labelColor = green; // Label sempre verde
      iconColor = hasDDT ? green : gray; // Icona: verde se ha DDT, grigio se no
      break;
    case 'Message':
    default:
      Icon = Megaphone;
      labelColor = green; // Label sempre verde
      iconColor = hasDDT ? green : gray; // Icona: verde se ha DDT, grigio se no
  }

  return {
    Icon,
    labelColor,
    iconColor,
    color: labelColor // Retrocompatibilità: color è alias di labelColor
  };
}


