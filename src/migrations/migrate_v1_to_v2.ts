// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { VersionedProject, MigrationResult } from './types';

/**
 * Migrates project from v1.0 to v2.0
 *
 * MIGRATIONS PERFORMED:
 * 1. Normalize parsers → engines (if present)
 * 2. Normalize GrammarFlow → grammarFlow (camelCase)
 * 3. Remove orphan tasks (tasks not referenced in flows)
 * 4. Fix broken conditions (remove references to missing variables)
 * 5. Fix incomplete templates (add default language if missing)
 * 6. Fix flow edges pointing to non-existent tasks
 *
 * @param v1Project - Project in v1.0 format
 * @returns Migrated project in v2.0 format
 */
export function migrate_v1_to_v2(v1Project: VersionedProject): VersionedProject & MigrationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Start with a copy of the project
  const migrated: any = { ...v1Project };

  // 1. Set version to 2.0
  migrated.version = '2.0';

  // 2. Normalize parsers → engines (if present)
  if (migrated.tasks && Array.isArray(migrated.tasks)) {
    migrated.tasks = migrated.tasks.map((task: any) => {
      if (task.dataContract?.parsers && !task.dataContract?.engines) {
        warnings.push(`Task ${task.id}: Migrated parsers → engines`);
        return {
          ...task,
          dataContract: {
            ...task.dataContract,
            engines: task.dataContract.parsers,
            parsers: undefined, // Remove parsers
          },
        };
      }
      return task;
    });
  }

  if (migrated.templates && Array.isArray(migrated.templates)) {
    migrated.templates = migrated.templates.map((template: any) => {
      if (template.dataContract?.parsers && !template.dataContract?.engines) {
        warnings.push(`Template ${template.id}: Migrated parsers → engines`);
        return {
          ...template,
          dataContract: {
            ...template.dataContract,
            engines: template.dataContract.parsers,
            parsers: undefined, // Remove parsers
          },
        };
      }
      return template;
    });
  }

  // 3. Normalize GrammarFlow → grammarFlow (camelCase) in engines
  const normalizeGrammarFlow = (engines: any[]) => {
    if (!engines || !Array.isArray(engines)) return engines;
    return engines.map((engine: any) => {
      if (engine.GrammarFlow && !engine.grammarFlow) {
        warnings.push(`Engine ${engine.type}: Migrated GrammarFlow → grammarFlow`);
        return {
          ...engine,
          grammarFlow: engine.GrammarFlow,
          GrammarFlow: undefined, // Remove PascalCase
        };
      }
      return engine;
    });
  };

  if (migrated.tasks && Array.isArray(migrated.tasks)) {
    migrated.tasks = migrated.tasks.map((task: any) => {
      if (task.dataContract?.engines) {
        return {
          ...task,
          dataContract: {
            ...task.dataContract,
            engines: normalizeGrammarFlow(task.dataContract.engines),
          },
        };
      }
      return task;
    });
  }

  if (migrated.templates && Array.isArray(migrated.templates)) {
    migrated.templates = migrated.templates.map((template: any) => {
      if (template.dataContract?.engines) {
        return {
          ...template,
          dataContract: {
            ...template.dataContract,
            engines: normalizeGrammarFlow(template.dataContract.engines),
          },
        };
      }
      return template;
    });
  }

  // 4. Remove orphan tasks (tasks not referenced in flows)
  if (migrated.flows && migrated.tasks) {
    const referencedTaskIds = new Set<string>();

    // Extract referenced task IDs from flows
    Object.values(migrated.flows).forEach((flow: any) => {
      if (flow?.nodes && Array.isArray(flow.nodes)) {
        flow.nodes.forEach((node: any) => {
          const nodeData = node.data;
          if (nodeData?.rows && Array.isArray(nodeData.rows)) {
            nodeData.rows.forEach((row: any) => {
              if (row.id) {
                referencedTaskIds.add(row.id);
              }
            });
          }
        });
      }
    });

    const orphanTasks = migrated.tasks.filter((task: any) => !referencedTaskIds.has(task.id));
    if (orphanTasks.length > 0) {
      warnings.push(`Removed ${orphanTasks.length} orphan tasks: ${orphanTasks.map((t: any) => t.id).join(', ')}`);
      migrated.tasks = migrated.tasks.filter((task: any) => referencedTaskIds.has(task.id));
    }
  }

  // 5. Fix broken conditions (remove references to missing variables)
  if (migrated.conditions && migrated.variables) {
    const variableIds = new Set((migrated.variables || []).map((v: any) => v.id || v._id));

    migrated.conditions = migrated.conditions.map((condition: any) => {
      if (condition.variables && Array.isArray(condition.variables)) {
        const missingVars = condition.variables.filter((varId: string) => !variableIds.has(varId));
        if (missingVars.length > 0) {
          warnings.push(`Condition ${condition.id}: Removed references to missing variables: ${missingVars.join(', ')}`);
          return {
            ...condition,
            variables: condition.variables.filter((varId: string) => variableIds.has(varId)),
          };
        }
      }
      return condition;
    });
  }

  // 6. Fix incomplete templates (add default language if missing)
  if (migrated.templates && Array.isArray(migrated.templates)) {
    migrated.templates = migrated.templates.map((template: any) => {
      const hasPatterns = template.patterns && (
        (template.patterns.IT && template.patterns.IT.length > 0) ||
        (template.patterns.EN && template.patterns.EN.length > 0) ||
        (template.patterns.PT && template.patterns.PT.length > 0)
      );
      const hasLabel = !!template.label || !!template.name;

      if (!hasPatterns && !hasLabel) {
        warnings.push(`Template ${template.id}: Added default label (no language patterns found)`);
        return {
          ...template,
          label: template.label || template.name || 'Unnamed Template',
        };
      }
      return template;
    });
  }

  // 7. Fix flow edges pointing to non-existent tasks (remove invalid edges)
  if (migrated.flows && migrated.tasks) {
    const taskIds = new Set(migrated.tasks.map((t: any) => t.id));

    Object.keys(migrated.flows).forEach((flowId) => {
      const flow = migrated.flows[flowId];
      if (flow?.nodes && flow?.edges) {
        const nodeIds = new Set(flow.nodes.map((n: any) => n.id));

        // Remove edges pointing to non-existent nodes
        const invalidEdges = flow.edges.filter((edge: any) =>
          !nodeIds.has(edge.source) || !nodeIds.has(edge.target)
        );

        if (invalidEdges.length > 0) {
          warnings.push(`Flow ${flowId}: Removed ${invalidEdges.length} invalid edges`);
          flow.edges = flow.edges.filter((edge: any) =>
            nodeIds.has(edge.source) && nodeIds.has(edge.target)
          );
        }

        // Remove rows pointing to non-existent tasks
        flow.nodes.forEach((node: any) => {
          if (node.data?.rows && Array.isArray(node.data.rows)) {
            const invalidRows = node.data.rows.filter((row: any) => !taskIds.has(row.id));
            if (invalidRows.length > 0) {
              warnings.push(`Flow ${flowId}, Node ${node.id}: Removed ${invalidRows.length} invalid rows`);
              node.data.rows = node.data.rows.filter((row: any) => taskIds.has(row.id));
            }
          }
        });
      }
    });
  }

  return {
    ...migrated,
    success: errors.length === 0,
    version: '2.0',
    migrated: true,
    warnings: warnings.length > 0 ? warnings : undefined,
    errors: errors.length > 0 ? errors : undefined,
  };
}
