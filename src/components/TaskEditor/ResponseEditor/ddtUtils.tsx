import React from 'react';
import {
  Calendar, Mail, MapPin, FileText,
  PlayCircle, HelpCircle, MicOff, CheckCircle2, CheckSquare, AlertCircle, Wine, Shield
} from 'lucide-react';
import { findNodeByIndices } from '@responseEditor/core/domain';
import type { TaskTree } from '@types/taskTypes';

function isTaskTreeShape(tree: unknown): tree is TaskTree {
  return (
    tree != null &&
    typeof tree === 'object' &&
    Array.isArray((tree as TaskTree).nodes)
  );
}

/**
 * Legacy DDT rows used `subData[]` at the root; TaskTree uses `nodes[]` + domain navigation.
 */
function legacyGetNodeByIndex(taskTree: unknown, mainIndex: number | null | undefined): unknown {
  if (mainIndex == null) {
    return taskTree;
  }
  const subData = (taskTree as { subData?: unknown[] })?.subData;
  if (!Array.isArray(subData)) {
    return taskTree;
  }
  if (mainIndex < 0 || mainIndex >= subData.length) {
    return taskTree;
  }
  return subData[mainIndex];
}

export function getDDTIcon(type: string): JSX.Element {
  if (!type) return <FileText className="w-5 h-5 text-fuchsia-100 mr-2" />;
  const t = type.toLowerCase();
  if (t === 'date') return <Calendar className="w-5 h-5 text-fuchsia-100 mr-2" />;
  if (t === 'email') return <Mail className="w-5 h-5 text-fuchsia-100 mr-2" />;
  if (t === 'address') return <MapPin className="w-5 h-5 text-fuchsia-100 mr-2" />;
  return <FileText className="w-5 h-5 text-fuchsia-100 mr-2" />;
}

// TaskTree: domain navigation. Legacy root objects with `subData[]`: index into subData only.
export function getNodeByIndex(
  taskTree: unknown,
  mainIndex: number | null | undefined,
  subIndex: number | null | undefined = null
) {
  const sub = subIndex === undefined ? null : subIndex;
  if (isTaskTreeShape(taskTree)) {
    if (mainIndex == null && sub == null) {
      return taskTree;
    }
    return findNodeByIndices(taskTree, mainIndex ?? 0, sub);
  }
  return legacyGetNodeByIndex(taskTree, mainIndex);
}

export function ordinalIt(n: number): string {
  if (n === 1) return '1°';
  if (n === 2) return '2°';
  if (n === 3) return '3°';
  return `${n}°`;
}

export function buildDDTForUI(ddt: any, selectedNode: any) {
  if (!ddt) return ddt;

  // ✅ NO FALLBACKS: Steps must be dictionary format
  // If selectedNode.steps is array (MaterializedStep[]), convert to dictionary first
  let stepsDict: Record<string, any> = {};
  if (selectedNode?.steps) {
    if (Array.isArray(selectedNode.steps)) {
      // Convert array format to dictionary
      stepsDict = Object.fromEntries(
        selectedNode.steps.map((stepGroup: any) => [
          stepGroup.type,
          {
            escalations: (stepGroup.escalations || []).map((escalation: any) => ({
              type: 'escalation',
              id: escalation.escalationId,
              actions: escalation.actions
            }))
          }
        ])
      );
    } else if (typeof selectedNode.steps === 'object') {
      // Already dictionary format
      stepsDict = selectedNode.steps;
    }
  }

  return {
    ...ddt,
    steps: stepsDict
  };
}

export const stepMeta: Record<string, {
  icon: JSX.Element;
  label: string;
  border: string;
  bg: string;
  color: string;
  bgActive: string
}> = {
  start: { icon: <PlayCircle size={17} />, label: 'Chiedo il dato', border: '#3b82f6', bg: 'rgba(59,130,246,0.08)', color: '#3b82f6', bgActive: 'rgba(59,130,246,0.18)' },
  introduction: { icon: <Wine size={17} />, label: 'Introduzione', border: '#a855f7', bg: 'rgba(168,85,247,0.08)', color: '#a855f7', bgActive: 'rgba(168,85,247,0.18)' },
  noMatch: { icon: <HelpCircle size={17} />, label: 'Non capisco', border: '#ef4444', bg: 'rgba(239,68,68,0.08)', color: '#ef4444', bgActive: 'rgba(239,68,68,0.18)' },
  noInput: { icon: <MicOff size={17} />, label: 'Non sento', border: '#6b7280', bg: 'rgba(107,114,128,0.08)', color: '#6b7280', bgActive: 'rgba(107,114,128,0.18)' },
  confirmation: { icon: <CheckCircle2 size={17} />, label: 'Devo confermare', border: '#eab308', bg: 'rgba(234,179,8,0.08)', color: '#eab308', bgActive: 'rgba(234,179,8,0.18)' },
  notConfirmed: { icon: <AlertCircle size={17} />, label: 'Non Confermato', border: '#ef4444', bg: 'rgba(239,68,68,0.08)', color: '#ef4444', bgActive: 'rgba(239,68,68,0.18)' },
  invalid: { icon: <Shield size={17} />, label: 'Non valido', border: '#f59e0b', bg: 'rgba(245,158,11,0.08)', color: '#f59e0b', bgActive: 'rgba(245,158,11,0.18)' },
  success: { icon: <CheckSquare size={17} />, label: 'Ho capito!', border: '#22c55e', bg: 'rgba(34,197,94,0.08)', color: '#22c55e', bgActive: 'rgba(34,197,94,0.18)' },
};

/**
 * Steps that should not display escalation cards (no border, no header, no "Add escalation" button).
 * These steps display only the task list, taking up the full screen space.
 */
export const STEPS_WITHOUT_ESCALATION_CARD: string[] = ['start', 'success'];

/**
 * Checks if a step should display escalation cards (with border, header, and "Add escalation" button).
 * @param stepKey - The step key (e.g., 'start', 'noMatch', 'success')
 * @returns true if the step should display escalation cards, false otherwise
 */
export function hasEscalationCard(stepKey: string): boolean {
  return !STEPS_WITHOUT_ESCALATION_CARD.includes(stepKey);
}