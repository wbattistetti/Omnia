# DDT Collection Implementation - Documentation

## Overview

This document describes the implementation of explicit Collection support in the DDT (Dialogue Data Template) model, along with the `templateId` + `referenceId` normalization for subData nodes.

## Key Changes

### 1. Task Semantics Deduction

The system now explicitly deduces task semantics from the structure:
- **Atomic**: `mainData.length === 1` + no `subData`
- **CompositeData**: `mainData.length === 1` + `subData` present
- **Collection**: `mainData.length > 1` + no `subData` in any mainData

**File**: `src/utils/taskSemantics.ts`

**Functions**:
- `getTaskSemantics(ddt)`: Deduces semantics from structure
- `validateTaskStructure(ddt)`: Validates structure rules (max 2 levels, Collection constraints)

### 2. subData Normalization (Design-time)

Every `subData` node now includes:
- `templateId`: GUID of the referenced task template
- `referenceId`: `dataId` of the `mainData[0]` from the referenced template

**Files Modified**:
- `src/utils/ddtMergeUtils.ts` - `buildMainDataFromTemplate()`
- `src/components/TaskEditor/ResponseEditor/hooks/helpers/templateBuilders.ts` - `createSubDataInstance()`

**Rules**:
- ✅ Design-time: `referenceId` is read from template (`template.mainData[0].id`)
- ✅ Runtime: `referenceId` is read from instance (not recalculated from template)
- ❌ Never recalculate `referenceId` from template at runtime

### 3. Structure Validation

**File**: `src/components/TaskEditor/ResponseEditor/index.tsx`

**Validations**:
- Maximum 2 levels of depth (mainData → subData, no sub-subData)
- Collection cannot have `subData` in any `mainData[i]`

**Behavior**:
- Invalid structures show error alerts
- Invalid structures are not saved

### 4. Runtime: Collection Support

#### 4.1 Saturation (`isSaturated`)

**Files Modified**:
- `src/components/DialogueEngine/ddt/ddtEngine.ts` - `findMissingRequiredSubs()`, `isMainDataSaturated()`
- `backend/runtime/ddt/ddtEngine.ts` - Same functions

**Behavior**:
- **Atomic**: Check if `mainData[0]` has value
- **CompositeData**: Check if all `subData` are saturated
- **Collection**: Check if all `mainData[]` are saturated (each independent)

#### 4.2 Navigation (`getNextData`)

**Files Modified**:
- `src/components/DialogueEngine/ddt/ddtEngine.ts` - `getNextData()`
- `backend/runtime/ddt/ddtEngine.ts` - `getNextData()`

**Behavior**:
- **Atomic**: Return `mainData[0]` if empty
- **CompositeData**: Return first empty `subData`, then `mainData[0]` if all subs filled
- **Collection**: Iterate over all `mainData[]`, return first empty one

#### 4.3 Value Composition (`compositeMainValue`)

**Files Modified**:
- `src/components/DialogueEngine/ddt/ddtComposition.ts` - `compositeMainValue()`
- `src/components/DialogueEngine/ddt/ddtNavigator.ts` - Updated call site

**Behavior**:
- **Atomic**: Return direct value from `memory[referenceId]`
- **CompositeData**: Compose object `{ subId: value }` from all `subData`
- **Collection**: Return array of independent values `[value1, value2, ...]` (no composition)

### 5. Memory Management with referenceId

**Files Modified**:
- `src/components/DialogueEngine/ddt/ddtEngine.ts` - All memory access functions
- `src/components/DialogueEngine/ddt/ddtNavigator.ts` - Memory updates
- `backend/runtime/ddt/ddtEngine.ts` - All memory access functions

**Rules**:
- ✅ Runtime: Always use `referenceId` from instance (not recalculated)
- ✅ Memory keys: `memory[referenceId]` (not `memory[id]`)
- ✅ Instance is autonomous: once created, doesn't depend on template

