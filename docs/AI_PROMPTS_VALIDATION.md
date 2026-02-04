# AI Prompts Validation Guide

## Overview
This document validates all AI prompts used in the wizard to ensure they produce deterministic, valid JSON output that matches TypeScript types.

## Prompt Validation Checklist

For each prompt, verify:

- [ ] **Determinism**: Same input produces consistent output
- [ ] **JSON Format**: Output is valid JSON (no markdown, no code fences)
- [ ] **Type Safety**: Output matches TypeScript interface
- [ ] **Completeness**: All required fields are present
- [ ] **Robustness**: Handles edge cases gracefully
- [ ] **Examples**: Includes few-shot examples
- [ ] **Constraints**: Clearly states output format requirements

## Prompt Inventory

### 1. Structure Generation (`generate_structure_prompt.py`)

**Purpose**: Generate hierarchical data structure for a task

**Expected Output**:
```typescript
interface SchemaNode {
  id: string;
  label: string;
  type?: string;
  icon?: string;
  subData?: SchemaNode[];
  subTasks?: SchemaNode[];
}
```

**Validation**:
- [ ] Returns array of SchemaNode objects
- [ ] Each node has `id` and `label`
- [ ] Sub-nodes are nested in `subData` or `subTasks`
- [ ] No circular references
- [ ] Maximum depth respected (10 levels)

**Test Cases**:
- Simple task: "Email Address" → 1 node
- Complex task: "Date of Birth" → 1 root + 3 sub-nodes
- Nested task: "Address" → 1 root + multiple levels

### 2. Structure Regeneration (`regenerate_structure_prompt.py`)

**Purpose**: Regenerate structure based on user feedback

**Expected Output**: Same as Structure Generation

**Validation**:
- [ ] Incorporates user feedback
- [ ] Preserves valid parts of previous structure
- [ ] Returns valid SchemaNode array
- [ ] No duplicate IDs

**Test Cases**:
- Add node: "Add validation" → new node added
- Remove node: "Remove X" → node removed
- Modify node: "Change Y to Z" → node modified

### 3. Contract Refinement (`generate_contracts_prompt.py`)

**Purpose**: Refine semantic contract with enhanced descriptions

**Expected Output**:
```typescript
interface SemanticContract {
  entity: {
    label: string;
    type?: string;
    description?: string;
  };
  outputCanonical: {
    format: 'object' | 'value';
  };
  subentities?: Array<{
    subTaskKey: string;
    meaning?: string;
  }>;
  constraints?: Record<string, any>;
}
```

**Validation**:
- [ ] Returns valid SemanticContract
- [ ] All fields are optional (additive operation)
- [ ] Enhanced descriptions are clear
- [ ] Subentities are properly structured

**Test Cases**:
- Simple contract: Email → enhanced description
- Complex contract: Address → enhanced subentities
- Missing fields: Partial contract → adds missing fields

### 4. Canonical Values (`generate_canonical_values_prompt.py`)

**Purpose**: Generate engine-agnostic example values

**Expected Output**:
```typescript
interface CanonicalValues {
  complete: string[];
  partial: string[];
  invalid: string[];
  edgeCases?: string[];
}
```

**Validation**:
- [ ] Returns valid CanonicalValues object
- [ ] All arrays are non-empty
- [ ] Values match contract type
- [ ] Edge cases are included when relevant

**Test Cases**:
- Email: valid emails, invalid formats
- Date: valid dates, invalid formats
- Number: valid numbers, out of range

### 5. Constraints (`generate_constraints_prompt.py`)

**Purpose**: Generate validation constraints

**Expected Output**:
```typescript
interface Constraint {
  min?: number;
  max?: number;
  pattern?: string;
  format?: string;
  required?: boolean;
  custom?: Record<string, any>;
}
```

**Validation**:
- [ ] Returns valid Constraint object
- [ ] Constraints are coherent with canonical values
- [ ] Pattern regex is valid
- [ ] Min/max are logical (min <= max)

