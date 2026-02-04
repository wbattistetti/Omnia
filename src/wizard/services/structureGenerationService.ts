// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Structure Generation Service
 *
 * Handles AI-based structure data generation.
 * No UI dependencies, pure business logic.
 */

import type { SchemaNode } from '../types/wizard.types';

export interface StructureGenerationResult {
  success: boolean;
  structure?: SchemaNode[];
  error?: string;
}

/**
 * Generate structure data using AI
 */
export async function generateStructure(
  taskLabel: string,
  taskDescription?: string,
  provider: 'openai' | 'groq' = 'openai'
): Promise<StructureGenerationResult> {
  try {
    // Call backend API for structure generation
    const response = await fetch('/api/nlp/generate-structure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskLabel,
        taskDescription,
        provider,
        model: localStorage.getItem('omnia.aiModel') || undefined
      })
    });

    if (!response.ok) {
      throw new Error(`Structure generation failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success || !data.structure) {
      throw new Error(data.error || 'Invalid structure generation response');
    }

    // Parse and validate structure
    const structure = parseStructure(data.structure);

    return {
      success: true,
      structure
    };
  } catch (error) {
    console.error('[structureGenerationService] Error generating structure:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Regenerate structure based on user feedback
 */
export async function regenerateStructure(
  taskLabel: string,
  feedback: string,
  previousStructure: SchemaNode[],
  provider: 'openai' | 'groq' = 'openai'
): Promise<StructureGenerationResult> {
  try {
    const response = await fetch('/api/nlp/regenerate-structure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskLabel,
        feedback,
        previousStructure,
        provider,
        model: localStorage.getItem('omnia.aiModel') || undefined
      })
    });

    if (!response.ok) {
      throw new Error(`Structure regeneration failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success || !data.structure) {
      throw new Error(data.error || 'Invalid structure regeneration response');
    }

    const structure = parseStructure(data.structure);

    return {
      success: true,
      structure
    };
  } catch (error) {
    console.error('[structureGenerationService] Error regenerating structure:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Parse and validate structure from AI response
 */
function parseStructure(data: any): SchemaNode[] {
  if (!Array.isArray(data)) {
    throw new Error('Structure must be an array');
  }

  return data.map((item, index) => ({
    id: item.id || `node-${index}-${Date.now()}`,
    label: item.label || item.name || 'Unnamed',
    type: item.type,
    icon: item.icon,
    subData: item.subData ? parseStructure(item.subData) : undefined,
    subTasks: item.subTasks ? parseStructure(item.subTasks) : undefined,
    constraints: item.constraints || []
  }));
}

/**
 * Validate structure
 */
export function validateStructure(structure: SchemaNode[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  function validateNode(node: SchemaNode, path: string[]): void {
    if (!node.label || node.label.trim().length === 0) {
      errors.push(`Node at path ${path.join('/')} has empty label`);
    }

    const subData = node.subData || [];
    const subTasks = node.subTasks || [];
    const allSubNodes = subTasks.length > 0 ? subTasks : subData;

    for (const subNode of allSubNodes) {
      validateNode(subNode, [...path, node.label]);
    }
  }

  for (const node of structure) {
    validateNode(node, []);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
