// Service to extract and manage readable variable names from DDT structures
// Features:
// - Incremental updates (merge/diff instead of delete+recreate)
// - Database persistence (saved when project is saved, loaded when project is opened)

import { getMainDataList, getSubDataList, hasMultipleMains, getLabel } from '../components/ActEditor/ResponseEditor/ddtSelectors';

interface VariableMapping {
  readableName: string; // e.g., "data di nascita", "data di nascita.giorno", "dati personali.Nominativo.Nome"
  nodeId: string; // DDT node ID (GUID)
  taskId: string; // Task ID
  rowId: string; // Row ID
  ddtPath: string; // Path in DDT structure (e.g., "mainData[0]", "mainData[0].subData[1]")
  createdAt: number;
  updatedAt: number;
}

interface DDTNodeSnapshot {
  nodeId: string;
  label: string;
  ddtPath: string;
  subData?: DDTNodeSnapshot[];
}

class FlowchartVariablesService {
  private mappings: Map<string, VariableMapping> = new Map(); // readableName -> mapping
  private nodeIdToReadableName: Map<string, string> = new Map(); // nodeId -> readableName
  private taskIdToReadableNames: Map<string, string[]> = new Map(); // taskId -> readableName[]
  private taskIdToSnapshot: Map<string, DDTNodeSnapshot[]> = new Map(); // taskId -> snapshot of DDT structure
  private projectId: string | null = null;
  private isInitialized: boolean = false; // Track initialization to avoid redundant DB calls

  /**
   * Initialize service for a project (loads from database)
   * Only loads from database if not already initialized for this project
   */
  async init(projectId: string): Promise<void> {
    // ✅ OPTIMIZATION: Skip reload if already initialized for the same project
    if (this.isInitialized && this.projectId === projectId) {
      // Already initialized for this project, skip database call
      return;
    }
    this.projectId = projectId;
    this.isInitialized = false; // Reset flag before loading
    await this.loadFromDatabase();
    this.isInitialized = true; // Mark as initialized after successful load
  }

  /**
   * Normalize row text (remove common prefixes)
   */
  private normalizeRowText(rowText: string): string {
    let normalized = rowText.trim();
    // Remove common Italian prefixes
    normalized = normalized.replace(/^(chiedi|richiedi|inserisci|fornisci|inserire|fornire)\s+/i, '');
    // Remove common English prefixes
    normalized = normalized.replace(/^(ask for|request|enter|provide|insert)\s+/i, '');
    // If empty after normalization, use original text
    if (!normalized || normalized.trim() === '') {
      normalized = rowText.trim();
    }
    return normalized;
  }

  /**
   * Create snapshot of DDT structure for comparison
   */
  private createDDTSnapshot(ddt: any): DDTNodeSnapshot[] {
    const mainDataList = getMainDataList(ddt);
    return mainDataList.map((mainData: any, mainIndex: number) => {
      const subDataList = getSubDataList(mainData);
      const subSnapshots = subDataList.map((subData: any, subIndex: number) => ({
        nodeId: subData.id || subData._id || '',
        label: getLabel(subData),
        ddtPath: `mainData[${mainIndex}].subData[${subIndex}]`
      }));

      return {
        nodeId: mainData.id || mainData._id || '',
        label: getLabel(mainData),
        ddtPath: `mainData[${mainIndex}]`,
        subData: subSnapshots.length > 0 ? subSnapshots : undefined
      };
    });
  }

