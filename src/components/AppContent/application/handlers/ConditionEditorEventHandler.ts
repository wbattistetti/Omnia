// Application layer: ConditionEditor event handler
// Handles conditionEditor:open events and prepares DockTab

import type { DockTab } from '@dock/types';
import type { ConditionEditorOpenEvent } from '../../domain/editorEvents';
import { validateConditionEditorEvent } from '../../domain/editorEvents';
import { SIDEBAR_TYPE_COLORS, SIDEBAR_TYPE_ICONS, SIDEBAR_ICON_COMPONENTS } from '@components/Sidebar/sidebarTheme';
import { getNodesWithFallback } from '@utils/taskTreeMigrationHelpers';
import { ConditionAIService } from '@components/conditions/application/ConditionAIService';
import { ScriptManagerService } from '@components/conditions/application/ScriptManagerService';
import { updateEdgeWithConditionId } from '@services/EdgeConditionUpdater';
import { getActiveFlowCanvasId } from '../../../../flows/activeFlowCanvas';
import { getSafeProjectId } from '@utils/safeProjectId';
import { buildFlowchartVariableLabelRecord } from '@components/conditions/conditionEditorLiveVariables';
import { resolveTemplateTreeNodeVariableId } from '@utils/dslVariableUiLabel';

export interface ConditionEditorEventHandlerParams {
  projectData: any;
  pdUpdate: any;
  onLoadingChange?: (isLoading: boolean) => void;
}

export class ConditionEditorEventHandler {
  private aiService: ConditionAIService;

  constructor(private params: ConditionEditorEventHandlerParams) {
    this.aiService = new ConditionAIService();
  }

  /**
   * Handles conditionEditor:open event
   * If needsGeneration is true, generates script using AI with complete variables
   */
  async handle(event: ConditionEditorOpenEvent): Promise<{
    tabId: string;
    dockTab: DockTab;
  }> {
    // Validate event
    if (!validateConditionEditorEvent(event)) {
      throw new Error('Invalid ConditionEditorOpenEvent');
    }

    const flowCanvasId = event.flowId ?? getActiveFlowCanvasId();

    // Build complete variables (staticVars + flowchartVars)
    const provided = event.variables || {};
    const hasProvided = provided && Object.keys(provided).length > 0;
    const staticVars = this.buildStaticVars();
    const flowchartVars = this.buildFlowchartVars(flowCanvasId);
    const varsTree = this.buildVarsTree();

    // Merge all variables
    const allVars = { ...staticVars, ...flowchartVars };
    const finalVars = hasProvided ? provided : allVars;
    const variableNames = Object.keys(finalVars);

    // Get condition info
    const conditionLabel = event.label || event.name || 'Condition';
    const tabId = `cond_${event.nodeId || Date.now()}`;
    const edgeId = event.edgeId; // ✅ Edge ID
    const conditionId = event.conditionId; // ✅ Condition ID (if edge is linked)

    console.log('[ConditionEditorEventHandler] 📥 [TRACE] Handling conditionEditor:open event', {
      timestamp: new Date().toISOString(),
      tabId,
      edgeId,
      conditionId,
      label: conditionLabel,
      hasConditionId: !!conditionId,
      willCreateNew: !conditionId
    });

    // ✅ FASE 1: Simplified logic - no needsGeneration, no automatic regeneration
    // Use readableCode from event (if condition exists) or empty string (new condition)
    const readableCode = (event as any).readableCode || '';

    // Build DockTab - conditionId determines if condition exists
    const dockTab: DockTab = {
      id: tabId,
      title: conditionLabel,
      type: 'conditionEditor',
      variables: finalVars,
      script: readableCode, // ✅ DSL with labels (if condition exists) or empty (new condition)
      variablesTree: event.variablesTree || varsTree,
      label: conditionLabel,
      edgeId, // ✅ Edge ID
      conditionId, // ✅ Condition ID (if exists, undefined for new condition)
      flowId: flowCanvasId,
    };

    console.log('[ConditionEditorEventHandler] 📤 [TRACE] Created dockTab', {
      tabId,
      edgeId,
      conditionId,
      scriptLength: readableCode.length,
      hasScript: !!readableCode && readableCode.trim().length > 0
    });

    return {
      tabId,
      dockTab,
    };
  }

