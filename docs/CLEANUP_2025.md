# Codebase Cleanup 2025

## Overview
This document tracks the cleanup process performed in branch `cleanup/codebase-2025`.

**Date Started:** 2025-01-XX
**Branch:** `cleanup/codebase-2025`
**Status:** In Progress

---

## FASE 0: Preparation ✅

### Directory Structure Created
- `docs/history/migrations/` - Historical migration documentation
- `docs/history/refactoring/` - Completed refactoring documentation
- `docs/history/analysis/` - Historical analysis reports
- `scripts/archive/analysis/` - Archived analysis scripts
- `scripts/archive/fix/` - Archived fix scripts
- `scripts/archive/cleanup/` - Archived cleanup scripts

---

## FASE 1: Safe Removals (100% Safe)

### Files Removed
- [ ] File temporanei root
- [ ] Directory legacy non referenziate
- [ ] Script migrazione completati

### Scripts Migration Removed
- [ ] `backend/migrations/step1_setup_collections.js`
- [ ] `backend/migrations/step2_copy_data.js`
- [ ] `backend/migrations/step2b_migrate_project_acts.js`
- [ ] `backend/migrations/step3_seed_builtins.js`
- [ ] `backend/migrations/step4_migrate_task_templates_to_enum.js`
- [ ] `backend/migrations/step5_add_ddt_patterns.js`
- [ ] `backend/migrations/migrate_tasks_unified_model.js`
- [ ] `backend/migrations/migrate_projects_tasks.js`
- [ ] `backend/migrations/migrate_endpoints_task_templates_to_tasks.js`
- [ ] `backend/migrations/migrate_to_hybrid_structure.js`
- [ ] `backend/migrations/migrate_steps_to_array.js`
- [ ] `backend/migrations/migrate_steps_to_root_level.js`
- [ ] `backend/migrations/migrate_taskId_to_id.js`
- [ ] `backend/migrations/migrate_nlpcontract_to_datacontract.js`
- [ ] `backend/migrations/migrate_to_allowed_contexts.js`
- [ ] `backend/migrations/migrate_date_tasks.js`
- [ ] `backend/migrations/complete_tasks_migration.js`
- [ ] `backend/migrations/identify_active_project_and_migrate.js`

### Temporary Files Removed
- [ ] `temp_cursor_content.txt`
- [ ] `temp_drag_content.txt`
- [ ] `CustomNode_clean.tsx`
- [ ] `CustomNode_fixed.tsx`
- [ ] `FlowEditor_fixed.tsx`
- [ ] `backend/groq_ddt_api.py.backup`

### Legacy Directories Removed
- [ ] `src/components/SidebarOLD/` (entire directory)

---

## FASE 2: Update Imports + Remove Deprecated Files

### Imports Updated
- [ ] `src/components/AppContent.tsx` - Update DDEBubbleChat import
- [ ] `src/components/TaskEditor/ResponseEditor/components/TaskPreviewPanel.tsx` - Update DDEBubbleChat import
- [ ] `src/components/TaskEditor/ResponseEditor/RightPanel.tsx` - Update DDEBubbleChat import
- [ ] `src/components/TaskEditor/ResponseEditor/ContractWizard/ContractWizard.tsx` - Update contractWizardOrchestrator import
- [ ] `src/components/TaskEditor/ResponseEditor/hooks/useRegexAIGeneration.ts` - Update semanticContractBuilder import
- [ ] `src/utils/wizard/generateContract.ts` - Update semanticContractBuilder import
- [ ] `src/utils/wizard/__tests__/generateContract.test.ts` - Update semanticContractBuilder import

### Deprecated Files Removed
- [ ] `src/components/ChatSimulator/DDEBubbleChat.tsx`
- [ ] `src/utils/contractWizardOrchestrator.ts`
- [ ] `src/utils/semanticContractBuilder.ts`

---

## FASE 3: Archive Analysis/Fix/Cleanup Scripts

### Scripts Archived to `scripts/archive/`
- [ ] Analysis scripts → `scripts/archive/analysis/`
- [ ] Fix scripts → `scripts/archive/fix/`
- [ ] Cleanup scripts → `scripts/archive/cleanup/`

---

## FASE 4: Archive Test Files

### Test Files Archived to `tests/archive/`
- [ ] Root test files → `tests/archive/examples/`
- [ ] Backend test files → `tests/archive/backend/`

---

## FASE 5: Move Historical Documentation

### Documentation Moved to `docs/history/`
- [ ] Migration docs → `docs/history/migrations/`
- [ ] Refactoring docs → `docs/history/refactoring/`
- [ ] Analysis reports → `docs/history/analysis/`

---

## FASE 6: Final Verifications

### Build & Lint
- [ ] `npm run build` - ✅ Pass
- [ ] `npm run lint` - ✅ Pass

### Tests
- [ ] `npm test` - ✅ Pass
- [ ] Test coverage maintained

### Import Checks
- [ ] No broken imports
- [ ] No orphaned files
- [ ] No deprecated imports

---

## Statistics

### Files Removed
- Total: ~140 files
- Code: ~5,000-10,000 lines

### Files Archived
- Scripts: ~50 files
- Tests: ~15 files
- Documentation: ~50 files

### Directories Removed
- `src/components/SidebarOLD/` (22 files)

---

## Rollback Instructions

If issues occur, rollback specific commits:

```bash
# Rollback FASE 1
git revert <commit-hash-fase1>

# Rollback FASE 2
git revert <commit-hash-fase2>

# Full rollback
git checkout main
git branch -D cleanup/codebase-2025
```

---

## Notes

- All removals are tracked in git history
- Archived files are preserved for reference
- Historical documentation is preserved in `docs/history/`
