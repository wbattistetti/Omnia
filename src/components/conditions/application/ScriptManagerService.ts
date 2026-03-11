// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { DSLParser } from '../dsl/parser/DSLParser';
import { ASTCompiler } from '../dsl/compiler/ASTCompiler';
import { VariableMappingService } from '../dsl/compiler/VariableMappingService';
import { transformASTLabelsToGuids, convertDSLLabelsToGUIDs, convertDSLGUIDsToLabels, createVariableMappings } from '@utils/conditionCodeConverter';

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

    // ✅ FASE 2: Parse readableCode (DSL with labels) → AST
    const parseResult = this.parser.parse(dsl);

    if (!parseResult.ast || parseResult.errors.length > 0) {
      console.error('[ScriptManagerService][CREATE] ❌ DSL parsing failed', {
        errors: parseResult.errors
      });
      return { success: false, errors: parseResult.errors };
    }

    // ✅ FASE 2: Generate executableCode (DSL with GUIDs)
    const variableMappings = createVariableMappings();
    const executableCode = convertDSLLabelsToGUIDs(dsl, variableMappings);

    // ✅ FASE 2: Parse executableCode → AST (with GUIDs) for compilation
    const executableParseResult = this.parser.parse(executableCode);
    if (!executableParseResult.ast || executableParseResult.errors.length > 0) {
      console.error('[ScriptManagerService][CREATE] ❌ ExecutableCode parsing failed', {
        errors: executableParseResult.errors
      });
      return { success: false, errors: executableParseResult.errors };
    }

    // ✅ FASE 2: Compile AST (with GUIDs) → JavaScript
    let compiledCode: string;
    try {
      compiledCode = await this.compiler.compile(executableParseResult.ast);
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

    console.log('[ScriptManagerService][CREATE] ✅ Condition expression generated', {
      executableCodeLength: executableCode.length,
      compiledCodeLength: compiledCode.length
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

    // ✅ REFACTOR: Create the condition item and use the returned ID (not label search)
    try {
      // addItem now returns the created item with its ID
      const createdItem = await pdUpdate.addItem('conditions', categoryId, label, '');
      const conditionId = createdItem.id || createdItem._id;

      if (!conditionId) {
        console.error('[ScriptManagerService][CREATE] ❌ Created item has no ID');
        return { success: false, errors: [] };
      }

      // Reload projectData to get the fresh state
      const { ProjectDataService } = await import('@services/ProjectDataService');
      const refreshed = await ProjectDataService.loadProjectData();
      const finalPd = JSON.parse(JSON.stringify(refreshed));
      const finalConditions = finalPd?.conditions || [];

      // ✅ Find by ID (not by label) - ID is the primary key
      let found = false;
      for (const cat of finalConditions) {
        for (const item of (cat.items || [])) {
          const itemId = item.id || item._id;
          if (itemId === conditionId) {
            // ✅ FASE 2: Save only executableCode and compiledCode (readableCode generated on-the-fly)
            if (!item.expression) item.expression = {} as any;
            item.expression.executableCode = executableCode; // DSL with GUIDs - source of truth
            item.expression.compiledCode = compiledCode; // JavaScript compiled
            item.expression.format = 'dsl';
            // Transform AST: label → GUID before saving
            const transformedAST = await transformASTLabelsToGuids(parseResult.ast, this.variableMappingService);
            item.expression.ast = JSON.stringify(transformedAST);
            found = true;
            break;
          }
        }
        if (found) break;
      }

      if (found) {
        pdUpdate.updateDataDirectly(finalPd);
        console.log('[ScriptManagerService][CREATE] ✅ Created condition', {
          conditionName: label,
          conditionId,
          dslLength: dsl.length
        });
        return { success: true, errors: [], conditionId };
      } else {
        console.error('[ScriptManagerService][CREATE] ❌ Created item not found by ID after reload', {
          conditionId,
          conditionName: label
        });
        return { success: false, errors: [] };
      }
    } catch (error) {
      console.error('[ScriptManagerService][CREATE] ❌ Failed to create condition', error);
      return { success: false, errors: [] };
    }
  }

  /**
   * Updates existing condition by ID.
   * ✅ REFACTOR: conditionId is now REQUIRED (ID is the primary key, label can change/duplicate).
   * Returns conditionId so edge can be updated.
   */
  async saveScript(dsl: string, label: string, conditionId: string): Promise<{ success: boolean; errors: any[]; conditionId?: string }> {
    const { pdUpdate } = this.deps;

    if (!label || !conditionId || !pdUpdate) {
      console.warn('[ScriptManagerService][SAVE] ⚠️ Missing required data', {
        hasLabel: !!label,
        hasConditionId: !!conditionId,
        hasPdUpdate: !!pdUpdate
      });
      return {
        success: false,
        errors: [{
          message: conditionId ? 'Missing required data' : 'conditionId is required (ID is the primary key, label can change)',
          position: { line: 1, column: 1 },
          severity: 'error'
        }]
      };
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

    // ✅ FASE 2: Parse readableCode (DSL with labels) → AST
    const parseResult = this.parser.parse(dsl);

    if (!parseResult.ast || parseResult.errors.length > 0) {
      console.error('[ScriptManagerService][SAVE] ❌ DSL parsing failed', {
        errors: parseResult.errors
      });
      return { success: false, errors: parseResult.errors };
    }

    // ✅ FASE 2: Generate executableCode (DSL with GUIDs)
    const variableMappings = createVariableMappings();
    const executableCode = convertDSLLabelsToGUIDs(dsl, variableMappings);

    // ✅ FASE 2: Parse executableCode → AST (with GUIDs) for compilation
    const executableParseResult = this.parser.parse(executableCode);
    if (!executableParseResult.ast || executableParseResult.errors.length > 0) {
      console.error('[ScriptManagerService][SAVE] ❌ ExecutableCode parsing failed', {
        errors: executableParseResult.errors
      });
      return { success: false, errors: executableParseResult.errors };
    }

    // ✅ FASE 2: Compile AST (with GUIDs) → JavaScript
    let compiledCode: string;
    try {
      compiledCode = await this.compiler.compile(executableParseResult.ast);
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

    console.log('[ScriptManagerService][SAVE] ✅ Condition expression generated', {
      executableCodeLength: executableCode.length,
      compiledCodeLength: compiledCode.length
    });

    // ✅ Get fresh projectData from context (always use latest)
    const freshProjectData = (window as any).__projectData || projectData;
    const updatedPd = JSON.parse(JSON.stringify(freshProjectData));
    const conditions = updatedPd?.conditions || [];

    // ✅ REFACTOR: Search ONLY by ID (primary key), never by label
    let found = false;

    for (const cat of conditions) {
      for (const item of (cat.items || [])) {
        // ✅ REFACTOR: Search ONLY by ID (primary key), never by label
        const itemId = item.id || item._id;
        if (itemId === conditionId) {
          // ✅ FASE 2: Save only executableCode and compiledCode (readableCode generated on-the-fly)
          if (!item.expression) item.expression = {} as any;
          item.expression.executableCode = executableCode; // DSL with GUIDs - source of truth
          item.expression.compiledCode = compiledCode; // JavaScript compiled
          item.expression.format = 'dsl';
          // Transform AST: label → GUID before saving
          const transformedAST = await transformASTLabelsToGuids(parseResult.ast, this.variableMappingService);
          item.expression.ast = JSON.stringify(transformedAST);

          found = true;
          console.log('[ScriptManagerService][SAVE] ✅ Saved condition expression', {
            conditionName: label,
            conditionId,
            executableCodeLength: executableCode.length,
            compiledCodeLength: compiledCode.length
          });
          break;
        }
      }
      if (found) break;
    }

    if (found) {
      pdUpdate.updateDataDirectly(updatedPd);
      console.log('[ScriptManagerService][SAVE] ✅ Updated projectData via updateDataDirectly');
      return { success: true, errors: [], conditionId };
    } else {
      // Condition not found by ID
      console.error('[ScriptManagerService][SAVE] ❌ Condition not found by ID', {
        conditionId,
        conditionName: label
      });
      return {
        success: false,
        errors: [{
          message: `Condition with ID ${conditionId} not found. Use createCondition() to create a new condition.`,
          position: { line: 1, column: 1 },
          severity: 'error'
        }]
      };
    }
  }

  /**
   * Loads DSL script from project data by ID.
   * ✅ FASE 2: Returns readableCode (DSL with labels) generated on-the-fly from executableCode
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
          // ✅ FASE 2: Read executableCode (DSL with GUIDs) and convert to readableCode (DSL with labels)
          const executableCode = (item as any).expression?.executableCode;
          if (!executableCode) {
            return null;
          }

          // Convert GUID → label on-the-fly
          const variableMappings = createVariableMappings();
          const readableCode = convertDSLGUIDsToLabels(executableCode, variableMappings);
          return readableCode;
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
