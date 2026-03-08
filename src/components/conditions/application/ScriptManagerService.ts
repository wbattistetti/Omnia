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
   * Saves DSL script to project data.
   * Compiles DSL → JavaScript and saves both.
   */
  saveScript(dsl: string, label: string): { success: boolean; errors: any[] } {
    const { projectData, pdUpdate } = this.deps;

    if (!label || !projectData || !pdUpdate) {
      console.warn('[ScriptManagerService][SAVE] ⚠️ Missing required data', {
        hasLabel: !!label,
        hasProjectData: !!projectData,
        hasPdUpdate: !!pdUpdate
      });
      return { success: false, errors: [] };
    }

    console.log('[ScriptManagerService][SAVE] 🚀 START saving DSL', {
      conditionName: label,
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
      execCode = this.compiler.compile(parseResult.ast);
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

    // Save to project data
    const updatedPd = JSON.parse(JSON.stringify(projectData));
    const conditions = updatedPd?.conditions || [];

    let found = false;
    for (const cat of conditions) {
      for (const item of (cat.items || [])) {
        const itemName = item.name || item.label;
        if (itemName === label) {
          if (!item.data) item.data = {};

          // Save DSL as source of truth
          item.data.uiCode = dsl;
          item.data.uiCodeFormat = 'dsl';
          item.data.execCode = execCode;
          item.data.script = execCode; // Legacy compatibility
          item.data.dslMeta = {
            lastCompiledAt: new Date().toISOString(),
            errors: []
          };

          found = true;
          console.log('[ScriptManagerService][SAVE] ✅ Saved DSL to condition', {
            conditionName: label,
            itemId: item.id,
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
      return { success: true, errors: [] };
    } else {
      console.warn('[ScriptManagerService][SAVE] ⚠️ Condition not found in projectData', {
        conditionName: label,
        availableConditions: conditions.flatMap(cat => (cat.items || []).map((item: any) => item.name || item.label))
      });
      return { success: false, errors: [] };
    }
  }

  /**
   * Loads DSL script from project data.
   * Returns DSL (source of truth).
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
  compileDSL(dsl: string): { success: boolean; jsCode: string | null; errors: any[] } {
    const parseResult = this.parser.parse(dsl);

    if (!parseResult.ast || parseResult.errors.length > 0) {
      return {
        success: false,
        jsCode: null,
        errors: parseResult.errors
      };
    }

    try {
      const jsCode = this.compiler.compile(parseResult.ast);
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
