# Testing Strategy for Response Editor Refactoring

## Overview

This document describes the comprehensive testing strategy implemented to prevent regressions during the Response Editor refactoring.

## Test Structure

### 1. Unit Tests

**Location**: `tests/unit/`

- **`TaskRepository.refactored.test.ts`**: Tests for TaskRepository with new merge behavior
- **`buildTaskTree.refactored.test.ts`**: Tests for buildTaskTree cloning logic

**Run**:
```bash
npm run test:refactoring
```

### 2. Integration Tests

**Location**: `tests/integration/`

- **`ResponseEditor.integration.test.ts`**: Complete flows for step deletion, prompt editing, persistence

**Run**:
```bash
npm test -- tests/integration
```

### 3. Regression Tests

**Location**: `tests/regression/`

- **`ResponseEditorRegression.test.ts`**: Comprehensive test suite covering all critical features

**Run**:
```bash
npm test -- tests/regression
```

### 4. E2E Tests

**Location**: `tests/e2e/`

- **`step-management.e2e.test.ts`**: End-to-end user flows for step management

**Run**:
```bash
npm run test:e2e
```

## Feature Flags

**Location**: `src/config/featureFlags.ts`

Feature flags allow gradual migration and safe rollback:

- `USE_DIRECT_TASK_UPDATES`: Use direct updates instead of deep merge
- `DISABLE_MERGE_PROFONDO`: Disable deep merge behavior
- `USE_SIMPLIFIED_BUILD_TASK_TREE`: Use simplified buildTaskTree logic
- `VALIDATE_REFACTORING`: Run old and new code in parallel for comparison

**Set via environment variables or localStorage**:
```bash
FEATURE_USE_DIRECT_TASK_UPDATES=true npm test
```

Or in browser console:
```javascript
localStorage.setItem('featureFlag_USE_DIRECT_TASK_UPDATES', 'true');
location.reload();
```

## Validation Script

**Location**: `scripts/validate-refactoring.ts`

Comprehensive validation script that runs all tests and generates a report.

**Run**:
```bash
npm run validate:refactoring
```

## Manual Checklist

**Location**: `tests/checklist/ResponseEditorChecklist.md`

Complete manual validation checklist covering:
- Step management (activation, deletion, restoration)
- Prompt editing
- Data extraction
- Chat simulator
- Persistence
- Performance

## Test Commands

```bash
# Run all refactoring tests
npm run test:refactoring

# Run E2E tests
npm run test:e2e

# Run full validation
npm run validate:refactoring

# Run specific test file
npm test -- tests/unit/TaskRepository.refactored.test.ts
```

## Pre-Refactoring Baseline

Before starting refactoring:

1. ✅ Take screenshots of all Response Editor views
2. ✅ Export JSON of complex projects
3. ✅ Record video of complete editing flows
4. ✅ Run all tests and save results

## Post-Refactoring Validation

After refactoring:

1. ✅ Run all automatic tests
2. ✅ Complete manual checklist
3. ✅ Compare screenshots (visual regression)
4. ✅ Verify performance metrics
5. ✅ Test with real project data

## Rollback Plan

If issues are found:

1. **Feature Flag OFF**: Disable new code via feature flags
2. **Git Revert**: Revert to last stable commit
3. **Database Restore**: Restore from backup if needed

## Continuous Validation

During refactoring:

- Run tests after each phase
- Use feature flags to gradually enable new code
- Compare old vs new code results (when `VALIDATE_REFACTORING` is enabled)

## Success Criteria

All tests must pass:
- ✅ Unit tests: 100% pass
- ✅ Integration tests: 100% pass
- ✅ Regression tests: 100% pass
- ✅ E2E tests: 100% pass
- ✅ Manual checklist: All items verified
- ✅ Performance: No degradation
- ✅ Visual: No UI regressions
