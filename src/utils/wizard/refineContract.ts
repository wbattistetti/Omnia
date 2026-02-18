// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * CONTRACT LAYER - refineContract.ts
 *
 * Refines semantic contracts by enhancing descriptions, adding missing constraints,
 * and correcting ambiguities. This is an additive operation that preserves the
 * original contract structure.
 *
 * Architecture:
 * - Pure function for merge logic (deterministic)
 * - Side effect: API call to backend (isolated)
 * - Non-destructive: preserves all existing contract fields
 * - Additive: only adds or enhances fields
 *
 * @see ARCHITECTURE.md for complete architecture documentation
 */

import type { SemanticContract, SemanticSubgroup, StructuredConstraint } from '../../types/semanticContract';
import type { GenerationProgress } from './types';

/**
 * Contract refinement response from AI
 * All fields are optional - AI only returns enhancements
 */
interface ContractRefinement {
  enhancedDescription?: string | null;
  enhancedSubentities?: Array<{
    subTaskKey: string;
    enhancedMeaning?: string | null;
    enhancedConstraints?: {
      description?: string | null;
      examples?: {
        valid?: string[];
        invalid?: string[];
        edgeCases?: string[];
      };
    } | null;
    enhancedNormalization?: string | null;
  }>;
  enhancedConstraints?: {
    description?: string | null;
    examples?: {
      valid?: string[];
      invalid?: string[];
      edgeCases?: string[];
    };
  } | null;
  enhancedNormalization?: string | null;
  additionalConstraints?: Array<{
    field: string;
    type: string;
    value: any;
    description: string;
  }>;
  ambiguities?: Array<{
    field: string;
    issue: string;
    suggestion: string;
  }>;
  improvements?: string[];
}

/**
 * Validate AI response structure
 * Returns validated refinement or null if invalid
 */
function validateRefinement(data: any): ContractRefinement | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  // Basic structure validation
  const refinement: ContractRefinement = {};

  if (data.enhancedDescription !== undefined) {
    if (typeof data.enhancedDescription === 'string' || data.enhancedDescription === null) {
      refinement.enhancedDescription = data.enhancedDescription;
    }
  }

  if (data.enhancedSubentities !== undefined) {
    if (Array.isArray(data.enhancedSubentities)) {
      refinement.enhancedSubentities = data.enhancedSubentities.filter((item: any) => {
        return item && typeof item === 'object' && typeof item.subTaskKey === 'string';
      });
    }
  }

  if (data.enhancedConstraints !== undefined) {
    if (data.enhancedConstraints === null || typeof data.enhancedConstraints === 'object') {
      refinement.enhancedConstraints = data.enhancedConstraints;
    }
  }

  if (data.enhancedNormalization !== undefined) {
    if (typeof data.enhancedNormalization === 'string' || data.enhancedNormalization === null) {
      refinement.enhancedNormalization = data.enhancedNormalization;
    }
  }

  if (data.additionalConstraints !== undefined) {
    if (Array.isArray(data.additionalConstraints)) {
      refinement.additionalConstraints = data.additionalConstraints;
    }
  }

  if (data.ambiguities !== undefined) {
    if (Array.isArray(data.ambiguities)) {
      refinement.ambiguities = data.ambiguities;
    }
  }

  if (data.improvements !== undefined) {
    if (Array.isArray(data.improvements)) {
      refinement.improvements = data.improvements;
    }
  }

  return refinement;
}

/**
 * Merge refinement into contract (pure function)
 * Non-destructive: preserves all existing fields
 * Additive: only adds or enhances fields
 */