  /**
   * Finds a variable that semantically matches the given label.
   * Uses multiple matching strategies for better accuracy.
   */
  private findSemanticMatch(label: string, variables: string[]): string | null {
    if (!variables || variables.length === 0) return null;

    const labelNorm = this.normalizeText(label);
    const labelWords = this.extractWords(labelNorm);

    // Strategy 1: Exact match (case-insensitive)
    for (const v of variables) {
      const varNorm = this.normalizeText(v);
      if (varNorm === labelNorm) {
        return v;
      }
    }

    // Strategy 2: Variable's last part matches label
    for (const v of variables) {
      const varNorm = this.normalizeText(v);
      const varLastPart = varNorm.split('.').pop() || varNorm;
      if (labelNorm.includes(varLastPart) && varLastPart.length > 3) {
        return v;
      }
    }

    // Strategy 3: Label keywords in variable
    for (const v of variables) {
      const varNorm = this.normalizeText(v);
      const significantWords = labelWords.filter(w => w.length > 3);
      const matchCount = significantWords.filter(w => varNorm.includes(w)).length;
      if (matchCount >= Math.ceil(significantWords.length * 0.5) && matchCount > 0) {
        return v;
      }
    }

    // Strategy 4: Word overlap scoring
    let bestMatch: { var: string; score: number } | null = null;
    for (const v of variables) {
      const varWords = this.extractWords(this.normalizeText(v));
      const overlap = labelWords.filter(w => varWords.some(vw => vw.includes(w) || w.includes(vw)));
      const score = overlap.length / Math.max(labelWords.length, 1);
      if (score > 0.4 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { var: v, score };
      }
    }

    return bestMatch?.var || null;
  }

  /**
   * Normalizes text for comparison
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s.]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extracts meaningful words from text
   */
  private extractWords(text: string): string[] {
    const stopWords = new Set([
      'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una',
      'di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra',
      'e', 'o', 'ma', 'se', 'che', 'non', 'come', 'quando',
      'the', 'a', 'an', 'of', 'to', 'in', 'for', 'on', 'with',
      'and', 'or', 'but', 'if', 'as', 'at', 'by', 'is', 'are'
    ]);

    return text
      .split(/[\s.]+/)
      .filter(w => w.length > 2 && !stopWords.has(w));
  }

  /**
   * Builds static variables from all Agent Tasks' TaskTree structure
   */
  private buildStaticVars(): Record<string, any> {
    const vars: Record<string, any> = {};
    const data = this.params.projectData as any;
    try {
      const categories: any[] = (data?.taskTemplates || []) as any[];
      for (const cat of categories) {
        const items: any[] = (cat?.items || []) as any[];
        for (const it of items) {
          const taskName: string = String(it?.name || it?.label || '').trim();
          if (!taskName) continue;
          const taskTree: any = it?.ddt || it?.taskTree;
          if (!taskTree) continue;
          const mains: any[] = getNodesWithFallback(taskTree, 'ConditionEditorEventHandler.buildStaticVars');
          for (const m of (mains || [])) {
            const mainLabel: string = String(m?.labelKey || m?.label || m?.name || 'Data').trim();
            const mainKey = `${taskName}.${mainLabel}`;
            vars[mainKey] = vars[mainKey] ?? '';
            const subsArr: any[] = Array.isArray(m?.subData) ? m.subData : (Array.isArray(m?.subs) ? m.subs : []);
            for (const s of (subsArr || [])) {
              const subLabel: string = String(s?.labelKey || s?.label || s?.name || 'Field').trim();
              const subKey = `${taskName}.${mainLabel}.${subLabel}`;
              vars[subKey] = vars[subKey] ?? '';
            }
          }
        }
      }
    } catch { }
    return vars;
  }

  /**
   * Builds flowchart variables
   */
  private buildFlowchartVars(flowCanvasId: string): Record<string, any> {
    try {
      const projectId = getSafeProjectId();
      return buildFlowchartVariableLabelRecord(projectId, flowCanvasId) as Record<string, any>;
    } catch {
      return {};
    }
  }

  /**
   * Sub-fields for a template main node: prefer `subNodes` (TaskTreeNode) then legacy subData/subs.
   */
  private collectTemplateSubNodes(main: any): any[] {
    if (Array.isArray(main?.subNodes) && main.subNodes.length > 0) {
      return main.subNodes;
    }
    if (Array.isArray(main?.subData)) return main.subData;
    if (Array.isArray(main?.subs)) return main.subs;
    return [];
  }

