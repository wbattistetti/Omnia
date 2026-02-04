// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * CONTRACT LAYER - generateEscalation.ts
 *
 * Generates engine escalation strategy for semantic contracts.
 * Escalation defines the order in which engines are tried until one succeeds or all fail.
 *
 * Architecture:
 * - Pure function for merge logic (deterministic)
 * - Side effect: API call to backend (isolated)
 * - Non-destructive: preserves existing escalation if present
 * - Additive: only adds or enhances escalation configuration
 *
 * @see ARCHITECTURE.md for complete architecture documentation
 */

import type { SemanticContract, EngineConfig, EngineEscalation, EngineType } from '../../types/semanticContract';
import type { GenerationProgress } from './types';

/**
 * Escalation response from AI
 */
interface EscalationResponse {
  engines?: Array<{
    type?: EngineType;
    priority?: number;
    enabled?: boolean;
  }>;
  defaultEngine?: EngineType;
  explanation?: string;
}

/**
 * Validate AI response structure
 * Returns validated escalation or null if invalid
 */
function validateEscalation(data: any, availableEngineTypes: EngineType[]): EscalationResponse | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const validated: EscalationResponse = {
    engines: [],
    defaultEngine: undefined,
    explanation: undefined
  };

  // Validate engines array
  if (data.engines !== undefined) {
    if (Array.isArray(data.engines)) {
      validated.engines = data.engines.filter((entry: any) => {
        return (
          entry &&
          typeof entry === 'object' &&
          typeof entry.type === 'string' &&
          availableEngineTypes.includes(entry.type as EngineType) &&
          typeof entry.priority === 'number' &&
          typeof entry.enabled === 'boolean'
        );
      });
    }
  }

  // Validate default engine
  if (data.defaultEngine !== undefined) {
    if (typeof data.defaultEngine === 'string' && availableEngineTypes.includes(data.defaultEngine as EngineType)) {
      validated.defaultEngine = data.defaultEngine as EngineType;
    }
  }

  // Validate explanation
  if (data.explanation !== undefined) {
    if (typeof data.explanation === 'string') {
      validated.explanation = data.explanation;
    }
  }

  // At least one engine must be present
  if (!validated.engines || validated.engines.length === 0) {
    return null; // Invalid: must have at least one engine
  }

  // At least one engine must be enabled
  if (!validated.engines.some(e => e.enabled)) {
    // Enable first engine if none are enabled
    if (validated.engines.length > 0) {
      validated.engines[0].enabled = true;
    }
  }

  // Ensure default engine is set
  if (!validated.defaultEngine) {
    // Set default to first enabled engine
    const firstEnabled = validated.engines.find(e => e.enabled);
    if (firstEnabled) {
      validated.defaultEngine = firstEnabled.type;
    } else if (validated.engines.length > 0) {
      validated.defaultEngine = validated.engines[0].type;
    }
  }

  return validated;
}

/**
 * Convert escalation response to EngineEscalation
 * Creates EngineEscalation object with proper structure
 */
function convertToEngineEscalation(
  escalation: EscalationResponse,
  nodeId: string
): EngineEscalation {
  // Sort engines by priority
  const sortedEngines = [...(escalation.engines || [])].sort((a, b) => {
    const priorityA = a.priority || 0;
    const priorityB = b.priority || 0;
    return priorityA - priorityB;
  });

  return {
    nodeId,
    engines: sortedEngines.map(e => ({
      type: e.type!,
      priority: e.priority || 0,
      enabled: e.enabled !== undefined ? e.enabled : true
    })),
    defaultEngine: escalation.defaultEngine
  };
}

/**
 * Merge escalation (pure function)
 * Non-destructive: preserves existing escalation if present
 * Additive: only adds or enhances escalation configuration
 *
 * Note: This function does NOT modify the contract directly.
 * Escalation is stored separately in the task template.
 * This function returns the escalation separately.
 */
