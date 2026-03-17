// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { ProjectDomainModel } from './model';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string[];
  message: string;
  code: string;
}

/**
 * Validates a ProjectDomainModel against invariants
 *
 * INVARIANTS CHECKED:
 * - No orphan tasks (all tasks must be referenced in flows)
 * - No conditions with missing variables
 * - No templates without language
 * - No flow edges pointing to non-existent tasks
 * - No flow edges pointing to non-existent nodes
 * - No edges with conditionId pointing to non-existent conditions
 */
export function validateProjectDomain(domain: ProjectDomainModel): ValidationResult {
  const errors: ValidationError[] = [];

  // 1. Check for orphan tasks
  const referencedTaskIds = new Set<string>();
  domain.flows.forEach((flow) => {
    flow.nodes.forEach((node) => {
      node.data.rows.forEach((row) => {
        referencedTaskIds.add(row.id);
      });
    });
  });

  const orphanTasks = domain.tasks.filter((task) => !referencedTaskIds.has(task.id));
  if (orphanTasks.length > 0) {
    errors.push({
      path: ['tasks'],
      message: `Found ${orphanTasks.length} orphan tasks: ${orphanTasks.map((t) => t.id).join(', ')}`,
      code: 'ORPHAN_TASKS',
    });
  }

  // 2. Check for conditions with missing variables
  const variableIds = new Set(domain.variables.map((v) => v.id));
  domain.conditions.forEach((condition) => {
    if (condition.variables) {
      const missingVars = condition.variables.filter((varId) => !variableIds.has(varId));
      if (missingVars.length > 0) {
        errors.push({
          path: ['conditions', condition.id, 'variables'],
          message: `Condition "${condition.label}" references missing variables: ${missingVars.join(', ')}`,
          code: 'MISSING_VARIABLES',
        });
      }
    }
  });

  // 3. Check for templates without language (at least one pattern or label must exist)
  domain.templates.forEach((template) => {
    const hasPatterns = template.patterns && (
      (template.patterns.IT && template.patterns.IT.length > 0) ||
      (template.patterns.EN && template.patterns.EN.length > 0) ||
      (template.patterns.PT && template.patterns.PT.length > 0)
    );
    const hasLabel = !!template.label;
    if (!hasPatterns && !hasLabel) {
      errors.push({
        path: ['templates', template.id],
        message: `Template "${template.id}" has no language patterns or label`,
        code: 'TEMPLATE_NO_LANGUAGE',
      });
    }
  });

  // 4. Check for flow edges pointing to non-existent nodes
  domain.flows.forEach((flow) => {
    const nodeIds = new Set(flow.nodes.map((n) => n.id));
    flow.edges.forEach((edge) => {
      if (!nodeIds.has(edge.source)) {
        errors.push({
          path: ['flows', flow.id, 'edges', edge.id],
          message: `Edge "${edge.id}" points to non-existent source node: ${edge.source}`,
          code: 'EDGE_INVALID_SOURCE',
        });
      }
      if (!nodeIds.has(edge.target)) {
        errors.push({
          path: ['flows', flow.id, 'edges', edge.id],
          message: `Edge "${edge.id}" points to non-existent target node: ${edge.target}`,
          code: 'EDGE_INVALID_TARGET',
        });
      }
    });
  });

  // 5. Check for flow edges pointing to non-existent tasks (via rows)
  domain.flows.forEach((flow) => {
    const taskIds = new Set(domain.tasks.map((t) => t.id));
    flow.nodes.forEach((node) => {
      node.data.rows.forEach((row) => {
        if (!taskIds.has(row.id)) {
          errors.push({
            path: ['flows', flow.id, 'nodes', node.id, 'rows', row.id],
            message: `Row "${row.id}" references non-existent task`,
            code: 'ROW_INVALID_TASK',
          });
        }
      });
    });
  });

  // 6. Check for edges with conditionId pointing to non-existent conditions
  const conditionIds = new Set(domain.conditions.map((c) => c.id));
  domain.flows.forEach((flow) => {
    flow.edges.forEach((edge) => {
      if (edge.conditionId && !conditionIds.has(edge.conditionId)) {
        errors.push({
          path: ['flows', flow.id, 'edges', edge.id],
          message: `Edge "${edge.id}" references non-existent condition: ${edge.conditionId}`,
          code: 'EDGE_INVALID_CONDITION',
        });
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
