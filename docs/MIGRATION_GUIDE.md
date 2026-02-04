# Migration Guide: DDT → TaskTree

## Overview

This guide helps developers migrate from the old DDT (DialogueDataTemplate) terminology and architecture to the new TaskTree system.

---

## Terminology Mapping

### Core Concepts

| Old Term | New Term | Notes |
|----------|----------|-------|
| `DDT` | `TaskTree` | Runtime view built from Template + Instance |
| `DialogueDataTemplate` | `TaskTemplate` | Persisted template |
| `DataDialogueTemplate` | `TaskTemplate` | Alternative name (deprecated) |
| `DDTWizard` | `TaskTreeWizard` | UI component |
| `AssembledDDT` | `AssembledTaskTree` | Type alias for backward compatibility |

### Variables and Functions

| Old | New |
|-----|-----|
| `ddt` | `taskTree` |
| `ddtList` | `taskTreeList` |
| `onOpenDDT` | `onOpenTaskTree` |
| `hasTaskDDT` | `hasTaskTree` |
| `loadAndAdaptDDTForExistingTask` | `loadAndAdaptTaskTreeForExistingTask` |
| `buildDDTFromTemplate` | `buildTaskTreeFromTemplate` |

---

## Import Path Changes

### Wizard Modules

```typescript
// ❌ Old
import { analyzeTree } from './contractWizardOrchestrator';
import { proposeEngines } from './contractWizardOrchestrator';
import { buildGenerationPlan } from './contractWizardOrchestrator';
import { executeGenerationPlan } from './contractWizardOrchestrator';

// ✅ New
import { analyzeTree } from './wizard/analyzeTree';
import { proposeEngines } from './wizard/proposeEngines';
import { buildGenerationPlan } from './wizard/buildGenerationPlan';
import { executeGenerationPlan } from './wizard/executeGenerationPlan';
```

### Contract Modules

```typescript
// ❌ Old
import { buildSemanticContract } from './semanticContractBuilder';

// ✅ New
import { buildSemanticContract } from './contract/buildEntity';
```

### Component Imports

```typescript
// ❌ Old
import DDTWizard from '../DialogueDataTemplateBuilder/DDTWizard/DDTWizard';
import type { AssembledDDT } from '../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';

// ✅ New
import TaskTreeWizard from '../TaskTreeBuilder/TaskTreeWizard/DDTWizard';
import type { AssembledTaskTree } from '../TaskTreeBuilder/DDTAssembler/currentDDT.types';
```

### Context and Hooks

```typescript
// ❌ Old
import { useDDTContext } from '../../context/DDTContext';
import { useDDTManager } from '../../context/DDTManagerContext';

// ✅ New
import { useTaskTreeContext } from '../../context/TaskTreeContext';
import { useTaskTreeManager } from '../../context/TaskTreeManagerContext';
```

---

## Code Changes

### Component Props

```typescript
// ❌ Old
interface MyComponentProps {
  ddt: AssembledDDT;
  onDDTUpdate: (ddt: AssembledDDT) => void;
  hasDDT: boolean;
}

// ✅ New
interface MyComponentProps {
  taskTree: AssembledTaskTree;
  onTaskTreeUpdate: (taskTree: AssembledTaskTree) => void;
  hasTaskTree: boolean;
}
```

### Function Calls

```typescript
// ❌ Old
const ddt = await loadAndAdaptDDTForExistingTask(taskId, projectId);
const hasDDT = hasTaskDDT(row);
openDDT(ddtId);

// ✅ New
const taskTree = await loadAndAdaptTaskTreeForExistingTask(taskId, projectId);
const hasTaskTree = hasTaskTree(row);
openTaskTree(taskTreeId);
```

### Context Usage

```typescript
// ❌ Old
const { ddt, setDDT } = useDDTContext();
const { ddtList, openDDT, closeDDT } = useDDTManager();

// ✅ New
const { taskTree, setTaskTree } = useTaskTreeContext();
const { taskTreeList, openTaskTree, closeTaskTree } = useTaskTreeManager();
```

---

## File Renaming

### Files Renamed

| Old Path | New Path |
|----------|----------|
| `src/utils/ddtInstanceManager.ts` | `src/utils/taskTreeManager.ts` |
| `src/utils/ddtMergeUtils.ts` | `src/utils/taskTreeMergeUtils.ts` |
| `src/utils/ddtPromptAdapter.ts` | `src/utils/taskTreePromptAdapter.ts` |
| `src/utils/ddtStepGenerator.ts` | `src/utils/taskTreeStepGenerator.ts` |
| `src/components/DialogueDataTemplateBuilder/` | `src/components/TaskTreeBuilder/` |
| `src/components/DialogueDataTemplateBuilder/DDTWizard/` | `src/components/TaskTreeBuilder/TaskTreeWizard/` |
| `src/context/DDTContext.tsx` | `src/context/TaskTreeContext.tsx` |
| `src/context/DDTManagerContext.tsx` | `src/context/TaskTreeManagerContext.tsx` |

