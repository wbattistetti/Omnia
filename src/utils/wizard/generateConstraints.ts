// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * CONTRACT LAYER - generateConstraints.ts
 *
 * Generates enhanced constraints for semantic contracts.
 * Constraints are coherent with canonical values and preserve existing constraints.
 *
 * Architecture:
 * - Pure function for merge logic (deterministic)
 * - Side effect: API call to backend (isolated)
 * - Non-destructive: preserves all existing constraint fields
 * - Additive: only adds missing constraints
 *
 * @see ARCHITECTURE.md for complete architecture documentation
 */

import type { SemanticContract, SemanticSubgroup, StructuredConstraint } from '../../types/semanticContract';
import type { GenerationProgress } from './types';

/**
 * Constraints response from AI
 */
interface ConstraintsResponse {
  constraints: {
    minLength?: number | null;
    maxLength?: number | null;
    min?: number | null;
    max?: number | null;
    pattern?: string | null;
    format?: string | null;
    required?: boolean | null;
    examples?: {
      valid?: string[];
      invalid?: string[];
      edgeCases?: string[];
    } | null;
  };
  subentityConstraints?: Array<{
    subTaskKey: string;
    constraints: {
      minLength?: number | null;
      maxLength?: number | null;
      min?: number | null;
      max?: number | null;
      pattern?: string | null;
      format?: string | null;
      required?: boolean | null;
    };
  }>;
}

/**
 * Validate AI response structure
 * Returns validated constraints or null if invalid
 */
function validateConstraints(data: any): ConstraintsResponse | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const validated: ConstraintsResponse = {
    constraints: {},
    subentityConstraints: []
  };

  // Validate main constraints
  if (data.constraints !== undefined) {
    if (typeof data.constraints === 'object' && data.constraints !== null) {
      const constraints = data.constraints;

      if (constraints.minLength !== undefined) {
        if (typeof constraints.minLength === 'number' || constraints.minLength === null) {
          validated.constraints.minLength = constraints.minLength;
        }
      }

      if (constraints.maxLength !== undefined) {
        if (typeof constraints.maxLength === 'number' || constraints.maxLength === null) {
          validated.constraints.maxLength = constraints.maxLength;
        }
      }

      if (constraints.min !== undefined) {
        if (typeof constraints.min === 'number' || constraints.min === null) {
          validated.constraints.min = constraints.min;
        }
      }

      if (constraints.max !== undefined) {
        if (typeof constraints.max === 'number' || constraints.max === null) {
          validated.constraints.max = constraints.max;
        }
      }

      if (constraints.pattern !== undefined) {
        if (typeof constraints.pattern === 'string' || constraints.pattern === null) {
          validated.constraints.pattern = constraints.pattern;
        }
      }

      if (constraints.format !== undefined) {
        if (typeof constraints.format === 'string' || constraints.format === null) {
          validated.constraints.format = constraints.format;
        }
      }

      if (constraints.required !== undefined) {
        if (typeof constraints.required === 'boolean' || constraints.required === null) {
          validated.constraints.required = constraints.required;
        }
      }

      if (constraints.examples !== undefined) {
        if (constraints.examples === null || typeof constraints.examples === 'object') {
          validated.constraints.examples = constraints.examples;
        }
      }
    }
  }

  // Validate subentity constraints
  if (data.subentityConstraints !== undefined) {
    if (Array.isArray(data.subentityConstraints)) {
      validated.subentityConstraints = data.subentityConstraints.filter((item: any) => {
        return (
          item &&
          typeof item === 'object' &&
          typeof item.subTaskKey === 'string' &&
          typeof item.constraints === 'object' &&
          item.constraints !== null
        );
      });
    }
  }

  return validated;
}

/**
 * Merge constraints into contract (pure function)
 * Non-destructive: preserves all existing constraint fields
 * Additive: only adds missing constraints
 */
