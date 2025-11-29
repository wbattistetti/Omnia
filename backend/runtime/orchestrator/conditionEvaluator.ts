// Condition Evaluator: Evaluates conditions for task execution
// Backend Runtime - Copied from frontend and adapted

import type { Condition, ExecutionState, RetrievalState } from '../compiler/types';

// Backend: projectData should be passed via callback or context
// For now, we'll use a simple cache/registry approach
let projectDataRegistry: any = null;

export function setProjectData(data: any) {
  projectDataRegistry = data;
}

export function getProjectData(): any {
  return projectDataRegistry;
}

/**
 * Loads condition script from conditionId and converts it to a function
 */
async function loadConditionScript(conditionId: string): Promise<((ctx: Record<string, any>) => boolean) | null> {
  try {
    console.log('[ConditionEvaluator][loadConditionScript] 🔍 Loading script for condition', {
      conditionId
    });

    // ✅ Backend: Get projectData from registry (set via setProjectData)
    const projectData = getProjectData();

    if (!projectData) {
      console.warn('[ConditionEvaluator][loadConditionScript] ⚠️ No projectData available');
      return null;
    }

    // Find condition by ID (conditionId is the condition's _id or id)
    const conditions = projectData?.conditions || [];
    let condition: any = null;

    for (const cat of conditions) {
      for (const item of (cat.items || [])) {
        const itemId = item.id || item._id;
        if (itemId === conditionId) {
          condition = item;
          break;
        }
      }
      if (condition) break;
    }

    if (!condition) {
      console.warn('[ConditionEvaluator][loadConditionScript] ⚠️ Condition not found', {
        conditionId,
        availableConditions: conditions.flatMap((cat: any) => (cat.items || []).map((item: any) => item.id || item._id))
      });
      return null;
    }

    const script = (condition.data?.script || condition.script || '').trim();
    if (!script) {
      console.warn('[ConditionEvaluator][loadConditionScript] ⚠️ Condition has no script', {
        conditionId,
        conditionName: condition.name || condition.label
      });
      return null;
    }

    console.log('[ConditionEvaluator][loadConditionScript] ✅ Script loaded', {
      conditionId,
      conditionName: condition.name || condition.label,
      scriptLength: script.length,
      scriptPreview: script.substring(0, 200)
    });

    // Convert script to function
    // Script is saved with GUIDs, so it should work directly with variableStore
    const wrapper = `"use strict";\nreturn (function(ctx){\n  var vars = ctx;\n  ${script}\n  if (typeof main==='function') return !!main(ctx);\n  if (typeof evaluate==='function') return !!evaluate(ctx);\n  throw new Error('main(ctx) or evaluate(ctx) not found');\n});`;

    try {
      // eslint-disable-next-line no-new-func
      const makeRunner = new Function(wrapper)();
      const runner = makeRunner();

      console.log('[ConditionEvaluator][loadConditionScript] ✅ Script compiled to function', {
        conditionId
      });

      return runner;
    } catch (e) {
      console.error('[ConditionEvaluator][loadConditionScript] ❌ Script compilation error', {
        conditionId,
        error: e
      });
      return null;
    }
  } catch (e) {
    console.error('[ConditionEvaluator][loadConditionScript] ❌ Error loading condition script', {
      conditionId,
      error: e
    });
    return null;
  }
}

/**
 * Evaluates a condition against current execution state
 */
