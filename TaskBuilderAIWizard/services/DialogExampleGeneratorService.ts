// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { WizardTaskTreeNode } from '../types';
import type { WizardConstraint } from '../types';
import type { WizardNLPContract } from '../types';
import type { WizardStepMessages } from '../types';

/**
 * Dialog turn (bot or user message)
 */
export interface DialogTurn {
  speaker: 'bot' | 'user';
  message: string;
  extractedData?: Record<string, any>;  // Dati estratti dal parser
  validationResult?: 'valid' | 'invalid' | 'partial';
  nextAction?: 'continue' | 'escalate' | 'request_missing';
}

/**
 * Dialog example scenario
 */
export type DialogScenario =
  | 'complete'           // Utterance completa: tutti i dati in una volta
  | 'partial'           // Utterance parziale: alcuni dati mancanti
  | 'unintelligible'    // Utterance incomprensibile: parser non riconosce nulla
  | 'error'             // Utterance con errore: dati estratti ma non validi (constraints)
  | 'ambiguous';        // Utterance ambigua: dati ambigui o incompleti

/**
 * Complete dialog example
 */
export interface DialogExample {
  scenario: DialogScenario;
  turns: DialogTurn[];
  finalState: {
    completed: boolean;
    extractedValues: Record<string, any>;
  };
}

/**
 * Generate complete utterance based on structure
 *
 * Example: "Sono nato il 18 settembre 1980"
 */
function generateCompleteUtterance(
  node: WizardTaskTreeNode,
  structure: WizardTaskTreeNode[],
  locale: string = 'it'
): string {
  // If node has subNodes, generate composite utterance
  if (node.subNodes && node.subNodes.length > 0) {
    const parts: string[] = [];

    node.subNodes.forEach((subNode) => {
      // Generate realistic value based on type
      let value: string;
      if (subNode.type === 'number') {
        if (subNode.label.toLowerCase().includes('giorno') || subNode.label.toLowerCase().includes('day')) {
          value = String(Math.floor(Math.random() * 28) + 1); // 1-28
        } else if (subNode.label.toLowerCase().includes('mese') || subNode.label.toLowerCase().includes('month')) {
          const months = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
                         'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
          value = months[Math.floor(Math.random() * 12)];
        } else if (subNode.label.toLowerCase().includes('anno') || subNode.label.toLowerCase().includes('year')) {
          value = String(1980 + Math.floor(Math.random() * 40)); // 1980-2020
        } else {
          value = String(Math.floor(Math.random() * 100));
        }
      } else {
        // String type: use placeholder
        value = `[${subNode.label}]`;
      }
      parts.push(value);
    });

    // Combine parts into natural utterance
    if (locale === 'it') {
      if (node.label.toLowerCase().includes('data') || node.label.toLowerCase().includes('date')) {
        return `Sono nato il ${parts.join(' ')}`;
      }
      return `${node.label}: ${parts.join(', ')}`;
    } else {
      // English
      if (node.label.toLowerCase().includes('date') || node.label.toLowerCase().includes('birth')) {
        return `I was born on ${parts.join(' ')}`;
      }
      return `${node.label}: ${parts.join(', ')}`;
    }
  }

  // Simple node: generate single value
  if (node.type === 'email') {
    return 'example@email.com';
  } else if (node.type === 'phone') {
    return '+39 123 456 7890';
  } else if (node.type === 'number') {
    return String(Math.floor(Math.random() * 100));
  }

  return `[${node.label}]`;
}

/**
 * Simulate parser extraction on utterance
 *
 * Returns extracted data based on structure and parser rules
 */
function simulateParser(
  utterance: string,
  node: WizardTaskTreeNode,
  parser: WizardNLPContract | undefined
): Record<string, any> | null {
  // Simple simulation: extract based on node structure
  const extracted: Record<string, any> = {};

  if (node.subNodes && node.subNodes.length > 0) {
    // Try to extract sub-node values
    node.subNodes.forEach((subNode) => {
      // Simple regex-based extraction (simplified)
      if (subNode.type === 'number') {
        const numberMatch = utterance.match(/\d+/);
        if (numberMatch) {
          extracted[subNode.id] = parseInt(numberMatch[0], 10);
        }
      } else {
        // String: extract word/phrase
        const labelMatch = new RegExp(subNode.label, 'i');
        if (labelMatch.test(utterance)) {
          extracted[subNode.id] = `[${subNode.label}]`;
        }
      }
    });
  } else {
    // Simple node: extract entire utterance or pattern
    if (node.type === 'email') {
      const emailMatch = utterance.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (emailMatch) {
        extracted[node.id] = emailMatch[0];
      }
    } else if (node.type === 'phone') {
      const phoneMatch = utterance.match(/[\d\s+-]+/);
      if (phoneMatch) {
        extracted[node.id] = phoneMatch[0].trim();
      }
    } else {
      extracted[node.id] = utterance;
    }
  }

  return Object.keys(extracted).length > 0 ? extracted : null;
}