function mergeEscalation(
  existingEscalation: EngineEscalation | null,
  newEscalation: EscalationResponse,
  nodeId: string
): EngineEscalation {
  // If no existing escalation, use new one
  if (!existingEscalation) {
    return convertToEngineEscalation(newEscalation, nodeId);
  }

  // Merge: preserve existing escalation structure, but update with new priorities/enabled states
  // This is additive: we keep existing engines but update their configuration
  const merged: EngineEscalation = {
    nodeId,
    engines: [],
    defaultEngine: newEscalation.defaultEngine || existingEscalation.defaultEngine
  };

  // Create map of new engine configurations
  const newEngineMap = new Map<EngineType, { priority: number; enabled: boolean }>();
  for (const engine of newEscalation.engines || []) {
    if (engine.type) {
      newEngineMap.set(engine.type, {
        priority: engine.priority || 0,
        enabled: engine.enabled !== undefined ? engine.enabled : true
      });
    }
  }

  // Merge existing engines with new configurations
  for (const existingEngine of existingEscalation.engines) {
    const newConfig = newEngineMap.get(existingEngine.type);
    if (newConfig) {
      // Update with new configuration
      merged.engines.push({
        type: existingEngine.type,
        priority: newConfig.priority,
        enabled: newConfig.enabled
      });
      newEngineMap.delete(existingEngine.type);
    } else {
      // Keep existing engine if not in new configuration
      merged.engines.push(existingEngine);
    }
  }

  // Add new engines not in existing escalation
  for (const [engineType, config] of newEngineMap.entries()) {
    merged.engines.push({
      type: engineType,
      priority: config.priority,
      enabled: config.enabled
    });
  }

  // Sort by priority
  merged.engines.sort((a, b) => a.priority - b.priority);

  // Ensure at least one engine is enabled
  if (!merged.engines.some(e => e.enabled)) {
    if (merged.engines.length > 0) {
      merged.engines[0].enabled = true;
    }
  }

  // Ensure default engine is set
  if (!merged.defaultEngine) {
    const firstEnabled = merged.engines.find(e => e.enabled);
    if (firstEnabled) {
      merged.defaultEngine = firstEnabled.type;
    } else if (merged.engines.length > 0) {
      merged.defaultEngine = merged.engines[0].type;
    }
  }

  return merged;
}

/**
 * Generate escalation for a contract using AI
 *
 * This function:
 * 1. Calls backend API to get AI-generated escalation
 * 2. Validates AI response
 * 3. Converts to EngineEscalation format
 * 4. Merges with existing escalation (non-destructively)
 * 5. Returns escalation or null if generation fails
 *
 * @param contract - Semantic contract (for context)
 * @param engines - Array of available engines (from STEP 4)
 * @param nodeId - Node ID for escalation
 * @param nodeLabel - Optional node label for context
 * @param existingEscalation - Optional existing escalation to merge with
 * @param onProgress - Optional progress callback
 * @returns EngineEscalation or null if generation fails
 */
export async function generateEscalationForNode(
  contract: SemanticContract,
  engines: EngineConfig[],
  nodeId: string,
  nodeLabel?: string,
  existingEscalation?: EngineEscalation | null,
  onProgress?: (progress: GenerationProgress) => void
): Promise<EngineEscalation | null> {
  if (onProgress) {
    onProgress({
      currentStep: 0,
      totalSteps: 1,
      currentNodeId: nodeId,
      currentNodeLabel: nodeLabel || contract.entity.label,
      currentAction: 'Generating escalation with AI...',
      percentage: 0
    });
  }

  try {
    // Extract available engine types
    const availableEngineTypes = engines.map(e => e.type);

    if (availableEngineTypes.length === 0) {
      console.warn('[generateEscalation] No engines available, cannot generate escalation');
      return null;
    }

    // Convert engines to format expected by backend
    const enginesForBackend = engines.map(e => ({
      type: e.type,
      config: e.config
    }));

    // Call backend API
    const response = await fetch('/api/nlp/generate-escalation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contract,
        engines: enginesForBackend,
        nodeLabel,
        provider: localStorage.getItem('omnia.aiProvider') || 'openai',
        model: localStorage.getItem('omnia.aiModel') || undefined
      })
    });

    if (!response.ok) {
      console.warn('[generateEscalation] API call failed:', response.statusText);
      return existingEscalation || null; // Fallback to existing escalation
    }

    const data = await response.json();

    if (!data.success || !data.escalation) {
      console.warn('[generateEscalation] AI generation failed or returned no escalation');
      return existingEscalation || null; // Fallback to existing escalation
    }

    // Validate escalation structure
    const validated = validateEscalation(data.escalation, availableEngineTypes);

    if (!validated) {
      console.warn('[generateEscalation] Invalid escalation structure, returning existing escalation');
      return existingEscalation || null; // Fallback to existing escalation
    }

    // Merge with existing escalation (pure function)
    const merged = mergeEscalation(existingEscalation || null, validated, nodeId);

    if (onProgress) {
      onProgress({
        currentStep: 1,
        totalSteps: 1,
        currentNodeId: nodeId,
        currentNodeLabel: nodeLabel || contract.entity.label,
        currentAction: `Generated escalation with ${merged.engines.length} engines`,
        percentage: 100
      });
    }

    return merged;

  } catch (error) {
    console.warn('[generateEscalation] Error during generation:', error);
    return existingEscalation || null; // Fallback to existing escalation
  }
}