  /**
   * Compare two snapshots and return diff
   */
  private diffSnapshots(
    oldSnapshot: DDTNodeSnapshot[],
    newSnapshot: DDTNodeSnapshot[]
  ): { added: DDTNodeSnapshot[]; removed: DDTNodeSnapshot[]; changed: DDTNodeSnapshot[] } {
    const oldNodeIds = new Set<string>();
    const newNodeIds = new Set<string>();

    const collectNodeIds = (snapshots: DDTNodeSnapshot[], set: Set<string>) => {
      snapshots.forEach(s => {
        if (s.nodeId) set.add(s.nodeId);
        if (s.subData) {
          s.subData.forEach(sub => {
            if (sub.nodeId) set.add(sub.nodeId);
          });
        }
      });
    };

    collectNodeIds(oldSnapshot, oldNodeIds);
    collectNodeIds(newSnapshot, newNodeIds);

    const added: DDTNodeSnapshot[] = [];
    const removed: DDTNodeSnapshot[] = [];
    const changed: DDTNodeSnapshot[] = [];

    // Find added nodes
    newSnapshot.forEach(newMain => {
      if (!oldNodeIds.has(newMain.nodeId)) {
        added.push(newMain);
      } else {
        // Check if label changed
        const oldMain = oldSnapshot.find(o => o.nodeId === newMain.nodeId);
        if (oldMain && oldMain.label !== newMain.label) {
          changed.push(newMain);
        }

        // Check subData
        if (newMain.subData) {
          newMain.subData.forEach(newSub => {
            if (!oldNodeIds.has(newSub.nodeId)) {
              added.push({ ...newSub, ddtPath: `${newMain.ddtPath}.subData[?]` });
            } else {
              const oldSub = oldMain?.subData?.find(o => o.nodeId === newSub.nodeId);
              if (oldSub && oldSub.label !== newSub.label) {
                changed.push({ ...newSub, ddtPath: `${newMain.ddtPath}.subData[?]` });
              }
            }
          });
        }
      }
    });

    // Find removed nodes
    oldSnapshot.forEach(oldMain => {
      if (!newNodeIds.has(oldMain.nodeId)) {
        removed.push(oldMain);
      } else {
        if (oldMain.subData) {
          oldMain.subData.forEach(oldSub => {
            if (!newNodeIds.has(oldSub.nodeId)) {
              removed.push(oldSub);
            }
          });
        }
      }
    });

    return { added, removed, changed };
  }

  /**
   * Extract readable variable names from DDT structure with incremental update
   */
  async extractVariablesFromDDT(
    ddt: any,
    taskId: string,
    rowId: string,
    rowText: string, // Row text (e.g., "chiedi data di nascita")
    nodeId?: string
  ): Promise<string[]> {
    if (!ddt) {
      console.warn('[FlowchartVariables] No DDT provided', { taskId, rowId });
      return [];
    }

    // Normalize row text
    const normalizedRowText = this.normalizeRowText(rowText);

    // Get mainData list
    const mainDataList = getMainDataList(ddt);
    const hasMultiple = hasMultipleMains(ddt);

    if (mainDataList.length === 0) {
      console.warn('[FlowchartVariables] No mainData found in DDT', { taskId, rowId });
      return [];
    }

    // Create snapshot of new DDT structure
    const newSnapshot = this.createDDTSnapshot(ddt);
    const oldSnapshot = this.taskIdToSnapshot.get(taskId) || [];

    // Calculate diff
    const diff = this.diffSnapshots(oldSnapshot, newSnapshot);

    // Remove mappings for deleted nodes
    diff.removed.forEach(removed => {
      const readableName = this.nodeIdToReadableName.get(removed.nodeId);
      if (readableName) {
        this.deleteMapping(readableName);
      }
    });

    // Update mappings for changed nodes (label changed)
    diff.changed.forEach(changed => {
      const oldReadableName = this.nodeIdToReadableName.get(changed.nodeId);
      if (oldReadableName) {
        // Rebuild readable name with new label
        const mapping = this.mappings.get(oldReadableName);
        if (mapping) {
          // Rebuild name based on structure
          const newReadableName = this.buildReadableName(changed, normalizedRowText, hasMultiple, mainDataList);
          if (newReadableName !== oldReadableName) {
            // Update mapping
            this.updateMapping(oldReadableName, newReadableName, changed.nodeId, taskId, rowId, nodeId, changed.ddtPath);
          }
        }
      }
    });

    // Add mappings for new nodes
    const readableNames: string[] = [];
    mainDataList.forEach((mainData: any, mainIndex: number) => {
      const mainLabel = getLabel(mainData);
      const mainNodeId = mainData.id || mainData._id;

      if (!mainNodeId) {
        console.warn('[FlowchartVariables] MainData missing ID', { mainIndex, taskId });
        return;
      }

      // Build variable name based on number of mainData
      let mainReadableName: string;
      if (hasMultiple) {
        mainReadableName = `${normalizedRowText}.${mainLabel}`;
      } else {
        mainReadableName = normalizedRowText;
      }

      // Create or update mapping for main data
      const existingMapping = this.nodeIdToReadableName.get(mainNodeId);
      if (!existingMapping) {
        this.createMapping(
          mainReadableName,
          mainNodeId,
          taskId,
          rowId,
          nodeId,
          `mainData[${mainIndex}]`
        );
      }
      readableNames.push(mainReadableName);

      // Process subData
      const subDataList = getSubDataList(mainData);
      if (subDataList.length > 0) {
        subDataList.forEach((subData: any, subIndex: number) => {
          const subLabel = getLabel(subData);
          const subNodeId = subData.id || subData._id;

          if (!subNodeId) {
            console.warn('[FlowchartVariables] SubData missing ID', { mainIndex, subIndex, taskId });
            return;
          }

          const subReadableName = `${mainReadableName}.${subLabel}`;

          // Create or update mapping for sub data
          const existingSubMapping = this.nodeIdToReadableName.get(subNodeId);
          if (!existingSubMapping) {
            this.createMapping(
              subReadableName,
              subNodeId,
              taskId,
              rowId,
              nodeId,
              `mainData[${mainIndex}].subData[${subIndex}]`
            );
          }
          readableNames.push(subReadableName);
        });
      }
    });

    // Save snapshot for next comparison
    this.taskIdToSnapshot.set(taskId, newSnapshot);

    // Note: Mappings are saved to database when project is saved (not immediately)

    console.log('[FlowchartVariables] Extracted variables from DDT (incremental)', {
      taskId,
      rowId,
      rowText: normalizedRowText,
      varCount: readableNames.length,
      added: diff.added.length,
      removed: diff.removed.length,
      changed: diff.changed.length,
      varNames: readableNames.slice(0, 10)
    });

    return readableNames;
  }

