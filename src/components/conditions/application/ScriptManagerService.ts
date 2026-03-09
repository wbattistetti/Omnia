// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { DSLParser } from '../dsl/parser/DSLParser';
import { ASTCompiler } from '../dsl/compiler/ASTCompiler';
import { VariableMappingService } from '../dsl/compiler/VariableMappingService';

export interface ScriptManagerServiceDependencies {
  projectData: any;
  pdUpdate: any;
  variables?: Record<string, any>; // Variables map for variable mapping service
}

/**
 * Service for managing DSL script persistence and compilation.
 * DSL is the only source of truth. JavaScript is always compiled from DSL.
 */
export class ScriptManagerService {
  private variableMappingService: VariableMappingService;
  private parser: DSLParser;
  private compiler: ASTCompiler;

  constructor(private deps: ScriptManagerServiceDependencies) {
    this.variableMappingService = new VariableMappingService();
    this.parser = new DSLParser();
    this.compiler = new ASTCompiler(this.variableMappingService);
  }

  /**
   * Creates a new condition with DSL script.
   * Returns conditionId so edge can be updated.
   */
  async createCondition(dsl: string, label: string): Promise<{ success: boolean; errors: any[]; conditionId?: string }> {
    const { pdUpdate } = this.deps;

    if (!label || !pdUpdate) {
      console.warn('[ScriptManagerService][CREATE] ⚠️ Missing required data', {
        hasLabel: !!label,
        hasPdUpdate: !!pdUpdate
      });
      return { success: false, errors: [] };
    }

    // ✅ Get fresh projectData from context (not from snapshot)
    let projectData: any = (window as any).__projectData || this.deps.projectData;
    if (!projectData) {
      console.warn('[ScriptManagerService][CREATE] ⚠️ No projectData available');
      return { success: false, errors: [] };
    }

    console.log('[ScriptManagerService][CREATE] 🚀 START creating condition', {
      conditionName: label,
      dslLength: dsl?.length || 0,
      dslPreview: dsl?.substring(0, 200) || ''
    });

    // Parse DSL → AST
    const parseResult = this.parser.parse(dsl);

    if (!parseResult.ast || parseResult.errors.length > 0) {
      console.error('[ScriptManagerService][CREATE] ❌ DSL parsing failed', {
        errors: parseResult.errors
      });
      return { success: false, errors: parseResult.errors };
    }

    // Compile AST → JavaScript
    let execCode: string;
    try {
      execCode = await this.compiler.compile(parseResult.ast);
    } catch (error: any) {
      console.error('[ScriptManagerService][CREATE] ❌ Compilation failed', { error });
      return {
        success: false,
        errors: [{
          message: error.message || 'Compilation error',
          position: { line: 1, column: 1 },
          severity: 'error'
        }]
      };
    }

    console.log('[ScriptManagerService][CREATE] ✅ DSL compiled to JavaScript', {
      dslLength: dsl.length,
      execCodeLength: execCode.length
    });

    // ✅ Get fresh projectData from context (always use latest)
    const freshProjectData = (window as any).__projectData || projectData;
    const currentPd = JSON.parse(JSON.stringify(freshProjectData));
    const conditions = currentPd?.conditions || [];
    let categoryId = '';

    if (conditions.length > 0) {
      categoryId = conditions[0].id;
    } else {
      // Create default category
      try {
        await pdUpdate.addCategory('conditions', 'Default Conditions');
        // Reload projectData to get the new category
        const { ProjectDataService } = await import('@services/ProjectDataService');
        const refreshed = await ProjectDataService.loadProjectData();
        const refreshedConditions = (refreshed as any)?.conditions || [];
        categoryId = refreshedConditions[0]?.id || '';
      } catch (error) {
        console.error('[ScriptManagerService][CREATE] ❌ Failed to create conditions category', error);
        return { success: false, errors: [] };
      }
    }

    if (!categoryId) {
      console.error('[ScriptManagerService][CREATE] ❌ No category ID available');
      return { success: false, errors: [] };
    }

    // Create the condition item
    try {
      await pdUpdate.addItem('conditions', categoryId, label, '');

      // Reload projectData to get the new item
      const { ProjectDataService } = await import('@services/ProjectDataService');
      const refreshed = await ProjectDataService.loadProjectData();
      const refreshedConditions = (refreshed as any)?.conditions || [];

      // Find the newly created item and save the script
      let createdItem: any = null;
      for (const cat of refreshedConditions) {
        for (const item of (cat.items || [])) {
          const itemName = item.name || item.label;
          if (itemName === label) {
            createdItem = item;
            break;
          }
        }
        if (createdItem) break;
      }

      if (createdItem) {
        // Update the newly created item with script data
        const finalPd = JSON.parse(JSON.stringify(refreshed));
        const finalConditions = finalPd?.conditions || [];

        for (const cat of finalConditions) {
          for (const item of (cat.items || [])) {
            const itemName = item.name || item.label;
            if (itemName === label) {
              if (!item.data) item.data = {};
              item.data.uiCode = dsl;
              item.data.uiCodeFormat = 'dsl';
              item.data.execCode = execCode;
              item.data.script = execCode;
              item.data.ast = JSON.stringify(parseResult.ast);
              item.data.dslMeta = {
                lastCompiledAt: new Date().toISOString(),
                errors: []
              };
              break;
            }
          }
        }

        pdUpdate.updateDataDirectly(finalPd);
        const conditionId = createdItem.id || createdItem._id;
        console.log('[ScriptManagerService][CREATE] ✅ Created condition', {
          conditionName: label,
          conditionId,
          dslLength: dsl.length
        });
        return { success: true, errors: [], conditionId };
      } else {
        console.error('[ScriptManagerService][CREATE] ❌ Created item not found after reload');
        return { success: false, errors: [] };
      }
    } catch (error) {
      console.error('[ScriptManagerService][CREATE] ❌ Failed to create condition', error);
      return { success: false, errors: [] };
    }
  }