### Functions Renamed

| Old Function | New Function | File |
|--------------|--------------|------|
| `loadAndAdaptDDTForExistingTask` | `loadAndAdaptTaskTreeForExistingTask` | `taskTreeManager.ts` |
| `loadDDTFromTemplate` | `loadTaskTreeFromTemplate` | `taskTreeMergeUtils.ts` |
| `AdaptPromptToContext` | `AdaptTaskTreePromptToContext` | `taskTreePromptAdapter.ts` |
| `generateAllStepsFromAI` | `generateAllTaskTreeStepsFromAI` | `taskTreeStepGenerator.ts` |

---

## Backward Compatibility

### Type Aliases

The system maintains backward compatibility through type aliases:

```typescript
// In currentDDT.types.ts
export type AssembledTaskTree = AssembledDDT;
```

This allows gradual migration - old code using `AssembledDDT` will continue to work.

### Re-exports

Old import paths are maintained through re-exports:

```typescript
// In contractWizardOrchestrator.ts
export { analyzeTree } from './wizard/analyzeTree';
export { proposeEngines } from './wizard/proposeEngines';
// ... etc
```

### Deprecation Warnings

Old functions show deprecation warnings:

```typescript
/**
 * @deprecated Use loadAndAdaptTaskTreeForExistingTask instead
 */
export function loadAndAdaptDDTForExistingTask(...) {
  // Implementation
}
```

---

## Migration Checklist

### Phase 1: Update Imports

- [ ] Update all `DialogueDataTemplateBuilder` imports to `TaskTreeBuilder`
- [ ] Update all `DDTWizard` imports to `TaskTreeWizard`
- [ ] Update all context imports (`DDTContext` → `TaskTreeContext`)
- [ ] Update all utility imports (`ddtInstanceManager` → `taskTreeManager`)

### Phase 2: Update Function Calls

- [ ] Replace `useDDTContext()` with `useTaskTreeContext()`
- [ ] Replace `useDDTManager()` with `useTaskTreeManager()`
- [ ] Replace `openDDT()` with `openTaskTree()`
- [ ] Replace `hasTaskDDT()` with `hasTaskTree()`

### Phase 3: Update Variable Names

- [ ] Rename `ddt` variables to `taskTree`
- [ ] Rename `ddtList` to `taskTreeList`
- [ ] Rename `onOpenDDT` to `onOpenTaskTree`
- [ ] Rename `hasDDT` props to `hasTaskTree`

### Phase 4: Update Types

- [ ] Replace `AssembledDDT` with `AssembledTaskTree` (or use alias)
- [ ] Update interface definitions
- [ ] Update function signatures

### Phase 5: Update Comments

- [ ] Update code comments mentioning "DDT"
- [ ] Update JSDoc comments
- [ ] Update README files

---

## Common Issues

### Issue 1: Type Errors

**Problem:** TypeScript errors after renaming types.

**Solution:** Use type alias `AssembledTaskTree` which is compatible with `AssembledDDT`.

```typescript
// This works:
const ddt: AssembledDDT = ...;
const taskTree: AssembledTaskTree = ddt; // ✅ Compatible
```

### Issue 2: Import Errors

**Problem:** Cannot find module after file rename.

**Solution:** Update import paths to new locations.

```typescript
// Old
import { ... } from './ddtInstanceManager';

// New
import { ... } from './taskTreeManager';
```

### Issue 3: Context Not Found

**Problem:** `useDDTContext` is not exported.

**Solution:** Update to use new context:

```typescript
// Old
import { useDDTContext } from '../../context/DDTContext';

// New
import { useTaskTreeContext } from '../../context/TaskTreeContext';
```

---

## Testing After Migration

After migrating, run:

```bash
# TypeScript compilation
npm run build

# Unit tests
npm test

# Integration tests
npm run test:integration
```

---

## Rollback Plan

If issues occur, you can rollback by:

1. **Revert file renames** (git revert)
2. **Use type aliases** for backward compatibility
3. **Keep old imports** working through re-exports

The system is designed to support gradual migration.

---

## Support

For questions or issues during migration:

1. Check this guide first
2. Review [ARCHITECTURE.md](./ARCHITECTURE.md)
3. Check [RENAME_DDT_TO_TASKTREE_PLAN.md](./RENAME_DDT_TO_TASKTREE_PLAN.md)
4. Open an issue with migration tag

---

## Migration Status

**Current Status:** ✅ Phase 1-4 Complete

- ✅ File renames complete
- ✅ Function renames complete
- ✅ Context renames complete
- ✅ Import updates complete
- ⏳ Comment updates in progress (Phase 5)

**Next Steps:**
- Complete comment updates
- Update documentation
- Remove deprecated code (future)