  /**
   * Build readable name from snapshot node
   */
  private buildReadableName(
    node: DDTNodeSnapshot,
    normalizedRowText: string,
    hasMultiple: boolean,
    mainDataList: any[]
  ): string {
    // Find parent mainData index
    const mainIndex = mainDataList.findIndex(m => {
      const mId = m.id || m._id;
      if (mId === node.nodeId) return true;
      const subs = getSubDataList(m);
      return subs.some(s => (s.id || s._id) === node.nodeId);
    });

    if (mainIndex === -1) {
      // Fallback: use node label directly
      return hasMultiple ? `${normalizedRowText}.${node.label}` : normalizedRowText;
    }

    const mainData = mainDataList[mainIndex];
    const mainLabel = getLabel(mainData);
    const mainReadableName = hasMultiple ? `${normalizedRowText}.${mainLabel}` : normalizedRowText;

    // Check if this is a subData
    const subDataList = getSubDataList(mainData);
    const subIndex = subDataList.findIndex(s => (s.id || s._id) === node.nodeId);

    if (subIndex !== -1) {
      return `${mainReadableName}.${node.label}`;
    }

    return mainReadableName;
  }

  /**
   * Create a mapping between readable name and node ID
   */
  private createMapping(
    readableName: string,
    nodeId: string,
    taskId: string,
    rowId: string,
    nodeIdParam: string | undefined,
    ddtPath: string
  ) {
    const now = Date.now();
    const mapping: VariableMapping = {
      readableName,
      nodeId,
      taskId,
      rowId,
      ddtPath,
      createdAt: now,
      updatedAt: now
    };

    this.mappings.set(readableName, mapping);
    this.nodeIdToReadableName.set(nodeId, readableName);

    // Track readable names by task
    if (!this.taskIdToReadableNames.has(taskId)) {
      this.taskIdToReadableNames.set(taskId, []);
    }
    const names = this.taskIdToReadableNames.get(taskId)!;
    if (!names.includes(readableName)) {
      names.push(readableName);
    }
  }

