// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { convertUICodeToExecCode, convertExecCodeToUICode, createVariableMappings } from '@utils/conditionCodeConverter';

export interface ScriptManagerServiceDependencies {
  projectData: any;
  pdUpdate: any;
}

/**
 * Service for managing script persistence and conversion.
 * Handles saving/loading scripts with ExecCode (runtime) and UICode (editor).
 */
export class ScriptManagerService {
  constructor(private deps: ScriptManagerServiceDependencies) {}

  /**
   * Saves a script to project data.
   * script is UICode (with [label] placeholders) - converts to ExecCode for persistence.
   */
  saveScript(script: string, label: string): void {
    const { projectData, pdUpdate } = this.deps;

    if (!label || !projectData || !pdUpdate) {
      console.warn('[ScriptManagerService][SAVE] ⚠️ Missing required data', {
        hasLabel: !!label,
        hasProjectData: !!projectData,
        hasPdUpdate: !!pdUpdate
      });
      return;
    }

    console.log('[ScriptManagerService][SAVE] 🚀 START saving script', {
      conditionName: label,
      scriptLength: script?.length || 0,
      scriptPreview: script?.substring(0, 200) || ''
    });

    // script is UICode (with [label] placeholders)
    // Convert to ExecCode (with ctx["guid"]) for persistence
    const variableMappings = createVariableMappings();
    const execCode = convertUICodeToExecCode(script, variableMappings);

    console.log('[ScriptManagerService][SAVE] ✅ Conversion UICode → ExecCode complete', {
      uiCodeLength: script.length,
      execCodeLength: execCode.length,
      changed: script !== execCode
    });

    const updatedPd = JSON.parse(JSON.stringify(projectData));
    const conditions = updatedPd?.conditions || [];

    let found = false;
    for (const cat of conditions) {
      for (const item of (cat.items || [])) {
        const itemName = item.name || item.label;
        if (itemName === label) {
          if (!item.data) item.data = {};

          // Save both ExecCode and UICode
          item.data.execCode = execCode; // For runtime/persistence
          item.data.uiCode = script;     // For editor display

          // Keep data.script for backward compatibility (same as execCode)
          item.data.script = execCode;

          found = true;
          console.log('[ScriptManagerService][SAVE] ✅ Saved script to condition', {
            conditionName: label,
            itemId: item.id,
            execCodeLength: execCode.length,
            uiCodeLength: script.length
          });
          break;
        }
      }
      if (found) break;
    }

    if (found) {
      pdUpdate.updateDataDirectly(updatedPd);
      console.log('[ScriptManagerService][SAVE] ✅ Updated projectData via updateDataDirectly');
    } else {
      console.warn('[ScriptManagerService][SAVE] ⚠️ Condition not found in projectData', {
        conditionName: label,
        availableConditions: conditions.flatMap(cat => (cat.items || []).map((item: any) => item.name || item.label))
      });
    }
  }

  /**
   * Loads a script from project data.
   * Returns UICode (with [label] placeholders) for display in editor.
   */
  loadScript(label: string): string | null {
    const { projectData } = this.deps;

    if (!label || !projectData) {
      return null;
    }

    const conditions = projectData?.conditions || [];

    for (const cat of conditions) {
      for (const item of (cat.items || [])) {
        const itemName = item.name || item.label;
        if (itemName === label) {
          // Prefer uiCode, fallback to execCode (convert), then script (legacy)
          let execCode = item.data?.execCode || item.data?.script || '';

          if (execCode) {
            // Convert ExecCode → UICode for display
            const variableMappings = createVariableMappings();
            const uiCode = convertExecCodeToUICode(execCode, variableMappings);
            return uiCode;
          }

          // If uiCode exists, use it directly
          if (item.data?.uiCode) {
            return item.data.uiCode;
          }

          return null;
        }
      }
    }

    return null;
  }

  /**
   * Gets ExecCode for a condition (for runtime evaluation).
   */
  getExecCode(label: string): string | null {
    const { projectData } = this.deps;

    if (!label || !projectData) {
      return null;
    }

    const conditions = projectData?.conditions || [];

    for (const cat of conditions) {
      for (const item of (cat.items || [])) {
        const itemName = item.name || item.label;
        if (itemName === label) {
          // Prefer execCode, fallback to script (legacy)
          return item.data?.execCode || item.data?.script || null;
        }
      }
    }

    return null;
  }

  /**
   * Converts UICode to ExecCode (for saving).
   */
  convertForSave(script: string): string {
    const variableMappings = createVariableMappings();
    return convertUICodeToExecCode(script, variableMappings);
  }

  /**
   * Converts ExecCode to UICode (for display).
   */
  convertForDisplay(script: string): string {
    const variableMappings = createVariableMappings();
    return convertExecCodeToUICode(script, variableMappings);
  }
}