  /**
   * Builds hierarchical tree with icons/colors for DSL menus / IntelliSense.
   * Carries stable `id` (GUID) on act / main / sub when present on template nodes so
   * {@link dslTreeNodeDisplayLabel} can resolve labels from project translations.
   */
  private buildVarsTree(): any[] {
    const tasks: any[] = [];
    const data = this.params.projectData as any;
    try {
      const categories: any[] = (data?.taskTemplates || []) as any[];
      const taskColor = (SIDEBAR_TYPE_COLORS as any)?.taskTemplates?.color || '#34d399';
      const iconKey = (SIDEBAR_TYPE_ICONS as any)?.taskTemplates;
      const Icon = (SIDEBAR_ICON_COMPONENTS as any)?.[iconKey];
      for (const cat of categories) {
        const items: any[] = (cat?.items || []) as any[];
        for (const it of items) {
          const taskName: string = String(it?.name || it?.label || '').trim();
          if (!taskName) continue;
          const taskTree: any = it?.ddt || it?.taskTree;
          if (!taskTree) continue;
          let mains: any[] = getNodesWithFallback(taskTree, 'ConditionEditorEventHandler.buildVarsTree');
          if (!mains.length && Array.isArray(taskTree?.mains)) {
            mains = taskTree.mains.filter(Boolean);
          }
          const mainsOut: any[] = [];
          for (const m of mains || []) {
            const mainLabel: string = String(m?.labelKey || m?.label || m?.name || 'Data').trim();
            const mainId = resolveTemplateTreeNodeVariableId(m);
            const subsArr = this.collectTemplateSubNodes(m);
            const subsOut = (subsArr || []).map((s: any) => {
              const subLabel = String(s?.labelKey || s?.label || s?.name || 'Field').trim();
              const subId = resolveTemplateTreeNodeVariableId(s);
              const sub: { label: string; kind: string; id?: string } = {
                label: subLabel,
                kind: String(s?.kind || s?.type || ''),
              };
              if (subId) sub.id = subId;
              return sub;
            });
            const mainRow: { label: string; kind: string; subs: typeof subsOut; id?: string } = {
              label: mainLabel,
              kind: String(m?.kind || m?.type || ''),
              subs: subsOut,
            };
            if (mainId) mainRow.id = mainId;
            mainsOut.push(mainRow);
          }
          const actId = resolveTemplateTreeNodeVariableId(it);
          const act: { label: string; color: string; Icon: any; mains: typeof mainsOut; id?: string } = {
            label: taskName,
            color: taskColor,
            Icon,
            mains: mainsOut,
          };
          if (actId) act.id = actId;
          tasks.push(act);
        }
      }
    } catch {
      /* keep tasks */
    }
    return tasks;
  }

  /**
   * Generates DSL condition in background and updates the dock tab
   * This method is called asynchronously after the tab is opened
   */
  private async generateAndUpdate(
    tabId: string,
    label: string,
    variables: string[],
    finalVars: Record<string, any>,
    varsTree: any[],
    edgeId?: string,
    conditionId?: string
  ): Promise<void> {
    try {
      this.params.onLoadingChange?.(true);

      // Find semantic match
      const semanticMatch = this.findSemanticMatch(label, variables);

      // Generate DSL with AI using complete variables
      const dsl = await this.aiService.generateDSLFromLabel({
        label,
        variables,
        semanticMatch,
      });

      // ✅ Save DSL to ScriptManagerService
      if (dsl && dsl.trim()) {
        const scriptManager = new ScriptManagerService({
          projectData: this.params.projectData,
          pdUpdate: this.params.pdUpdate,
        });

        let savedConditionId: string | undefined = conditionId;

        if (conditionId) {
          // ✅ Edge already has conditionId - update existing condition
          const saveResult = await scriptManager.saveScript(dsl, label, conditionId);
          savedConditionId = saveResult.conditionId;
          console.log('[ConditionEditorEventHandler] ✅ DSL updated in existing condition', {
            label,
            conditionId: savedConditionId,
            dslLength: dsl.length
          });
        } else {
          // ✅ Edge doesn't have conditionId - create new condition
          const createResult = await scriptManager.createCondition(dsl, label);
          savedConditionId = createResult.conditionId;
          console.log('[ConditionEditorEventHandler] ✅ DSL saved to new condition', {
            label,
            conditionId: savedConditionId,
            dslLength: dsl.length
          });

          // ✅ Associate conditionId with edge SYNCHRONOUSLY (not via event)
          if (savedConditionId && edgeId) {
            const updated = updateEdgeWithConditionId(edgeId, savedConditionId);
            if (!updated) {
              console.warn('[ConditionEditorEventHandler] ⚠️ Failed to update edge synchronously', {
                edgeId,
                conditionId: savedConditionId
              });
            }
          }
        }
      }

      // Update dock tab via event (the dock tree will be updated by AppContent)
      const updateEvent = new CustomEvent('conditionEditor:update', {
        detail: {
          tabId,
          script: dsl,
          isGenerating: false,
        },
        bubbles: true,
      });
      document.dispatchEvent(updateEvent);
    } catch (e) {
      console.error('[ConditionEditorEventHandler] AI generation failed', e);
      // Update with empty DSL on error
      const updateEvent = new CustomEvent('conditionEditor:update', {
        detail: {
          tabId,
          script: '',
          isGenerating: false,
        },
        bubbles: true,
      });
      document.dispatchEvent(updateEvent);
    } finally {
      this.params.onLoadingChange?.(false);
    }
  }
}