  /**
   * Update existing mapping
   */
  private updateMapping(
    oldReadableName: string,
    newReadableName: string,
    nodeId: string,
    taskId: string,
    rowId: string,
    nodeIdParam: string | undefined,
    ddtPath: string
  ) {
    const oldMapping = this.mappings.get(oldReadableName);
    if (!oldMapping) return;

    // Delete old mapping
    this.mappings.delete(oldReadableName);
    this.nodeIdToReadableName.delete(nodeId);

    // Create new mapping with preserved createdAt
    const newMapping: VariableMapping = {
      ...oldMapping,
      readableName: newReadableName,
      ddtPath,
      updatedAt: Date.now()
    };

    this.mappings.set(newReadableName, newMapping);
    this.nodeIdToReadableName.set(nodeId, newReadableName);

    // Update task tracking
    const names = this.taskIdToReadableNames.get(taskId) || [];
    const index = names.indexOf(oldReadableName);
    if (index !== -1) {
      names[index] = newReadableName;
    } else {
      names.push(newReadableName);
    }
    this.taskIdToReadableNames.set(taskId, names);
  }

  /**
   * Delete a mapping
   */
  private deleteMapping(readableName: string) {
    const mapping = this.mappings.get(readableName);
    if (!mapping) return;

    this.mappings.delete(readableName);
    this.nodeIdToReadableName.delete(mapping.nodeId);

    // Update task tracking
    const names = this.taskIdToReadableNames.get(mapping.taskId) || [];
    const filtered = names.filter(n => n !== readableName);
    if (filtered.length === 0) {
      this.taskIdToReadableNames.delete(mapping.taskId);
      this.taskIdToSnapshot.delete(mapping.taskId);
    } else {
      this.taskIdToReadableNames.set(mapping.taskId, filtered);
    }
  }

  /**
   * Get readable name from node ID
   */
  getReadableName(nodeId: string): string | null {
    const readableName = this.nodeIdToReadableName.get(nodeId) || null;
    if (!readableName) {
      console.log('[FlowchartVariables][getReadableName] ❌ No mapping found', {
        nodeId: nodeId.substring(0, 20) + '...',
        totalMappings: this.nodeIdToReadableName.size,
        sampleMappings: Array.from(this.nodeIdToReadableName.entries()).slice(0, 5).map(([id, name]) => ({
          id: id.substring(0, 20) + '...',
          name
        }))
      });
    }
    return readableName;
  }

  /**
   * Get node ID from readable name
   */
  getNodeId(readableName: string): string | null {
    return this.mappings.get(readableName)?.nodeId || null;
  }

  /**
   * Get all readable variable names (for ConditionEditor autocomplete)
   */
  getAllReadableNames(): string[] {
    return Array.from(this.mappings.keys()).sort();
  }

  /**
   * Get readable names by task ID
   */
  getReadableNamesByTaskId(taskId: string): string[] {
    return this.taskIdToReadableNames.get(taskId) || [];
  }

  /**
   * Map variableStore (using node IDs) to readable names
   */
  mapVariableStoreToReadableNames(variableStore: Record<string, any>): Record<string, any> {
    const mapped: Record<string, any> = {};

    Object.entries(variableStore).forEach(([nodeId, value]) => {
      const readableName = this.getReadableName(nodeId);
      if (readableName) {
        // If value is an object with { value, confirmed }, extract just the value
        if (value && typeof value === 'object' && 'value' in value && Object.keys(value).length <= 2) {
          mapped[readableName] = value.value;
        } else {
          mapped[readableName] = value;
        }
      }
    });

    return mapped;
  }

  /**
   * Delete mappings by task ID
   * Note: Changes are saved to database when project is saved
   */
  async deleteMappingsByTaskId(taskId: string): Promise<void> {
    const readableNames = this.taskIdToReadableNames.get(taskId) || [];
    readableNames.forEach(name => this.deleteMapping(name));
    this.taskIdToSnapshot.delete(taskId);
    // Note: Mappings are saved to database when project is saved (not immediately)
  }