/**
 * Validate extracted data against constraints
 */
function validateConstraints(
  data: Record<string, any>,
  node: WizardTaskTreeNode,
  constraints: WizardConstraint[]
): Record<string, 'valid' | 'invalid'> {
  const result: Record<string, 'valid' | 'invalid'> = {};

  // Get constraints for this node
  const nodeConstraints = constraints.filter((c) => {
    // Match constraint to node (simplified: by kind or title)
    return c.kind === node.type || c.title?.toLowerCase().includes(node.label.toLowerCase());
  });

  // Validate each extracted value
  Object.entries(data).forEach(([nodeId, value]) => {
    const constraint = nodeConstraints.find((c) => c.kind === node.type);
    if (!constraint) {
      result[nodeId] = 'valid'; // No constraint = valid
      return;
    }

    // Check constraints
    if (typeof value === 'number') {
      if (constraint.min !== undefined && value < Number(constraint.min)) {
        result[nodeId] = 'invalid';
        return;
      }
      if (constraint.max !== undefined && value > Number(constraint.max)) {
        result[nodeId] = 'invalid';
        return;
      }
    }

    if (typeof value === 'string') {
      if (constraint.minLength !== undefined && value.length < constraint.minLength) {
        result[nodeId] = 'invalid';
        return;
      }
      if (constraint.maxLength !== undefined && value.length > constraint.maxLength) {
        result[nodeId] = 'invalid';
        return;
      }
      if (constraint.pattern && !new RegExp(constraint.pattern).test(value)) {
        result[nodeId] = 'invalid';
        return;
      }
    }

    result[nodeId] = 'valid';
  });

  return result;
}

/**
 * Generate complete dialog example (all data in one utterance)
 */
function generateCompleteExample(
  structure: WizardTaskTreeNode[],
  messages: WizardStepMessages,
  parser: WizardNLPContract | undefined,
  constraints: WizardConstraint[],
  locale: string = 'it'
): DialogExample {
  const rootNode = structure[0]; // Use first root node
  if (!rootNode) {
    throw new Error('Structure must have at least one root node');
  }

  // 1. Bot: start message
  const botStart = messages.ask?.base?.[0] ||
    (locale === 'it' ? 'Mi può dire la sua data di nascita?' : 'Can you tell me your date of birth?');

  // 2. Generate complete utterance
  const completeUtterance = generateCompleteUtterance(rootNode, structure, locale);

  // 3. Simulate parsing
  const extractedData = simulateParser(completeUtterance, rootNode, parser);

  // 4. Validate
  const validationResult = extractedData
    ? validateConstraints(extractedData, rootNode, constraints)
    : {};

  const allValid = Object.values(validationResult).every((v) => v === 'valid');

  // 5. Bot: confirmation or success
  const botConfirm = allValid
    ? (messages.success?.base?.[0] || messages.confirm?.base?.[0] ||
       (locale === 'it' ? 'Perfetto, grazie.' : 'Perfect, thank you.'))
    : (messages.violation?.base?.[0] ||
       (locale === 'it' ? 'Il valore non è valido.' : 'The value is not valid.'));

  return {
    scenario: 'complete',
    turns: [
      { speaker: 'bot', message: botStart },
      {
        speaker: 'user',
        message: completeUtterance,
        extractedData: extractedData || undefined,
        validationResult: allValid ? 'valid' : 'invalid',
        nextAction: allValid ? 'continue' : 'escalate'
      },
      ...(allValid ? [{ speaker: 'bot', message: botConfirm }] : [])
    ],
    finalState: {
      completed: allValid,
      extractedValues: extractedData || {}
    }
  };
}

/**
 * Generate partial dialog example (missing data)
 */