  /**
   * Updates existing condition by ID.
   * If conditionId is provided, searches by ID; otherwise searches by label.
   * Returns conditionId so edge can be updated.
   */
  async saveScript(dsl: string, label: string, conditionId?: string): Promise<{ success: boolean; errors: any[]; conditionId?: string }> {
    const { pdUpdate } = this.deps;

    if (!label || !pdUpdate) {
      console.warn('[ScriptManagerService][SAVE] ⚠️ Missing required data', {
        hasLabel: !!label,
        hasPdUpdate: !!pdUpdate
      });
      return { success: false, errors: [] };
    }

    // ✅ Get fresh projectData from context (not from snapshot)
    const { useProjectData } = await import('@context/ProjectDataContext');
    let projectData: any = null;
    try {
      // Access projectData from context hook (but we can't use hooks here)
      // So we'll get it from window.__projectData which is updated by ProjectDataProvider
      projectData = (window as any).__projectData;
    } catch {
      // Fallback to deps.projectData if window.__projectData is not available
      projectData = this.deps.projectData;
    }

    if (!projectData) {
      console.warn('[ScriptManagerService][SAVE] ⚠️ No projectData available', {
        hasWindowData: !!(window as any).__projectData,
        hasDepsData: !!this.deps.projectData
      });
      return { success: false, errors: [] };
    }

    console.log('[ScriptManagerService][SAVE] 🚀 START saving DSL', {
      conditionName: label,
      conditionId,
      dslLength: dsl?.length || 0,
      dslPreview: dsl?.substring(0, 200) || ''
    });

    // Parse DSL → AST
    const parseResult = this.parser.parse(dsl);

    if (!parseResult.ast || parseResult.errors.length > 0) {
      console.error('[ScriptManagerService][SAVE] ❌ DSL parsing failed', {
        errors: parseResult.errors
      });
      return { success: false, errors: parseResult.errors };
    }

    // Compile AST → JavaScript
    let execCode: string;
    try {
      execCode = await this.compiler.compile(parseResult.ast);
    } catch (error: any) {
      console.error('[ScriptManagerService][SAVE] ❌ Compilation failed', { error });
      return {
        success: false,
        errors: [{
          message: error.message || 'Compilation error',
          position: { line: 1, column: 1 },
          severity: 'error'
        }]
      };
    }

    console.log('[ScriptManagerService][SAVE] ✅ DSL compiled to JavaScript', {
      dslLength: dsl.length,
      execCodeLength: execCode.length
    });

    // ✅ Get fresh projectData from context (always use latest)
    const freshProjectData = (window as any).__projectData || projectData;
    const updatedPd = JSON.parse(JSON.stringify(freshProjectData));
    const conditions = updatedPd?.conditions || [];

    let found = false;
    let foundConditionId: string | undefined = undefined;

    for (const cat of conditions) {
      for (const item of (cat.items || [])) {
        // ✅ Search by ID if provided, otherwise by label
        const itemId = item.id || item._id;
        const itemName = item.name || item.label;
        const matches = conditionId
          ? (itemId === conditionId)
          : (itemName === label);

        if (matches) {
          if (!item.data) item.data = {};

          // Save DSL as source of truth
          item.data.uiCode = dsl;
          item.data.uiCodeFormat = 'dsl';
          item.data.execCode = execCode;
          item.data.script = execCode; // Legacy compatibility
          item.data.ast = JSON.stringify(parseResult.ast);
          item.data.dslMeta = {
            lastCompiledAt: new Date().toISOString(),
            errors: []
          };

          foundConditionId = itemId;
          found = true;
          console.log('[ScriptManagerService][SAVE] ✅ Saved DSL to condition', {
            conditionName: label,
            conditionId: foundConditionId,
            searchedBy: conditionId ? 'ID' : 'label',
            dslLength: dsl.length,
            execCodeLength: execCode.length
          });
          break;
        }
      }
      if (found) break;
    }

    if (found) {
      pdUpdate.updateDataDirectly(updatedPd);
      console.log('[ScriptManagerService][SAVE] ✅ Updated projectData via updateDataDirectly');
      return { success: true, errors: [], conditionId: foundConditionId };
    } else {
      // ✅ If conditionId was provided but not found, this is an error
      if (conditionId) {
        console.error('[ScriptManagerService][SAVE] ❌ Condition not found by ID', {
          conditionId,
          conditionName: label
        });
        return {
          success: false,
          errors: [{
            message: `Condition with ID ${conditionId} not found`,
            position: { line: 1, column: 1 },
            severity: 'error'
          }]
        };
      }

      // ✅ If no conditionId, condition doesn't exist - should not happen during save
      console.error('[ScriptManagerService][SAVE] ❌ Condition not found (use createCondition instead)', {
        conditionName: label
      });
      return {
        success: false,
        errors: [{
          message: `Condition "${label}" not found. Use createCondition() to create a new condition.`,
          position: { line: 1, column: 1 },
          severity: 'error'
        }]
      };
    }
  }