function mergeRefinementIntoContract(
  contract: SemanticContract,
  refinement: ContractRefinement
): SemanticContract {
  // Create a deep copy to avoid mutating original
  const refined: SemanticContract = JSON.parse(JSON.stringify(contract));

  // Enhance entity description
  if (refinement.enhancedDescription) {
    if (refined.entity) {
      refined.entity.description = refinement.enhancedDescription;
    }
    // Also update legacy mainGroup if present
    if (refined.mainGroup) {
      refined.mainGroup.description = refinement.enhancedDescription;
    }
  }

  // Enhance subentities (handle both new and legacy structure)
  const subentities = refined.subentities || refined.subgroups;
  if (refinement.enhancedSubentities && subentities) {
    for (const enhanced of refinement.enhancedSubentities) {
      const subentity = subentities.find((s: SemanticSubgroup) => s.subTaskKey === enhanced.subTaskKey);
      if (subentity) {
        if (enhanced.enhancedMeaning) {
          subentity.meaning = enhanced.enhancedMeaning;
        }
        if (enhanced.enhancedNormalization) {
          subentity.normalization = enhanced.enhancedNormalization;
        }
        if (enhanced.enhancedConstraints) {
          if (!subentity.constraints) {
            subentity.constraints = {};
          }
          if (enhanced.enhancedConstraints.description) {
            subentity.constraints.description = enhanced.enhancedConstraints.description;
          }
          if (enhanced.enhancedConstraints.examples) {
            if (!subentity.constraints.examples) {
              subentity.constraints.examples = {};
            }
            if (enhanced.enhancedConstraints.examples.valid) {
              subentity.constraints.examples.valid = enhanced.enhancedConstraints.examples.valid;
            }
            if (enhanced.enhancedConstraints.examples.invalid) {
              subentity.constraints.examples.invalid = enhanced.enhancedConstraints.examples.invalid;
            }
            if (enhanced.enhancedConstraints.examples.edgeCases) {
              subentity.constraints.examples.edgeCases = enhanced.enhancedConstraints.examples.edgeCases;
            }
          }
        }
      }
    }
  }

  // Enhance main entity constraints
  if (refinement.enhancedConstraints) {
    if (!refined.constraints) {
      refined.constraints = {};
    }
    if (refinement.enhancedConstraints.description) {
      refined.constraints.description = refinement.enhancedConstraints.description;
    }
    if (refinement.enhancedConstraints.examples) {
      if (!refined.constraints.examples) {
        refined.constraints.examples = {};
      }
      if (refinement.enhancedConstraints.examples.valid) {
        refined.constraints.examples.valid = refinement.enhancedConstraints.examples.valid;
      }
      if (refinement.enhancedConstraints.examples.invalid) {
        refined.constraints.examples.invalid = refinement.enhancedConstraints.examples.invalid;
      }
      if (refinement.enhancedConstraints.examples.edgeCases) {
        refined.constraints.examples.edgeCases = refinement.enhancedConstraints.examples.edgeCases;
      }
    }
  }

  // Enhance main entity normalization
  if (refinement.enhancedNormalization) {
    refined.normalization = refinement.enhancedNormalization;
  }

  // Handle legacy structure: ensure entity exists if mainGroup exists
  if (refined.mainGroup && !refined.entity) {
    refined.entity = {
      label: refined.mainGroup.name,
      type: refined.mainGroup.kind || 'generic',
      description: refined.mainGroup.description
    };
  }

  // Add additional constraints
  if (refinement.additionalConstraints) {
    for (const additional of refinement.additionalConstraints) {
      if (additional.field === 'entity') {
        if (!refined.constraints) {
          refined.constraints = {};
        }
        // Apply constraint based on type
        switch (additional.type) {
          case 'min':
            refined.constraints.min = additional.value;
            break;
          case 'max':
            refined.constraints.max = additional.value;
            break;
          case 'minLength':
            refined.constraints.minLength = additional.value;
            break;
          case 'maxLength':
            refined.constraints.maxLength = additional.value;
            break;
          case 'format':
            if (!refined.constraints.format) {
              refined.constraints.format = [];
            }
            refined.constraints.format.push(additional.value);
            break;
          case 'pattern':
            refined.constraints.pattern = additional.value;
            break;
          case 'required':
            refined.constraints.required = additional.value;
            break;
        }
      } else if (subentities) {
        const subentity = subentities.find((s: SemanticSubgroup) => s.subTaskKey === additional.field);
        if (subentity) {
          if (!subentity.constraints) {
            subentity.constraints = {};
          }
          switch (additional.type) {
            case 'min':
              subentity.constraints.min = additional.value;
              break;
            case 'max':
              subentity.constraints.max = additional.value;
              break;
            case 'minLength':
              subentity.constraints.minLength = additional.value;
              break;
            case 'maxLength':
              subentity.constraints.maxLength = additional.value;
              break;
            case 'format':
              if (!subentity.constraints.format) {
                subentity.constraints.format = [];
              }
              subentity.constraints.format.push(additional.value);
              break;
            case 'pattern':
              subentity.constraints.pattern = additional.value;
              break;
            case 'required':
              subentity.constraints.required = additional.value;
              break;
          }
        }
      }
    }
  }

  // Update metadata
  refined.updatedAt = new Date();
  if (refined.version) {
    refined.version = refined.version + 1;
  } else {
    refined.version = 2;
  }

  return refined;
}

/**
 * ⚠️ FORBIDDEN: This function violates architectural rules.
 * SemanticContract must be deterministic and NEVER modified by AI.
 *
 * The SemanticContract defines WHAT data to extract and HOW to return it in the data format.
 * Parsers define HOW to extract that data (regex, LLM, NER, etc.).
 *
 * This function is FORBIDDEN and will always throw an error.
 *
 * @throws {Error} Always throws - this function is forbidden
 */
export async function refineContract(
  contract: SemanticContract,
  nodeLabel?: string,
  onProgress?: (progress: GenerationProgress) => void
): Promise<SemanticContract> {
  const errorMessage = `refineContract is FORBIDDEN. SemanticContract must be deterministic and never modified by AI. ` +
    `The contract defines WHAT data to extract and HOW to return it. ` +
    `Use refineParser instead to refine parsers (HOW to extract), not the contract (WHAT to extract).`;
  console.error('[refineContract] ❌ FORBIDDEN:', errorMessage);
  throw new Error(errorMessage);
}
