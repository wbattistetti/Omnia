# Batch Testing Mode - Immutability Contract

## Contract Definition

**During batch testing, the following structural mutations are PROHIBITED:**

- Node structure updates (`updateSelectedNode`)
- Profile updates (`handleProfileUpdate`, `onChange`)
- Kind/synonyms/format/regex changes (`setKind`, `setSynonymsText`, `setFormatText`, `setRegex`)
- Any state updates that trigger re-renders of parent components

## Why This Contract Exists

This is **NOT** a cosmetic restriction - it prevents feedback loops:

```
onChange → handleProfileUpdate → updateSelectedNode → re-render → onChange → ...
```

The batch testing worker runs **PURE functions** that do **NOT** touch React state.
Only **AFTER** all tests complete, the UI is updated **ONCE** with all results.

## Protected Mutation Points

All mutation functions **MUST** check `getIsTesting()` and return early if `true`:

### 1. `updateSelectedNode` (index.tsx:783)
- **What it does**: Updates node structure, triggers re-renders, saves to dockTree
- **Protection**: ✅ Blocks if `getIsTesting() === true`
- **Impact**: Prevents structural mutations during batch

### 2. `handleProfileUpdate` (index.tsx:1025)
- **What it does**: Updates NLP profile, calls `updateSelectedNode`
- **Protection**: ✅ Blocks if `getIsTesting() === true`
- **Impact**: Prevents profile mutations during batch

### 3. `useProfileState.onChange` (useProfileState.ts:319)
- **What it does**: Emits `onChange` when profile changes
- **Protection**: ✅ Blocks if `getIsTesting() === true`
- **Impact**: Prevents `onChange` callbacks during batch

## Testing Mode Lifecycle

1. **Start**: `startTesting()` sets `isTesting = true`
2. **During**: All mutation functions check `getIsTesting()` and block
3. **End**: `stopTesting()` sets `isTesting = false`, UI updates once

## Adding New Mutation Points

If you add a new function that mutates node/profile/kind/synonyms/format/regex:

1. Add `import { getIsTesting } from '../testingState';`
2. Add guard at function start:
   ```typescript
   if (getIsTesting()) {
     console.log('[FunctionName] Blocked: batch testing active');
     return;
   }
   ```
3. Document in this file

## Verification

Check console logs during batch testing:
- ✅ Should see: `[updateSelectedNode] Blocked: batch testing active`
- ✅ Should see: `[handleProfileUpdate] Blocked: batch testing active`
- ❌ Should NOT see: `[NODE_SYNC][UPDATE]` during batch
- ❌ Should NOT see: `[KindChange][onChange]` during batch