function generatePartialExample(
  structure: WizardTaskTreeNode[],
  messages: WizardStepMessages,
  parser: WizardNLPContract | undefined,
  locale: string = 'it'
): DialogExample {
  const rootNode = structure[0];
  if (!rootNode || !rootNode.subNodes || rootNode.subNodes.length === 0) {
    // Fallback to complete if no subNodes
    return generateCompleteExample(structure, messages, parser, [], locale);
  }

  // 1. Bot: start message
  const botStart = messages.ask?.base?.[0] ||
    (locale === 'it' ? 'Mi può dire la sua data di nascita?' : 'Can you tell me your date of birth?');

  // 2. User: partial utterance (missing some sub-nodes)
  const partialSubNodes = rootNode.subNodes.slice(0, Math.floor(rootNode.subNodes.length / 2));
  const partialUtterance = generateCompleteUtterance(
    { ...rootNode, subNodes: partialSubNodes },
    structure,
    locale
  );

  // 3. Simulate parsing (partial extraction)
  const extractedData = simulateParser(partialUtterance, rootNode, parser);

  // 4. Bot: request missing data
  const missingSubNode = rootNode.subNodes.find((sub) => !extractedData?.[sub.id]);
  const botRequest = missingSubNode
    ? (messages.ask?.reask?.[0] ||
       (locale === 'it'
         ? `In quale ${missingSubNode.label.toLowerCase()}?`
         : `What ${missingSubNode.label.toLowerCase()}?`))
    : (messages.ask?.base?.[0] ||
       (locale === 'it' ? 'Può completare i dati mancanti?' : 'Can you complete the missing data?'));

  // 5. User: complete missing data
  const completeUtterance = generateCompleteUtterance(
    { ...rootNode, subNodes: [missingSubNode!] },
    structure,
    locale
  );
  const completeExtracted = simulateParser(completeUtterance, rootNode, parser);

  // 6. Bot: confirmation
  const botConfirm = messages.success?.base?.[0] ||
    (locale === 'it' ? 'Grazie.' : 'Thank you.');

  return {
    scenario: 'partial',
    turns: [
      { speaker: 'bot', message: botStart },
      {
        speaker: 'user',
        message: partialUtterance,
        extractedData: extractedData || undefined,
        validationResult: 'partial',
        nextAction: 'request_missing'
      },
      { speaker: 'bot', message: botRequest },
      {
        speaker: 'user',
        message: completeUtterance,
        extractedData: completeExtracted || undefined,
        validationResult: 'valid',
        nextAction: 'continue'
      },
      { speaker: 'bot', message: botConfirm }
    ],
    finalState: {
      completed: true,
      extractedValues: { ...extractedData, ...completeExtracted }
    }
  };
}

/**
 * Generate unintelligible dialog example (parser doesn't recognize anything)
 */
function generateUnintelligibleExample(
  structure: WizardTaskTreeNode[],
  messages: WizardStepMessages,
  locale: string = 'it'
): DialogExample {
  const rootNode = structure[0];
  if (!rootNode) {
    throw new Error('Structure must have at least one root node');
  }

  // 1. Bot: start message
  const botStart = messages.ask?.base?.[0] ||
    (locale === 'it' ? 'Mi può dire la sua data di nascita?' : 'Can you tell me your date of birth?');

  // 2. User: unintelligible utterance
  const unintelligibleUtterance = locale === 'it'
    ? 'Sono nato il... ehm... boh.'
    : 'I was born on... um... I don\'t know.';

  // 3. Bot: escalation (noMatch)
  const botEscalation = messages.ask?.reask?.[0] ||
    (locale === 'it' ? 'Non ho capito, può ripetere?' : 'I didn\'t understand, can you repeat?');

  return {
    scenario: 'unintelligible',
    turns: [
      { speaker: 'bot', message: botStart },
      {
        speaker: 'user',
        message: unintelligibleUtterance,
        extractedData: undefined,
        validationResult: 'invalid',
        nextAction: 'escalate'
      },
      { speaker: 'bot', message: botEscalation }
    ],
    finalState: {
      completed: false,
      extractedValues: {}
    }
  };
}

/**
 * Generate error dialog example (extracted but invalid)
 */