**Pattern**:
```typescript
// ✅ Correct: Use referenceId from instance
const dataId = node.referenceId || node.id;
const value = state.memory[dataId]?.value;
```

### 6. Step Cloning

**File**: `src/utils/ddtMergeUtils.ts` - `buildMainDataFromTemplate()`

**Rules**:
- ✅ Steps are cloned with new GUIDs
- ✅ `dataId` in steps remains unchanged (reference to data node)
- ✅ `templateId` in subData remains unchanged (reference to template)
- ✅ For Collection: Clone steps of all referenced tasks
- ✅ For CompositeData: Clone steps recursively for all subData

## Architecture Principles

### Design-time vs Runtime

**Design-time (Instance Creation)**:
- Read `referenceId` from template: `template.mainData[0].id`
- Write `referenceId` to instance: `instance.subData[i].referenceId = template.mainData[0].id`
- Clone steps with new GUIDs
- Save instance to database

**Runtime (Execution)**:
- Read `referenceId` from instance: `instance.subData[i].referenceId`
- Use `referenceId` for memory access: `memory[referenceId]`
- Never recalculate from template
- Instance is autonomous

### Why referenceId is not recalculated at runtime

1. **Template may change**: If template structure changes, recalculating would break existing instances
2. **Instance autonomy**: Once created, instance should work independently
3. **Memory consistency**: Memory keys must remain stable
4. **Performance**: No need to dereference template at runtime

## Testing Checklist

### Design-time
- [ ] Validation: Error for > 2 levels
- [ ] Validation: Error for Collection with subData
- [ ] subData have `templateId` and `referenceId`
- [ ] `referenceId` matches `template.mainData[0].id`

### Runtime - Atomic
- [ ] Value saved in `memory[referenceId]`
- [ ] Saturation works
- [ ] Value composition works

### Runtime - CompositeData
- [ ] Each subData uses `referenceId`
- [ ] Saturation checks all subData
- [ ] Composed value is object with `referenceId` as keys
- [ ] Navigation between subData works

### Runtime - Collection
- [ ] Navigation iterates over all `mainData[]`
- [ ] Each mainData uses `referenceId`
- [ ] Saturation checks all `mainData[]`
- [ ] Composed value is array (not object)

### Runtime - referenceId
- [ ] `referenceId` read from instance (not recalculated)
- [ ] Task works even if template changes

## Files Modified

### New Files
- `src/utils/taskSemantics.ts` - Semantics helper

### Modified Files (Design-time)
- `src/components/TaskEditor/ResponseEditor/index.tsx` - Structure validation
- `src/utils/ddtMergeUtils.ts` - subData normalization
- `src/components/TaskEditor/ResponseEditor/hooks/helpers/templateBuilders.ts` - subData normalization

### Modified Files (Runtime - Frontend)
- `src/components/DialogueEngine/ddt/ddtEngine.ts` - Collection support, referenceId usage
- `src/components/DialogueEngine/ddt/ddtComposition.ts` - Collection value composition
- `src/components/DialogueEngine/ddt/ddtNavigator.ts` - referenceId usage
- `src/components/DialogueDataEngine/state.ts` - (No changes needed, already works)

### Modified Files (Runtime - Backend)
- `backend/runtime/ddt/ddtEngine.ts` - Collection support, referenceId usage

## Migration Notes

- ✅ **No database migration needed**: Works with existing data
- ✅ **Backward compatible**: Existing tasks continue to work
- ✅ **Gradual adoption**: New features work when structure supports them

## Next Steps

1. **Fase 1.3**: Promozione a template con deduzione semantica (requires tree editing)
2. **Fase 3**: Comprehensive testing
3. **Fase 4**: Complete documentation

## Known Limitations

- Tree editing in Response Editor not yet implemented (required for Fase 1.3)
- Full Collection testing requires tree editing capability
- Promozione a template requires tree editing capability
