// Application layer: ConditionEditor event handler
// Handles conditionEditor:open events and prepares DockTab

import type { DockTab } from '@dock/types';
import type { ConditionEditorOpenEvent } from '../../domain/editorEvents';
import { validateConditionEditorEvent } from '../../domain/editorEvents';
import { flowchartVariablesService } from '@services/FlowchartVariablesService';
import { SIDEBAR_TYPE_COLORS, SIDEBAR_TYPE_ICONS, SIDEBAR_ICON_COMPONENTS } from '@components/Sidebar/sidebarTheme';
import { getNodesWithFallback } from '@utils/taskTreeMigrationHelpers';

export interface ConditionEditorEventHandlerParams {
  projectData: any;
  pdUpdate: any;
}

export class ConditionEditorEventHandler {
  constructor(private params: ConditionEditorEventHandlerParams) {}

  /**
   * Handles conditionEditor:open event
   */
  async handle(event: ConditionEditorOpenEvent): Promise<{
    tabId: string;
    dockTab: DockTab;
  }> {
    // Validate event
    if (!validateConditionEditorEvent(event)) {
      throw new Error('Invalid ConditionEditorOpenEvent');
    }

    // Build variables
    const provided = event.variables || {};
    const hasProvided = provided && Object.keys(provided).length > 0;
    const staticVars = this.buildStaticVars();
    const flowchartVars = await this.buildFlowchartVars();
    const varsTree = this.buildVarsTree();

    // Merge variables
    const allVars = { ...staticVars, ...flowchartVars };
    const finalVars = hasProvided ? provided : allVars;

    // Build DockTab
    const conditionLabel = event.label || event.name || 'Condition';
    const conditionScript = event.script || '';
    const tabId = `cond_${event.nodeId || Date.now()}`;

    const dockTab: DockTab = {
      id: tabId,
      title: conditionLabel,
      type: 'conditionEditor',
      variables: finalVars,
      script: conditionScript,
      variablesTree: event.variablesTree || varsTree,
      label: conditionLabel,
    };

    return {
      tabId,
      dockTab,
    };
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
  private async buildFlowchartVars(): Promise<Record<string, any>> {
    const vars: Record<string, any> = {};
    try {
      const projectId = this.params.pdUpdate?.getCurrentProjectId();
      if (projectId) {
        await flowchartVariablesService.init(projectId);
        const varNames = flowchartVariablesService.getAllReadableNames();
        varNames.forEach(name => {
          vars[name] = ''; // Empty value, just for autocomplete
        });
      }
    } catch { }
    return vars;
  }

  /**
   * Builds hierarchical tree with icons/colors for Intellisense
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
          const mains: any[] = Array.isArray(taskTree?.nodes)
            ? taskTree.nodes
            : (Array.isArray(taskTree?.mains) ? taskTree.mains : []);
          const mainsOut: any[] = [];
          for (const m of (mains || [])) {
            const mainLabel: string = String(m?.labelKey || m?.label || m?.name || 'Data').trim();
            const subsArr: any[] = Array.isArray(m?.subData) ? m.subData : (Array.isArray(m?.subs) ? m.subs : []);
            const subsOut = (subsArr || []).map((s: any) => ({
              label: String(s?.labelKey || s?.label || s?.name || 'Field').trim(),
              kind: String(s?.kind || s?.type || ''),
            }));
            mainsOut.push({
              label: mainLabel,
              kind: String(m?.kind || m?.type || ''),
              subs: subsOut,
            });
          }
          tasks.push({ label: taskName, color: taskColor, Icon, mains: mainsOut });
        }
      }
    } catch { }
    return tasks;
  }
}