  /**
   * Loads DSL script from project data by ID.
   * Returns DSL (source of truth).
   * Uses fresh data from window.__projectData for accuracy.
   */
  loadScriptById(conditionId: string): string | null {
    if (!conditionId) {
      return null;
    }

    // ✅ Get fresh projectData from context (not from snapshot)
    const projectData: any = (window as any).__projectData || this.deps.projectData;
    if (!projectData) {
      return null;
    }

    const conditions = projectData?.conditions || [];

    for (const cat of conditions) {
      for (const item of (cat.items || [])) {
        const itemId = item.id || item._id;
        if (itemId === conditionId) {
          // Return DSL (uiCode) - source of truth
          return item.data?.uiCode || null;
        }
      }
    }

    return null;
  }

  /**
   * Loads DSL script from project data by label.
   * Returns DSL (source of truth).
   * @deprecated Use loadScriptById() when conditionId is available
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
          // Return DSL (uiCode) - source of truth
          return item.data?.uiCode || null;
        }
      }
    }

    return null;
  }

  /**
   * Gets compiled JavaScript for a condition (for runtime evaluation).
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
          // Return compiled JavaScript
          return item.data?.execCode || item.data?.script || null;
        }
      }
    }

    return null;
  }

  /**
   * Compiles DSL to JavaScript (without saving).
   * Used for preview/validation.
   */
  async compileDSL(dsl: string): Promise<{ success: boolean; jsCode: string | null; errors: any[] }> {
    const parseResult = this.parser.parse(dsl);

    if (!parseResult.ast || parseResult.errors.length > 0) {
      return {
        success: false,
        jsCode: null,
        errors: parseResult.errors
      };
    }

    try {
      const jsCode = await this.compiler.compile(parseResult.ast);
      return {
        success: true,
        jsCode,
        errors: []
      };
    } catch (error: any) {
      return {
        success: false,
        jsCode: null,
        errors: [{
          message: error.message || 'Compilation error',
          position: { line: 1, column: 1 },
          severity: 'error'
        }]
      };
    }
  }
}
