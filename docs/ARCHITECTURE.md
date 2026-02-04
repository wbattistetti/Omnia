# Architecture Documentation - TaskTree Generation Pipeline

## Overview

This document describes the architecture of the **TaskTree Generation Pipeline**, a modular system for generating complete conversational AI parsers from natural language descriptions.

The system has been refactored from a monolithic structure to a clean, layered architecture following the **7-Layer Architecture** pattern.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Layer Structure](#layer-structure)
3. [Module Documentation](#module-documentation)
4. [Data Flow](#data-flow)
5. [Migration Guide](#migration-guide)
6. [Future Enhancements](#future-enhancements)

---

## Architecture Overview

### Core Principles

1. **Single Responsibility**: Each module has one clear purpose
2. **Pure Functions**: Generation logic is side-effect free
3. **Layered Separation**: Clear boundaries between layers
4. **Orchestrator Pattern**: Single point of coordination
5. **Testability**: All layers are unit-testable

### Terminology

| Old Term | New Term | Description |
|----------|----------|-------------|
| DDT | TaskTree | Runtime view built from Template + Instance |
| DialogueDataTemplate | TaskTemplate | Persisted template |
| DDTWizard | TaskTreeWizard | UI component for creating TaskTrees |

---

## Layer Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR LAYER                        │
│  (executeGenerationPlan.ts) - Coordinates all layers        │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
│   CONTRACT   │ │   ENGINE    │ │  ESCALATION │
│    LAYER     │ │    LAYER     │ │    LAYER    │
└───────┬──────┘ └──────┬──────┘ └──────┬──────┘
        │               │               │
┌───────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
│  CONSTRAINT  │ │     TEST     │ │  MESSAGING  │
│    LAYER     │ │    LAYER     │ │    LAYER    │
└──────────────┘ └──────────────┘ └─────────────┘
```

### Layer Responsibilities

#### 1. Orchestrator Layer
- **File**: `src/utils/wizard/executeGenerationPlan.ts`
- **Responsibility**: Coordinates all generation steps
- **Side Effects**: Only layer with side effects (API calls, persistence)
- **Dependencies**: All other layers

#### 2. Contract Layer
- **Files**:
  - `src/utils/contract/buildEntity.ts`
  - `src/utils/contract/buildSubgroups.ts`
  - `src/utils/contract/readEntityProperties.ts`
  - `src/utils/contract/readSubgroupProperties.ts`
- **Responsibility**: Builds semantic contracts from TaskTree nodes
- **Pure Functions**: No side effects, deterministic output

#### 3. Constraint Layer
- **Files**: `src/utils/wizard/generateContract.ts` (includes constraints)
- **Responsibility**: Generates validation constraints
- **AI Integration**: Calls AI to generate constraint rules

#### 4. Engine Layer
- **Files**:
  - `src/utils/wizard/generateEngines.ts`
  - `src/utils/wizard/proposeEngines.ts`
- **Responsibility**: Proposes and generates recognition engines
- **Engine Types**: Regex, NER, LLM, Heuristic

#### 5. Escalation Layer
- **Files**: Integrated in `generateEngines.ts`
- **Responsibility**: Generates escalation strategies
- **Fallback**: Default escalation when no engine matches

#### 6. Test Layer
- **Files**: `src/utils/wizard/generateTestExamples.ts`
- **Responsibility**: Generates test examples for validation
- **Output**: Positive and negative test cases

#### 7. Messaging Layer
- **Files**: Integrated in wizard pipeline
- **Responsibility**: Generates user-facing messages
- **Translation**: Multi-language support

---

## Module Documentation

### Wizard Modules (`src/utils/wizard/`)

#### `analyzeTree.ts`
Analyzes a TaskTree structure to identify nodes that need generation.

**Functions:**
- `analyzeTree(tree: TaskTreeNode[]): TreeAnalysis`
  - Analyzes tree structure
  - Identifies existing contracts
  - Returns analysis with node status

**Types:**
```typescript
interface NodeAnalysis {
  nodeId: string;
  nodeLabel: string;
  hasContract: boolean;
  hasEngines: boolean;
  needsGeneration: boolean;
}

interface TreeAnalysis {
  nodes: NodeAnalysis[];
  totalNodes: number;
  nodesNeedingGeneration: number;
}
```

#### `proposeEngines.ts`
Proposes recognition engines for nodes based on their type and constraints.

**Functions:**
- `proposeEngines(node: TaskTreeNode, existingEngines?: Engine[]): EngineProposal[]`
  - Analyzes node type
  - Proposes appropriate engines
  - Returns prioritized list

**Engine Types:**
- `regex`: Pattern-based matching
- `ner`: Named Entity Recognition
- `llm`: Large Language Model
- `heuristic`: Rule-based matching

#### `buildGenerationPlan.ts`
Builds a generation plan from tree analysis and user selections.

**Functions:**
- `buildGenerationPlan(analysis: TreeAnalysis, selectedNodes?: string[]): GenerationPlan`
  - Filters nodes to generate
  - Orders generation sequence
  - Returns execution plan

**Types:**
```typescript
interface GenerationPlan {
  nodes: string[];
  totalSteps: number;
  estimatedTime: number;
}
```

#### `generateContract.ts`
Generates semantic contracts for nodes.

**Functions:**
- `generateContractForNode(node: TaskTreeNode, progressCallback?: (progress: GenerationProgress) => void): Promise<SemanticContract>`
  - Calls AI to generate contract
  - Saves contract to service
  - Reports progress

#### `generateEngines.ts`
Generates recognition engines for nodes.

**Functions:**
- `generateEngineForNode(node: TaskTreeNode, contract: SemanticContract, progressCallback?: (progress: GenerationProgress) => void): Promise<Engine[]>`
  - Calls AI to generate engine config
  - Builds engine configuration
  - Saves engines to service

#### `generateTestExamples.ts`
Generates test examples for validation.

**Functions:**
- `generateTestExamplesForNode(node: TaskTreeNode, contract: SemanticContract, progressCallback?: (progress: GenerationProgress) => void): Promise<TestExample[]>`
  - Generates positive examples
  - Generates negative examples
  - Returns test suite

#### `executeGenerationPlan.ts`
Orchestrates the complete generation pipeline.

**Functions:**
- `executeGenerationPlan(plan: GenerationPlan, tree: TaskTreeNode[], progressCallback?: (progress: GenerationProgress) => void): Promise<NodeGenerationResult[]>`
  - Executes plan step by step
  - Coordinates all layers
  - Handles errors and retries
  - Returns generation results

### Contract Modules (`src/utils/contract/`)

#### `readEntityProperties.ts`
Reads entity-level properties from TaskTree nodes.

**Functions:**
- `readEntityDescription(node: TaskTreeNode): string`
- `readEntityConstraints(node: TaskTreeNode): Constraint[]`
- `readEntityNormalization(node: TaskTreeNode): NormalizationRule[]`
- `readRedefinitionPolicy(node: TaskTreeNode): RedefinitionPolicy`

#### `readSubgroupProperties.ts`
Reads subgroup-level properties from TaskTree nodes.

**Functions:**
- `readSubgroupMeaning(node: TaskTreeNode, subgroup: TaskTreeNode): string`
- `readSubgroupOptionality(node: TaskTreeNode, subgroup: TaskTreeNode): boolean`
- `readSubgroupFormats(node: TaskTreeNode, subgroup: TaskTreeNode): string[]`
- `readSubgroupNormalization(node: TaskTreeNode, subgroup: TaskTreeNode): NormalizationRule[]`
- `readSubgroupConstraints(node: TaskTreeNode, subgroup: TaskTreeNode): Constraint[]`

#### `buildSubgroups.ts`
Builds SemanticSubgroup objects from TaskTree nodes.

**Functions:**
- `buildSubgroup(node: TaskTreeNode, subgroup: TaskTreeNode): SemanticSubgroup`
- `buildSubgroups(node: TaskTreeNode): SemanticSubgroup[]`
  - Maintains stable order
  - Handles canonical format (value vs object)

#### `buildEntity.ts`
Main contract builder that orchestrates all contract modules.

**Functions:**
- `buildSemanticContract(node: TaskTreeNode): SemanticContract`
  - Orchestrates all contract modules
  - Builds complete contract structure
  - Handles versioning and timestamps

---

## Data Flow

### Generation Flow

```
User Input (Natural Language)
    ↓
[TaskTreeWizard] - UI Component
    ↓
[analyzeTree] - Analyze structure
    ↓
[buildGenerationPlan] - Create plan
    ↓
[executeGenerationPlan] - Orchestrator
    ↓
    ├─→ [generateContract] → Contract Layer
    ├─→ [generateEngines] → Engine Layer
    ├─→ [generateTestExamples] → Test Layer
    └─→ [Messaging] → Messaging Layer
    ↓
Complete TaskTree (Contract + Engines + Tests + Messages)
    ↓
[ResponseEditor] - Edit and refine
    ↓
[Persistence] - Save to database
```

### Contract Building Flow

```
TaskTreeNode
    ↓
[readEntityProperties] - Extract entity-level properties
    ↓
[readSubgroupProperties] - Extract subgroup properties
    ↓
[buildSubgroups] - Build subgroup structures
    ↓
[buildEntity] - Assemble complete contract
    ↓
SemanticContract
```

---

## Migration Guide

### From DDT to TaskTree

#### Terminology Changes

| Old | New |
|-----|-----|
| `DDT` | `TaskTree` |
| `DialogueDataTemplate` | `TaskTemplate` |
| `DDTWizard` | `TaskTreeWizard` |
| `AssembledDDT` | `AssembledTaskTree` (alias for backward compatibility) |

#### Import Path Changes

```typescript
// Old
import { analyzeTree } from './contractWizardOrchestrator';
import { buildSemanticContract } from './semanticContractBuilder';

// New
import { analyzeTree } from './wizard/analyzeTree';
import { buildSemanticContract } from './contract/buildEntity';
```

#### Function Name Changes

```typescript
// Old
loadAndAdaptDDTForExistingTask()
buildDDTFromTemplate()

// New
loadAndAdaptTaskTreeForExistingTask()
buildTaskTreeFromTemplate()
```

### Backward Compatibility

The system maintains backward compatibility through:

1. **Type Aliases**: `AssembledTaskTree = AssembledDDT`
2. **Re-exports**: Old import paths still work
3. **Deprecation Warnings**: Old functions show deprecation notices

---

## Future Enhancements

### Planned Improvements

1. **Parallel Generation**: Generate multiple nodes in parallel
2. **Incremental Updates**: Update only changed nodes
3. **Caching Layer**: Cache AI responses for similar nodes
4. **Validation Pipeline**: Pre-validate before generation
5. **Rollback Support**: Undo generation steps

### Architecture Evolution

The current architecture is designed to support:

- **Microservices**: Each layer can be extracted to a service
- **Plugin System**: Engine types as plugins
- **Multi-Provider**: Support multiple AI providers
- **Streaming**: Real-time progress updates

---

## File Structure

```
src/
├── utils/
│   ├── wizard/              # Generation pipeline
│   │   ├── analyzeTree.ts
│   │   ├── proposeEngines.ts
│   │   ├── buildGenerationPlan.ts
│   │   ├── generateContract.ts
│   │   ├── generateEngines.ts
│   │   ├── generateTestExamples.ts
│   │   ├── executeGenerationPlan.ts
│   │   └── types.ts
│   │
│   ├── contract/            # Contract building
│   │   ├── readEntityProperties.ts
│   │   ├── readSubgroupProperties.ts
│   │   ├── buildSubgroups.ts
│   │   └── buildEntity.ts
│   │
│   ├── contractWizardOrchestrator.ts  # Re-exports (deprecated)
│   └── semanticContractBuilder.ts    # Re-exports (deprecated)
│
└── components/
    └── TaskTreeBuilder/      # UI components
        └── TaskTreeWizard/
            └── DDTWizard.tsx
```

---

## Testing

All modules have comprehensive unit tests:

- `src/utils/wizard/__tests__/` - Wizard module tests
- `src/utils/contract/__tests__/` - Contract module tests

Run tests:
```bash
npm test
```

---

## Contributing

When adding new features:

1. **Follow Layer Boundaries**: Don't mix layer responsibilities
2. **Write Tests**: All new functions must have tests
3. **Update Documentation**: Keep this doc in sync
4. **Maintain Backward Compatibility**: Use deprecation warnings

---

## References

- [Rename Plan](./RENAME_DDT_TO_TASKTREE_PLAN.md)
- [Task Templates V2](./TASK_TEMPLATES_V2_VERIFICATION.md)
- [DDT Collection Implementation](./DDT_COLLECTION_IMPLEMENTATION.md)
