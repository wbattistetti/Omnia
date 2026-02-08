# TaskEditor/ResponseEditor Refactoring Plan

## Current Status

✅ **Phase 0: TypeScript Aliases - COMPLETED**
- Aliases configured in `tsconfig.app.json` and `vite.config.ts`
- All existing relative imports continue to work
- Ready for refactoring

## Next Steps (Incremental & Safe)

### Phase 1: Domain Logic Extraction (SAFE - No State Changes)

**Goal**: Extract pure functions to `core/domain/` without modifying existing code.

**Steps**:
1. Create `src/components/TaskEditor/ResponseEditor/core/domain/` structure
2. Move pure functions from existing files:
   - `getdataList`, `getSubDataList` → `core/domain/taskTree.ts`
   - `getNodeSteps`, `findNode` → `core/domain/node.ts`
   - `removeNodePure` → `core/domain/node.ts`
   - `applyNodeUpdate` (pure parts) → `core/domain/taskTree.ts`
3. Create barrel exports (`index.ts`) for clean imports
4. Update imports gradually (one file at a time)
5. Test after each change

**Risk**: LOW - Only moving pure functions, no state changes
**Time**: 2-3 hours
**Verification**: All tests pass, build works

---

### Phase 2: State Management Setup (MEDIUM RISK)

**Goal**: Setup Zustand store alongside existing state (parallel implementation).

**Steps**:
1. Install Zustand (if not already installed - check package.json)
2. Create `core/state/store.ts` with basic structure
3. Create `taskTreeSlice` for TaskTree state
4. Keep existing `taskTreeRef` temporarily (parallel implementation)
5. Test that both work together

**Risk**: MEDIUM - New state management, but keeping old one
**Time**: 3-4 hours
**Verification**: Both old and new state work, no regressions

---

### Phase 3: Migrate to Zustand (HIGH RISK - Requires Care)

**Goal**: Replace `taskTreeRef` with Zustand store.

**Steps**:
1. Migrate one hook at a time
2. Update `useUpdateSelectedNode` first (most critical)
3. Update `useNodeLoading` second
4. Update all other hooks that use `taskTreeRef`
5. Remove `taskTreeRef` completely
6. Test thoroughly after each migration

**Risk**: HIGH - Core state management change
**Time**: 6-8 hours
**Verification**: Extensive testing, no regressions

---

### Phase 4: Reduce index.tsx Complexity (MEDIUM RISK)

**Goal**: Reduce `index.tsx` from 463+ lines to <100 lines.

**Steps**:
1. Extract feature hooks (combine related hooks)
2. Extract layout components
3. Keep only orchestration logic in `index.tsx`
4. Test after each extraction

**Risk**: MEDIUM - Component structure changes
**Time**: 4-5 hours
**Verification**: UI unchanged, all functionality works

---

### Phase 5: Feature-Based Organization (LOW-MEDIUM RISK)

**Goal**: Reorganize into feature slices.

**Steps**:
1. Create `features/` directory structure
2. Move code to feature slices one at a time
3. Update imports using aliases
4. Test after each move

**Risk**: LOW-MEDIUM - File organization, but aliases make it safe
**Time**: 6-8 hours
**Verification**: All imports work, build succeeds

---

## Recommended Order

1. ✅ **Aliases** (DONE)
2. **Domain Logic Extraction** (NEXT - SAFEST)
3. **State Management Setup** (After domain logic)
4. **Migrate to Zustand** (After setup is stable)
5. **Reduce index.tsx** (After state is stable)
6. **Feature-Based Organization** (Final step)

---

## Safety Guidelines

- ✅ One step at a time
- ✅ Test after each change
- ✅ Commit after each successful step
- ✅ Rollback plan ready
- ✅ No breaking changes
- ✅ Maintain backward compatibility during transition

---

## Current Architecture Issues

1. **taskTreeRef** - Mutable ref used as state (anti-pattern)
2. **index.tsx** - Too large (463+ lines, 30+ hooks)
3. **State dispersion** - 20+ useState declarations
4. **Deep imports** - Up to 8 levels (now solved with aliases)
5. **Mixed responsibilities** - UI, business logic, persistence mixed

---

## Target Architecture

```
ResponseEditor/
├── core/
│   ├── domain/          # Pure functions (TaskTree, Node, Step operations)
│   ├── state/           # Zustand store (replaces taskTreeRef)
│   └── validation/     # Validation logic
├── features/            # Feature slices (node-editing, step-management, etc.)
├── ui/                  # Pure UI components
└── infrastructure/      # Persistence, sync, events
```

---

## Next Immediate Action

**Recommendation**: Start with **Domain Logic Extraction** (Phase 1)

**Why**:
- ✅ Zero risk (only moving pure functions)
- ✅ No state changes
- ✅ No component changes
- ✅ Prepares for future refactoring
- ✅ Improves code organization immediately

**First Step**: Create `core/domain/taskTree.ts` and move `getdataList`, `getSubDataList`

Vuoi che proceda con questo?