function generateErrorExample(
  structure: WizardTaskTreeNode[],
  messages: WizardStepMessages,
  parser: WizardNLPContract | undefined,
  constraints: WizardConstraint[],
  locale: string = 'it'
): DialogExample {
  const rootNode = structure[0];
  if (!rootNode) {
    throw new Error('Structure must have at least one root node');
  }

  // 1. Bot: start message
  const botStart = messages.ask?.base?.[0] ||
    (locale === 'it' ? 'Mi può dire la sua data di nascita?' : 'Can you tell me your date of birth?');

  // 2. User: utterance with invalid value (e.g., day 40)
  const errorUtterance = locale === 'it'
    ? 'Sono nato il 40 settembre 1980'
    : 'I was born on September 40, 1980';

  // 3. Simulate parsing (extracts but invalid)
  const extractedData = simulateParser(errorUtterance, rootNode, parser);
  const validationResult = extractedData
    ? validateConstraints(extractedData, rootNode, constraints)
    : {};

  // 4. Bot: error message
  const botError = messages.violation?.base?.[0] ||
    (locale === 'it' ? 'Il giorno non è valido. Può ripetere?' : 'The day is not valid. Can you repeat?');

  return {
    scenario: 'error',
    turns: [
      { speaker: 'bot', message: botStart },
      {
        speaker: 'user',
        message: errorUtterance,
        extractedData: extractedData || undefined,
        validationResult: 'invalid',
        nextAction: 'escalate'
      },
      { speaker: 'bot', message: botError }
    ],
    finalState: {
      completed: false,
      extractedValues: extractedData || {}
    }
  };
}

/**
 * Generate ambiguous dialog example (incomplete/ambiguous data)
 */
function generateAmbiguousExample(
  structure: WizardTaskTreeNode[],
  messages: WizardStepMessages,
  parser: WizardNLPContract | undefined,
  locale: string = 'it'
): DialogExample {
  const rootNode = structure[0];
  if (!rootNode || !rootNode.subNodes || rootNode.subNodes.length === 0) {
    // Fallback to complete if no subNodes
    return generateCompleteExample(structure, messages, parser, [], locale);
  }

  // 1. Bot: start message
  const botStart = messages.ask?.base?.[0] ||
    (locale === 'it' ? 'Mi può dire la sua data di nascita?' : 'Can you tell me your date of birth?');

  // 2. User: ambiguous utterance (e.g., only day)
  const firstSubNode = rootNode.subNodes[0];
  const ambiguousUtterance = locale === 'it'
    ? `Sono nato il ${Math.floor(Math.random() * 28) + 1}`
    : `I was born on the ${Math.floor(Math.random() * 28) + 1}`;

  // 3. Simulate parsing (partial)
  const extractedData = simulateParser(ambiguousUtterance, rootNode, parser);

  // 4. Bot: disambiguation request
  const missingSubNode = rootNode.subNodes.find((sub) => sub.id !== firstSubNode.id);
  const botDisambiguate = missingSubNode
    ? (messages.disambiguation?.base?.[0] ||
       (locale === 'it'
         ? `Capito. Di quale ${missingSubNode.label.toLowerCase()}?`
         : `Got it. Which ${missingSubNode.label.toLowerCase()}?`))
    : (messages.ask?.reask?.[0] ||
       (locale === 'it' ? 'Può essere più specifico?' : 'Can you be more specific?'));

  return {
    scenario: 'ambiguous',
    turns: [
      { speaker: 'bot', message: botStart },
      {
        speaker: 'user',
        message: ambiguousUtterance,
        extractedData: extractedData || undefined,
        validationResult: 'partial',
        nextAction: 'request_missing'
      },
      { speaker: 'bot', message: botDisambiguate }
    ],
    finalState: {
      completed: false,
      extractedValues: extractedData || {}
    }
  };
}

/**
 * Generate all dialog examples for a structure
 *
 * @param structure Array of WizardTaskTreeNode (with constraints, parser, messages populated)
 * @param constraints Array of WizardConstraint
 * @param parser WizardNLPContract (optional)
 * @param messages WizardStepMessages
 * @param locale Locale (default: 'it')
 * @returns Array of DialogExample covering all scenarios
 */
export function generateDialogExamples(
  structure: WizardTaskTreeNode[],
  constraints: WizardConstraint[],
  parser: WizardNLPContract | undefined,
  messages: WizardStepMessages,
  locale: string = 'it'
): DialogExample[] {
  if (!structure || structure.length === 0) {
    return [];
  }

  const examples: DialogExample[] = [];

  try {
    // 1. Complete example
    examples.push(generateCompleteExample(structure, messages, parser, constraints, locale));

    // 2. Partial example (only if structure has subNodes)
    if (structure[0]?.subNodes && structure[0].subNodes.length > 0) {
      examples.push(generatePartialExample(structure, messages, parser, locale));
      examples.push(generateAmbiguousExample(structure, messages, parser, locale));
    }

    // 3. Unintelligible example
    examples.push(generateUnintelligibleExample(structure, messages, locale));

    // 4. Error example (only if constraints exist)
    if (constraints && constraints.length > 0) {
      examples.push(generateErrorExample(structure, messages, parser, constraints, locale));
    }
  } catch (error) {
    console.error('[DialogExampleGeneratorService] Error generating examples:', error);
  }

  return examples;
}