**Test Cases**:
- Email: pattern validation
- Date: min/max date range
- Number: min/max numeric range

### 6. Engines (`generate_engines_prompt.py`)

**Purpose**: Generate all five extraction engines

**Expected Output**:
```typescript
interface Engines {
  regex?: EngineConfig;
  rule_based?: EngineConfig;
  ner?: EngineConfig;
  llm?: EngineConfig;
  embedding?: EngineConfig;
}
```

**Validation**:
- [ ] Returns all five engine types
- [ ] Each engine config is valid
- [ ] Regex patterns are compilable
- [ ] Engines are coherent with constraints

**Test Cases**:
- Email: regex pattern, rule-based validation
- Date: regex pattern, NER extraction
- Complex: all engines generated

### 7. Escalation (`generate_escalation_prompt.py`)

**Purpose**: Generate engine escalation sequence

**Expected Output**:
```typescript
interface Escalation {
  sequence: Array<{
    engine: string;
    priority: number;
    fallback?: string;
  }>;
}
```

**Validation**:
- [ ] Returns valid Escalation object
- [ ] Sequence includes all available engines
- [ ] Priorities are unique and ordered
- [ ] Fallbacks are valid engine names

**Test Cases**:
- Simple: regex → rule_based → llm
- Complex: all engines in sequence
- Custom: user-specified order

### 8. Test Examples (`generate_test_examples_prompt.py`)

**Purpose**: Generate test cases for validation

**Expected Output**:
```typescript
interface TestExamples {
  testExamples: string[];
}
```

**Validation**:
- [ ] Returns array of test strings
- [ ] Examples cover all edge cases
- [ ] Examples match contract type
- [ ] Examples are diverse

**Test Cases**:
- Email: various formats
- Date: various formats and locales
- Number: various ranges

### 9. AI Messages (`generate_ai_messages_prompt.py`)

**Purpose**: Generate dialogue messages for all steps

**Expected Output**:
```typescript
interface AIMessages {
  start: string[];
  noInput: string[];
  noMatch: string[];
  confirmation: string[];
  success: string[];
}
```

**Validation**:
- [ ] Returns valid AIMessages object
- [ ] All message arrays are non-empty
- [ ] Messages are contextually appropriate
- [ ] Messages match contract semantics

**Test Cases**:
- Email: appropriate messages for email collection
- Date: appropriate messages for date collection
- Complex: messages for nested structures

### 10. Message Generalization (`generalize_messages_prompt.py`)

**Purpose**: Generalize contextual messages to template messages

**Expected Output**: Same as AI Messages

**Validation**:
- [ ] Removes contextual references
- [ ] Maintains stylistic consistency
- [ ] Preserves semantic meaning
- [ ] Returns reusable template messages

**Test Cases**:
- Contextual: "Enter your email" → "Enter email"
- Specific: "Enter your date of birth" → "Enter date"
- Complex: Nested messages generalized

## Validation Script

Run the validation script to test all prompts:

```bash
node scripts/validate-ai-prompts.js
```

## Manual Testing

For each prompt:

1. **Test with simple input**: Verify basic functionality
2. **Test with complex input**: Verify edge cases
3. **Test with invalid input**: Verify error handling
4. **Test multiple times**: Verify determinism
5. **Test with different providers**: Verify provider compatibility

## Common Issues

### Issue 1: Invalid JSON
**Symptom**: Response contains markdown or code fences
**Solution**: Strengthen prompt instructions, add JSON schema

### Issue 2: Missing Fields
**Symptom**: Response missing required fields
**Solution**: Add explicit field list, add examples

### Issue 3: Type Mismatch
**Symptom**: Response doesn't match TypeScript type
**Solution**: Update prompt to match type exactly

### Issue 4: Non-Deterministic
**Symptom**: Same input produces different output
**Solution**: Add temperature=0, add more specific instructions

## Next Steps

1. ✅ Document all prompts
2. ✅ Create validation checklist
3. ⏳ Create automated validation script
4. ⏳ Add prompt versioning
5. ⏳ Add prompt A/B testing