function mergeConstraintsIntoContract(
  contract: SemanticContract,
  constraintsResponse: ConstraintsResponse
): SemanticContract {
  // Create a deep copy to avoid mutating original
  const merged: SemanticContract = JSON.parse(JSON.stringify(contract));

  // Merge main entity constraints
  if (!merged.constraints) {
    merged.constraints = {};
  }

  const newConstraints = constraintsResponse.constraints;

  // Add only missing constraints (non-destructive)
  if (newConstraints.minLength !== undefined && newConstraints.minLength !== null && merged.constraints.minLength === undefined) {
    merged.constraints.minLength = newConstraints.minLength;
  }

  if (newConstraints.maxLength !== undefined && newConstraints.maxLength !== null && merged.constraints.maxLength === undefined) {
    merged.constraints.maxLength = newConstraints.maxLength;
  }

  if (newConstraints.min !== undefined && newConstraints.min !== null && merged.constraints.min === undefined) {
    merged.constraints.min = newConstraints.min;
  }

  if (newConstraints.max !== undefined && newConstraints.max !== null && merged.constraints.max === undefined) {
    merged.constraints.max = newConstraints.max;
  }

  if (newConstraints.pattern !== undefined && newConstraints.pattern !== null && merged.constraints.pattern === undefined) {
    merged.constraints.pattern = newConstraints.pattern;
  }

  if (newConstraints.format !== undefined && newConstraints.format !== null && !merged.constraints.format) {
    // Merge format array if it exists, or set single format
    if (Array.isArray(merged.constraints.format)) {
      if (!merged.constraints.format.includes(newConstraints.format)) {
        merged.constraints.format.push(newConstraints.format);
      }
    } else {
      merged.constraints.format = [newConstraints.format];
    }
  }

  if (newConstraints.required !== undefined && newConstraints.required !== null && merged.constraints.required === undefined) {
    merged.constraints.required = newConstraints.required;
  }

  // Merge examples (non-destructive)
  if (newConstraints.examples) {
    if (!merged.constraints.examples) {
      merged.constraints.examples = {};
    }

    if (newConstraints.examples.valid && Array.isArray(newConstraints.examples.valid)) {
      if (!merged.constraints.examples.valid) {
        merged.constraints.examples.valid = [];
      }
      merged.constraints.examples.valid = [
        ...merged.constraints.examples.valid,
        ...newConstraints.examples.valid.filter((ex: string) => !merged.constraints.examples!.valid!.includes(ex))
      ];
    }

    if (newConstraints.examples.invalid && Array.isArray(newConstraints.examples.invalid)) {
      if (!merged.constraints.examples.invalid) {
        merged.constraints.examples.invalid = [];
      }
      merged.constraints.examples.invalid = [
        ...merged.constraints.examples.invalid,
        ...newConstraints.examples.invalid.filter((ex: string) => !merged.constraints.examples!.invalid!.includes(ex))
      ];
    }

    if (newConstraints.examples.edgeCases && Array.isArray(newConstraints.examples.edgeCases)) {
      if (!merged.constraints.examples.edgeCases) {
        merged.constraints.examples.edgeCases = [];
      }
      merged.constraints.examples.edgeCases = [
        ...merged.constraints.examples.edgeCases,
        ...newConstraints.examples.edgeCases.filter((ex: string) => !merged.constraints.examples!.edgeCases!.includes(ex))
      ];
    }
  }

  // Merge subentity constraints
  const subentities = merged.subentities || merged.subgroups;
  if (constraintsResponse.subentityConstraints && subentities) {
    for (const subConstraint of constraintsResponse.subentityConstraints) {
      const subentity = subentities.find((s: SemanticSubgroup) => s.subTaskKey === subConstraint.subTaskKey);
      if (subentity) {
        if (!subentity.constraints) {
          subentity.constraints = {};
        }

        const newSubConstraints = subConstraint.constraints;

        // Add only missing constraints (non-destructive)
        if (newSubConstraints.minLength !== undefined && newSubConstraints.minLength !== null && subentity.constraints.minLength === undefined) {
          subentity.constraints.minLength = newSubConstraints.minLength;
        }

        if (newSubConstraints.maxLength !== undefined && newSubConstraints.maxLength !== null && subentity.constraints.maxLength === undefined) {
          subentity.constraints.maxLength = newSubConstraints.maxLength;
        }

        if (newSubConstraints.min !== undefined && newSubConstraints.min !== null && subentity.constraints.min === undefined) {
          subentity.constraints.min = newSubConstraints.min;
        }

        if (newSubConstraints.max !== undefined && newSubConstraints.max !== null && subentity.constraints.max === undefined) {
          subentity.constraints.max = newSubConstraints.max;
        }

        if (newSubConstraints.pattern !== undefined && newSubConstraints.pattern !== null && subentity.constraints.pattern === undefined) {
          subentity.constraints.pattern = newSubConstraints.pattern;
        }

        if (newSubConstraints.format !== undefined && newSubConstraints.format !== null && !subentity.constraints.format) {
          if (Array.isArray(subentity.constraints.format)) {
            if (!subentity.constraints.format.includes(newSubConstraints.format)) {
              subentity.constraints.format.push(newSubConstraints.format);
            }
          } else {
            subentity.constraints.format = [newSubConstraints.format];
          }
        }

        if (newSubConstraints.required !== undefined && newSubConstraints.required !== null && subentity.constraints.required === undefined) {
          subentity.constraints.required = newSubConstraints.required;
        }
      }
    }
  }

  // Update metadata
  merged.updatedAt = new Date();
  if (merged.version) {
    merged.version = merged.version + 1;
  } else {
    merged.version = 2;
  }

  return merged;
}

