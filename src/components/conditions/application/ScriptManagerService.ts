// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { convertScriptLabelsToGuids, convertScriptGuidsToLabels } from '@utils/conditionScriptConverter';

export interface ScriptManagerServiceDependencies {
  projectData: any;
  pdUpdate: any;
}

/**
 * Service for managing script persistence and conversion.
 * Handles saving/loading scripts and GUID ↔ Label conversion.
 */
export class ScriptManagerService {
  constructor(private deps: ScriptManagerServiceDependencies) {}

  /**
   * Saves a script to project data, converting labels to GUIDs before saving.
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

    // Convert label → GUID before saving (language-independent)
    console.log('[ScriptManagerService][SAVE] 🔄 Converting label → GUID before save');
    const scriptWithGuids = convertScriptLabelsToGuids(script);
    console.log('[ScriptManagerService][SAVE] ✅ Conversion complete', {
      originalLength: script.length,
      convertedLength: scriptWithGuids.length,
      changed: script !== scriptWithGuids
    });

    const updatedPd = JSON.parse(JSON.stringify(projectData));
    const conditions = updatedPd?.conditions || [];

    let found = false;
    for (const cat of conditions) {
      for (const item of (cat.items || [])) {
        const itemName = item.name || item.label;
        if (itemName === label) {
          if (!item.data) item.data = {};
          const oldScript = item.data.script || '';
          item.data.script = scriptWithGuids; // Save with GUIDs
          found = true;
          console.log('[ScriptManagerService][SAVE] ✅ Saved script to condition (converted to GUIDs)', {
            conditionName: label,
            itemId: item.id,
            scriptLength: scriptWithGuids.length,
            originalLength: script.length,
            oldScriptLength: oldScript.length,
            oldScriptPreview: oldScript.substring(0, 100)
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
   * Loads a script from project data, converting GUIDs to labels for display.
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
          const scriptWithGuids = item.data?.script || '';
          if (scriptWithGuids) {
            // Convert GUID → Label for display
            const scriptWithLabels = convertScriptGuidsToLabels(scriptWithGuids);
            return scriptWithLabels;
          }
          return null;
        }
      }
    }

    return null;
  }

  /**
   * Converts a script from labels to GUIDs (for saving).
   */
  convertForSave(script: string): string {
    return convertScriptLabelsToGuids(script);
  }

  /**
   * Converts a script from GUIDs to labels (for display).
   */
  convertForDisplay(script: string): string {
    return convertScriptGuidsToLabels(script);
  }
}