  /**
   * Delete mappings by row ID
   * Note: Changes are saved to database when project is saved
   */
  async deleteMappingsByRowId(rowId: string): Promise<void> {
    const toDelete: string[] = [];
    this.mappings.forEach((mapping, name) => {
      if (mapping.rowId === rowId) {
        toDelete.push(name);
      }
    });
    toDelete.forEach(name => this.deleteMapping(name));
    // Note: Mappings are saved to database when project is saved (not immediately)
  }

  /**
   * Save mappings to database (called when project is saved)
   */
  async saveToDatabase(projectId?: string): Promise<boolean> {
    const pid = projectId || this.projectId;
    if (!pid) {
      console.warn('[FlowchartVariables] No projectId, cannot save to database');
      return false;
    }

    try {
      const data = {
        version: '1.0', // For future migrations
        mappings: Array.from(this.mappings.entries()),
        nodeIdToReadableName: Array.from(this.nodeIdToReadableName.entries()),
        taskIdToReadableNames: Array.from(this.taskIdToReadableNames.entries()),
        taskIdToSnapshot: Array.from(this.taskIdToSnapshot.entries())
      };

      const response = await fetch(`/api/projects/${pid}/variable-mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        console.error('[FlowchartVariables] Failed to save to database', response.statusText);
        return false;
      }

      console.log('[FlowchartVariables] Saved mappings to database', {
        count: this.mappings.size,
        projectId: pid
      });

      return true;
    } catch (e) {
      console.error('[FlowchartVariables] Error saving to database', e);
      return false;
    }
  }

  /**
   * Load mappings from database (called when project is opened)
   */
  private async loadFromDatabase(): Promise<void> {
    if (!this.projectId) return;

    try {
      const response = await fetch(`/api/projects/${this.projectId}/variable-mappings`);

      if (!response.ok) {
        if (response.status === 404) {
          // No mappings yet for this project (first time) - still mark as initialized
          // Removed verbose logging
          return;
        }
        throw new Error(`Failed to load: ${response.statusText}`);
      }

      const data = await response.json();

      if (data) {
        this.mappings.clear();
        this.nodeIdToReadableName.clear();
        this.taskIdToReadableNames.clear();
        this.taskIdToSnapshot.clear();

        // Handle version migration if needed
        const version = data.version || '1.0';

        if (data.mappings) {
          data.mappings.forEach(([name, m]: [string, VariableMapping]) => {
            this.mappings.set(name, m);
            this.nodeIdToReadableName.set(m.nodeId, name);
          });
        }
        if (data.taskIdToReadableNames) {
          data.taskIdToReadableNames.forEach(([taskId, names]: [string, string[]]) => {
            this.taskIdToReadableNames.set(taskId, names);
          });
        }
        if (data.taskIdToSnapshot) {
          data.taskIdToSnapshot.forEach(([taskId, snapshot]: [string, DDTNodeSnapshot[]]) => {
            this.taskIdToSnapshot.set(taskId, snapshot);
          });
        }

        // Removed verbose logging - service is initialized once at project open
      }
    } catch (e) {
      console.warn('[FlowchartVariables] Failed to load from database', e);
    }
  }

  /**
   * Clear all mappings (for testing or reset)
   * Note: Changes are saved to database when project is saved
   */
  async clear(): Promise<void> {
    this.mappings.clear();
    this.nodeIdToReadableName.clear();
    this.taskIdToReadableNames.clear();
    this.taskIdToSnapshot.clear();
    this.isInitialized = false; // Reset initialization flag
    // Note: Mappings are saved to database when project is saved (not immediately)
  }

  /**
   * Get statistics (for debugging/monitoring)
   */
  getStats(): {
    totalMappings: number;
    totalTasks: number;
    totalSnapshots: number;
  } {
    return {
      totalMappings: this.mappings.size,
      totalTasks: this.taskIdToReadableNames.size,
      totalSnapshots: this.taskIdToSnapshot.size
    };
  }
}

// Singleton instance
export const flowchartVariablesService = new FlowchartVariablesService();