export function evaluateCondition(
  condition: Condition | null,
  state: ExecutionState
): boolean {
  // Null condition = always true (entry node)
  if (!condition) {
    return true;
  }

  switch (condition.type) {
    case 'Always':
      return true;

    case 'TaskState':
      return state.executedTaskIds.has(condition.taskId) && condition.state === 'Executed';

    case 'RetrievalState':
      return state.retrievalState === condition.state;

    case 'StepActivated':
      // Step is activated if any task from that step is executed
      // This is a simplified check - in practice, we'd track active steps
      return state.executedTaskIds.has(condition.stepId);

    case 'EdgeCondition':
      // Evaluate edge condition (e.g., variable checks)
      const result = evaluateEdgeCondition(condition.condition, state.variableStore);
      console.log('[ConditionEvaluator][EdgeCondition] Evaluating edge condition', {
        edgeId: condition.edgeId,
        conditionId: condition.condition,
        result,
        variableStoreKeys: Object.keys(state.variableStore),
        variableStore: state.variableStore
      });
      return result;

    case 'And':
      const andResults = condition.conditions.map((c) => evaluateCondition(c, state));
      const andFinal = andResults.every(r => r === true);
      return andFinal;

    case 'Or':
      const orResults = condition.conditions.map((c) => evaluateCondition(c, state));
      const orFinal = orResults.some(r => r === true);
      return orFinal;

    case 'Not':
      const innerResult = evaluateCondition(condition.condition, state);
      const notFinal = !innerResult;
      console.log('[ConditionEvaluator][Not] Evaluating NOT condition', {
        innerResult,
        notFinal,
        innerCondition: condition.condition,
        innerConditionType: condition.condition?.type,
        variableStoreKeys: Object.keys(state.variableStore)
      });
      return notFinal;

    default:
      console.warn(`[ConditionEvaluator] Unknown condition type: ${(condition as any).type}`);
      return false;
  }
}

/**
 * Evaluates edge condition (variable checks, etc.)
 */