/**
 * Generate constraints for a contract using AI
 *
 * This function:
 * 1. Calls backend API to get AI-generated constraints
 * 2. Validates AI response
 * 3. Merges into contract (non-destructively)
 * 4. Returns contract with constraints or original if generation fails
 *
 * @param contract - Semantic contract to generate constraints for
 * @param nodeLabel - Optional node label for context
 * @param onProgress - Optional progress callback
 * @returns Contract with constraints or original if generation fails
 */
export async function generateConstraintsForNode(
  contract: SemanticContract,
  nodeLabel?: string,
  onProgress?: (progress: GenerationProgress) => void
): Promise<SemanticContract> {
  if (onProgress) {
    onProgress({
      currentStep: 0,
      totalSteps: 1,
      currentNodeId: '',
      currentNodeLabel: nodeLabel || contract.entity.label,
      currentAction: 'Generating constraints with AI...',
      percentage: 0
    });
  }

  try {
    // Call backend API
    const response = await fetch('/api/nlp/generate-constraints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contract,
        nodeLabel,
        provider: localStorage.getItem('omnia.aiProvider') || 'openai',
        model: localStorage.getItem('omnia.aiModel') || undefined
      })
    });

    if (!response.ok) {
      console.warn('[generateConstraints] API call failed:', response.statusText);
      return contract; // Fallback to original
    }

    const data = await response.json();

    if (!data.success || !data.constraints) {
      console.warn('[generateConstraints] AI generation failed or returned no constraints');
      return contract; // Fallback to original
    }

    // Validate constraints structure
    const validated = validateConstraints(data.constraints);

    if (!validated) {
      console.warn('[generateConstraints] Invalid constraints structure, returning original contract');
      return contract; // Fallback to original
    }

    // Merge into contract (pure function)
    const merged = mergeConstraintsIntoContract(contract, validated);

    if (onProgress) {
      onProgress({
        currentStep: 1,
        totalSteps: 1,
        currentNodeId: '',
        currentNodeLabel: nodeLabel || contract.entity.label,
        currentAction: 'Constraints generated successfully',
        percentage: 100
      });
    }

    return merged;

  } catch (error) {
    console.warn('[generateConstraints] Error during generation:', error);
    return contract; // Fallback to original
  }
}
