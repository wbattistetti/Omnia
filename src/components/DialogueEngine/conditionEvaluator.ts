// Condition Evaluator: Evaluates conditions for task execution

import type { Condition, ExecutionState, RetrievalState } from '../FlowCompiler/types';

/**
 * Loads condition script from conditionId and converts it to a function
 */
async function loadConditionScript(conditionId: string): Promise<((ctx: Record<string, any>) => boolean) | null> {
  try {
    console.log('[ConditionEvaluator][loadConditionScript] 🔍 Loading script for condition', {
      conditionId
    });

    // Try to get projectData from window or context
    let projectData: any = null;
    try {
      const { useProjectData } = await import('../../context/ProjectDataContext');
      projectData = useProjectData().data;
    } catch {
      // Fallback: try window
      projectData = (window as any).__projectData;
    }

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
      console.log('[ConditionEvaluator][EdgeCondition] 🔍 Evaluating edge condition', {
        edgeId: condition.edgeId,
        conditionType: typeof condition.condition,
        conditionValue: condition.condition,
        variableStoreKeys: Object.keys(state.variableStore),
        variableStore: state.variableStore
      });
      const result = evaluateEdgeCondition(condition.condition, state.variableStore);
      console.log('[ConditionEvaluator][EdgeCondition] ✅ Evaluation result', {
        edgeId: condition.edgeId,
        result
      });
      return result;

    case 'And':
      console.log('[ConditionEvaluator][And] 🔍 Evaluating AND condition', {
        conditionsCount: condition.conditions.length,
        conditions: condition.conditions.map((c, i) => ({
          index: i,
          type: c.type,
          taskId: (c as any).taskId,
          edgeId: (c as any).edgeId,
          conditionId: (c as any).condition
        }))
      });
      const andResults = condition.conditions.map((c, i) => {
        const result = evaluateCondition(c, state);
        console.log('[ConditionEvaluator][And] 🔍 Condition result', {
          index: i,
          type: c.type,
          result,
          taskId: (c as any).taskId,
          edgeId: (c as any).edgeId,
          executedTaskIds: Array.from(state.executedTaskIds),
          variableStoreKeys: Object.keys(state.variableStore)
        });
        return result;
      });
      const andFinal = andResults.every(r => r === true);
      console.log('[ConditionEvaluator][And] ✅ AND condition result', {
        conditionsCount: condition.conditions.length,
        individualResults: andResults,
        finalResult: andFinal
      });
      return andFinal;

    case 'Or':
      console.log('[ConditionEvaluator][Or] 🔍 Evaluating OR condition', {
        conditionsCount: condition.conditions.length
      });
      const orResults = condition.conditions.map((c, i) => {
        const result = evaluateCondition(c, state);
        console.log('[ConditionEvaluator][Or] 🔍 Condition result', {
          index: i,
          type: c.type,
          result
        });
        return result;
      });
      const orFinal = orResults.some(r => r === true);
      console.log('[ConditionEvaluator][Or] ✅ OR condition result', {
        conditionsCount: condition.conditions.length,
        individualResults: orResults,
        finalResult: orFinal
      });
      return orFinal;

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
  console.log('[ConditionEvaluator][evaluateEdgeCondition] 🚀 START', {
    edgeConditionType: typeof edgeCondition,
    edgeConditionValue: edgeCondition,
    variableStoreKeys: Object.keys(variableStore),
    variableStoreSize: Object.keys(variableStore).length,
    variableStorePreview: Object.fromEntries(Object.entries(variableStore).slice(0, 5))
  });

  if (!edgeCondition) {
    console.log('[ConditionEvaluator][evaluateEdgeCondition] ⚠️ No edgeCondition, returning true');
    return true;
  }

  // Simple variable check: { variable: 'name', operator: '===', value: 'John' }
  if (edgeCondition.variable && edgeCondition.operator && edgeCondition.value !== undefined) {
    console.log('[ConditionEvaluator][evaluateEdgeCondition] 🔍 Simple variable check', {
      variable: edgeCondition.variable,
      operator: edgeCondition.operator,
      expectedValue: edgeCondition.value,
      actualValue: variableStore[edgeCondition.variable]
    });
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
    console.log('[ConditionEvaluator][evaluateEdgeCondition] ✅ Simple check result', {
      variable: edgeCondition.variable,
      result
    });
    return result;
  }

  // Complex condition (function, etc.)
  if (typeof edgeCondition === 'function') {
    console.log('[ConditionEvaluator][evaluateEdgeCondition] 🔍 Function condition', {
      functionName: edgeCondition.name || 'anonymous'
    });
    try {
      const result = edgeCondition(variableStore);
      console.log('[ConditionEvaluator][evaluateEdgeCondition] ✅ Function result', {
        result
      });
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
    console.log('[ConditionEvaluator][evaluateEdgeCondition] 🔍 ConditionId detected (string)', {
      conditionId: edgeCondition,
      conditionIdLength: edgeCondition.length
    });

    // Load script synchronously (using async would require changing function signature)
    // For now, try to load from cache or use a synchronous approach
    let conditionFunction: ((ctx: Record<string, any>) => boolean) | null = null;

    // Try to get from cache (if we implement caching later)
    const cacheKey = `condition_${edgeCondition}`;
    const cached = (window as any).__conditionCache?.[cacheKey];
    if (cached) {
      conditionFunction = cached;
      console.log('[ConditionEvaluator][evaluateEdgeCondition] ✅ Using cached condition function', {
        conditionId: edgeCondition
      });
    } else {
      // Load synchronously (this is a limitation - ideally should be async)
      // For now, try to load from projectData directly
      try {
        let projectData: any = null;
        try {
          const { useProjectData } = require('../../context/ProjectDataContext');
          projectData = useProjectData().data;
        } catch (e) {
          console.log('[ConditionEvaluator][evaluateEdgeCondition] ⚠️ useProjectData() failed, trying window.__projectData', {
            error: e
          });
          projectData = (window as any).__projectData;
        }

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
                    if (!(window as any).__conditionCache) {
                      (window as any).__conditionCache = {};
                    }
                    (window as any).__conditionCache[cacheKey] = conditionFunction;
                    console.log('[ConditionEvaluator][evaluateEdgeCondition] ✅ Script compiled and cached', {
                      conditionId: edgeCondition,
                      hasConditionFunction: !!conditionFunction,
                      conditionFunctionType: typeof conditionFunction
                    });
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

    console.log('[ConditionEvaluator][evaluateEdgeCondition] 🔍 Final conditionFunction status', {
      conditionId: edgeCondition,
      hasConditionFunction: !!conditionFunction,
      conditionFunctionType: typeof conditionFunction
    });

    if (conditionFunction) {
      try {
        console.log('[ConditionEvaluator][evaluateEdgeCondition] 🚀 Executing condition function', {
          conditionId: edgeCondition,
          variableStoreKeys: Object.keys(variableStore),
          variableStoreSize: Object.keys(variableStore).length,
          variableStorePreview: Object.fromEntries(Object.entries(variableStore).slice(0, 10)),
          variableStoreFull: variableStore // ✅ Log completo per debug
        });
        const result = conditionFunction(variableStore);
        console.log('[ConditionEvaluator][evaluateEdgeCondition] ✅ Condition function result', {
          conditionId: edgeCondition,
          result,
          variableStoreKeys: Object.keys(variableStore),
          variableStorePreview: Object.fromEntries(Object.entries(variableStore).slice(0, 10))
        });
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
  console.log('[ConditionEvaluator][evaluateEdgeCondition] ⚠️ Unknown condition type, returning true', {
    edgeConditionType: typeof edgeCondition,
    edgeConditionValue: edgeCondition
  });
  return true;
}