function evaluateEdgeCondition(
  edgeCondition: any,
  variableStore: Record<string, any>
): boolean {
  if (!edgeCondition) {
    return true;
  }

  // Simple variable check: { variable: 'name', operator: '===', value: 'John' }
  if (edgeCondition.variable && edgeCondition.operator && edgeCondition.value !== undefined) {
    // Removed verbose logging
    const variableValue = variableStore[edgeCondition.variable];
    const result = (() => {
      switch (edgeCondition.operator) {
        case '===':
          return variableValue === edgeCondition.value;
        case '!==':
          return variableValue !== edgeCondition.value;
        case '>':
          return variableValue > edgeCondition.value;
        case '<':
          return variableValue < edgeCondition.value;
        case '>=':
          return variableValue >= edgeCondition.value;
        case '<=':
          return variableValue <= edgeCondition.value;
        default:
          return false;
      }
    })();
    // Removed verbose logging
    return result;
  }

  // Complex condition (function, etc.)
  if (typeof edgeCondition === 'function') {
    try {
      const result = edgeCondition(variableStore);
      return result;
    } catch (e) {
      console.error('[ConditionEvaluator][evaluateEdgeCondition] ❌ Function error', {
        error: e
      });
      return false;
    }
  }

  // Check if it's a conditionId (string GUID) - need to load script
  if (typeof edgeCondition === 'string') {
    // Removed verbose logging

    // Load script synchronously (using async would require changing function signature)
    // For now, try to load from cache or use a synchronous approach
    let conditionFunction: ((ctx: Record<string, any>) => boolean) | null = null;

    // ✅ Backend: Use simple cache (in-memory)
    const cacheKey = `condition_${edgeCondition}`;
    const conditionCache: Record<string, ((ctx: Record<string, any>) => boolean)> = {};
    const cached = conditionCache[cacheKey];
    if (cached) {
      conditionFunction = cached;
      console.log('[ConditionEvaluator][evaluateEdgeCondition] ✅ Using cached condition function', {
        conditionId: edgeCondition
      });
    } else {
      // Load from projectData registry
      try {
        const projectData = getProjectData();

        console.log('[ConditionEvaluator][evaluateEdgeCondition] 🔍 ProjectData status', {
          hasProjectData: !!projectData,
          hasConditions: !!(projectData?.conditions),
          conditionsCount: projectData?.conditions?.length || 0
        });

        if (projectData) {
          const conditions = projectData?.conditions || [];
          console.log('[ConditionEvaluator][evaluateEdgeCondition] 🔍 Searching for condition', {
            conditionId: edgeCondition,
            conditionsCategoriesCount: conditions.length,
            allConditionIds: conditions.flatMap((cat: any) => (cat.items || []).map((item: any) => ({
              id: item.id || item._id,
              name: item.name || item.label,
              hasScript: !!(item.data?.script || item.script)
            })))
          });
          for (const cat of conditions) {
            for (const item of (cat.items || [])) {
              const itemId = item.id || item._id;
              if (itemId === edgeCondition) {
                const script = (item.data?.script || item.script || '').trim();
                console.log('[ConditionEvaluator][evaluateEdgeCondition] ✅ Condition found!', {
                  conditionId: edgeCondition,
                  itemId,
                  hasScript: !!script,
                  scriptLength: script.length,
                  scriptPreview: script.substring(0, 100)
                });
                if (script) {
                  console.log('[ConditionEvaluator][evaluateEdgeCondition] ✅ Script found, compiling', {
                    conditionId: edgeCondition,
                    scriptLength: script.length,
                    scriptPreview: script.substring(0, 200)
                  });

                  // ✅ Use script directly with labels (no conversion needed)
                  // The variableStore now contains BOTH GUID and label keys, so scripts can use labels directly

                  const guidKeys = Object.keys(variableStore).filter(k => k.length === 36 && k.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i));
                  const labelKeys = Object.keys(variableStore).filter(k => !guidKeys.includes(k));

                  console.log('[ConditionEvaluator][evaluateEdgeCondition] 🔍 VariableStore status', {
                    conditionId: edgeCondition,
                    scriptPreview: script.substring(0, 300),
                    variableStoreKeys: Object.keys(variableStore),
                    variableStoreSize: Object.keys(variableStore).length,
                    guidKeysCount: guidKeys.length,
                    labelKeysCount: labelKeys.length,
                    guidKeys: guidKeys.slice(0, 5),
                    labelKeys: labelKeys.slice(0, 5),
                    variableStorePreview: Object.fromEntries(Object.entries(variableStore).slice(0, 10))
                  });

                  // ✅ Script already contains labels, variableStore has labels too
                  const scriptWithLabels = script; // No conversion needed!

                  const wrapper = `"use strict";\nreturn (function(ctx){\n  var vars = ctx;\n  ${scriptWithLabels}\n  if (typeof main==='function') return !!main(ctx);\n  if (typeof evaluate==='function') return !!evaluate(ctx);\n  throw new Error('main(ctx) or evaluate(ctx) not found');\n});`;
                  try {
                    // eslint-disable-next-line no-new-func
                    const makeRunner = new Function(wrapper)();
                    // makeRunner is already the function, don't call it again!
                    conditionFunction = makeRunner;
                    // Cache it
                    conditionCache[cacheKey] = conditionFunction;
                    // Removed verbose logging
                  } catch (e) {
                    console.error('[ConditionEvaluator][evaluateEdgeCondition] ❌ Script compilation error', {
                      conditionId: edgeCondition,
                      error: e
                    });
                    conditionFunction = null; // Ensure it's null on error
                  }
                } else {
                  console.warn('[ConditionEvaluator][evaluateEdgeCondition] ⚠️ Condition found but no script', {
                    conditionId: edgeCondition
                  });
                }
                break;
              }
            }
            if (conditionFunction) break;
          }
        } else {
          console.warn('[ConditionEvaluator][evaluateEdgeCondition] ⚠️ No projectData available', {
            conditionId: edgeCondition
          });
        }
      } catch (e) {
        console.error('[ConditionEvaluator][evaluateEdgeCondition] ❌ Error loading condition', {
          conditionId: edgeCondition,
          error: e
        });
      }
    }

    // Removed verbose logging

    if (conditionFunction) {
      try {
        const result = conditionFunction(variableStore);
        return result;
      } catch (e) {
        console.error('[ConditionEvaluator][evaluateEdgeCondition] ❌ Condition function error', {
          conditionId: edgeCondition,
          error: e
        });
        return false;
      }
    } else {
      console.warn('[ConditionEvaluator][evaluateEdgeCondition] ⚠️ Could not load condition script, returning true', {
        conditionId: edgeCondition
      });
      return true; // Default to true if condition cannot be loaded
    }
  }

  // Default: true if condition exists
  return true;
}

