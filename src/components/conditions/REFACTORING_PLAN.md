# ConditionEditor.tsx Refactoring Plan

## Overview
Refactoring of `ConditionEditor.tsx` (1,343 lines) following Clean Architecture principles, similar to the successful NodeRow.tsx refactoring.

## Current State Analysis

### File Size
- **Current:** 1,343 lines
- **Target:** <400 lines (70% reduction)
- **Goal:** Modular, testable, maintainable architecture

### Main Responsibilities Identified

1. **State Management** (~200 lines)
   - 30+ useState hooks for UI state
   - Title editing, panel visibility, busy states
   - Variables selection, tester state

2. **AI Operations** (~300 lines)
   - `generate()` - Generate condition from NL
   - `modify()` - Normalize pseudo-code
   - `repairCondition()` - Fix failed tests
   - `suggestConditionCases()` - Generate test cases

3. **Variables Management** (~250 lines)
   - Intellisense menu with hierarchical tree
   - Variable filtering and navigation
   - Duplicate variable preference handling
   - Variable token insertion

4. **Script Management** (~150 lines)
   - Script state and updates
   - GUID ↔ Label conversion
   - Project data persistence
   - Monaco editor integration

5. **Tester Coordination** (~150 lines)
   - Test rows management
   - Failure detection and repair
   - Test case suggestions
   - Visual state management

6. **UI Layout & Resizing** (~100 lines)
   - Panel resizing (height, width)
   - Splitter handlers
   - Font size control (Ctrl+Wheel)

7. **Rendering** (~200 lines)
   - Header with editable title
   - Code panel with toolbar
   - Variables panel
   - Tester panel
   - Intellisense menu

## Refactoring Strategy

### FASE 1: Domain Layer (Pure Functions)
**Target:** Extract pure business logic functions

#### 1.1 Variables Domain
- `variablesDomain.ts`
  - `listKeys(vars: VarsMap): string[]`
  - `flattenVariablesTree(tree: VarsTreeAct[]): string[]`
  - `filterVariablesTree(tree: VarsTreeAct[], query: string): VarsTreeAct[]`
  - `findDuplicateGroups(variables: string[]): Array<{ tail: string; options: string[] }>`
  - `extractUsedVariables(script: string): string[]` (robust multi-source detection)

#### 1.2 Script Domain
- `scriptDomain.ts`
  - `normalizeCode(txt: string): string`
  - `parseTemplate(txt: string): { label?: string; when?: string; vars?: string[] }`
  - `synthesizeDateVariables(vars: Record<string, any>, usedVars: string[]): Record<string, any>`

#### 1.3 Conversion Domain
- `conversionDomain.ts`
  - Uses existing `convertScriptGuidsToLabels`, `convertScriptLabelsToGuids`
  - Add validation functions

### FASE 2: Application Layer (Services)
**Target:** Extract business logic services

#### 2.1 ConditionAIService
- `ConditionAIService.ts`
  - `generateCondition(nl: string, variables: string[], label: string): Promise<{ script: string; label?: string }>`
  - `normalizePseudoCode(pseudo: string, currentCode: string, variables: string[], label: string): Promise<{ script: string }>`
  - `repairCondition(script: string, failures: any[], variables: string[]): Promise<{ script: string }>`
  - `suggestTestCases(nl: string, variables: string[]): Promise<{ trueCase?: any; falseCase?: any; hints?: any }>`

#### 2.2 ScriptManagerService
- `ScriptManagerService.ts`
  - `saveScript(script: string, label: string, projectData: any, pdUpdate: any): void`
  - `loadScript(label: string, projectData: any): string | null`
  - `convertForDisplay(script: string): string` (GUID → Label)
  - `convertForSave(script: string): string` (Label → GUID)

#### 2.3 VariablesIntellisenseService
- `VariablesIntellisenseService.ts`
  - `buildNavigationEntries(tree: VarsTreeAct[], expandedActs: Record<string, boolean>, expandedMains: Record<string, boolean>, filter: string): { entries: NavEntry[]; indexByKey: Map<string, number> }`
  - `insertVariableToken(varKey: string, target: HTMLElement, field: 'nl' | 'script', currentScript: string, caret: { start: number; end: number }): { newScript: string; newCaret: { start: number; end: number } }`

### FASE 3: Infrastructure Layer
**Target:** External dependencies and integrations

#### 3.1 Monaco Integration
- `monacoIntegration.ts`
  - `setupMonacoMarkers(editor: any, monaco: any, markers: any[], source: string): void`
  - `clearMonacoMarkers(editor: any, monaco: any, source: string): void`

### FASE 4: Custom Hooks
**Target:** Extract React hooks for state and effects

#### 4.1 useConditionEditorState
- `useConditionEditorState.ts`
  - Manages all UI state (showCode, showTester, busy, etc.)
  - Title editing state
  - Panel visibility state

#### 4.2 useVariablesIntellisense
- `useVariablesIntellisense.ts`
  - Variables menu state
  - Navigation and filtering
  - Token insertion logic

#### 4.3 useScriptManagement
- `useScriptManagement.ts`
  - Script state
  - Script updates and persistence
  - Conversion between GUID and Label

#### 4.4 useConditionTester
- `useConditionTester.ts`
  - Test rows state
  - Tester coordination
  - Failure detection

#### 4.5 usePanelResizing
- `usePanelResizing.ts`
  - Height resizing
  - Panel width resizing (Variables, Tester)
  - Font size control (Ctrl+Wheel)

### FASE 5: Presentation Layer
**Target:** Extract UI components

#### 5.1 ConditionEditorHeader
- `ConditionEditorHeader.tsx`
  - Editable title
  - Close button
  - Hover effects

#### 5.2 ConditionEditorToolbar
- `ConditionEditorToolbar.tsx`
  - Generate/Modify/Fix button
  - Variables toggle
  - Test Code toggle

#### 5.3 VariablesIntellisenseMenu
- `VariablesIntellisenseMenu.tsx`
  - Filter input
  - Hierarchical tree display
  - Navigation and selection

## File Structure (After Refactoring)

```
src/components/conditions/
├── ConditionEditor.tsx              # Main component (~350 lines)
├── domain/
│   ├── variablesDomain.ts           # Pure functions for variables
│   ├── scriptDomain.ts              # Pure functions for script parsing
│   └── conversionDomain.ts          # Conversion utilities
├── application/
│   ├── ConditionAIService.ts        # AI operations
│   ├── ScriptManagerService.ts      # Script persistence
│   └── VariablesIntellisenseService.ts  # Intellisense logic
├── infrastructure/
│   └── monacoIntegration.ts         # Monaco editor integration
├── hooks/
│   ├── useConditionEditorState.ts   # Main state hook
│   ├── useVariablesIntellisense.ts  # Variables menu hook
│   ├── useScriptManagement.ts       # Script management hook
│   ├── useConditionTester.ts        # Tester coordination hook
│   └── usePanelResizing.ts          # Panel resizing hook
├── presentation/
│   ├── ConditionEditorHeader.tsx    # Header component
│   ├── ConditionEditorToolbar.tsx   # Toolbar component
│   └── VariablesIntellisenseMenu.tsx  # Intellisense menu component
├── ConditionTester.tsx              # Existing (no changes)
├── VariablesPanel.tsx               # Existing (no changes)
└── REFACTORING_PLAN.md              # This file
```

## Metrics

### Size Reduction Target
- **Before:** 1,343 lines
- **After:** ~350 lines (main component)
- **Reduction:** ~993 lines (-74%)

### Services & Hooks Created
- **Domain Functions:** ~200 lines (3 files)
- **Application Services:** ~400 lines (3 services)
- **Infrastructure:** ~50 lines (1 file)
- **Custom Hooks:** ~600 lines (5 hooks)
- **Presentation Components:** ~300 lines (3 components)
- **Total Extracted:** ~1,550 lines (well-organized, testable)

## Benefits

1. **Separation of Concerns:** Business logic separated from UI
2. **Testability:** Services and hooks can be unit tested independently
3. **Maintainability:** Smaller, focused files are easier to understand
4. **Reusability:** Services and hooks can be reused in other components
5. **Code Quality:** Reduced complexity, improved readability

## Implementation Order

1. ✅ FASE 1: Domain Layer (pure functions)
2. ✅ FASE 2: Application Layer (services)
3. ✅ FASE 3: Infrastructure Layer
4. ✅ FASE 4: Custom Hooks
5. ✅ FASE 5: Presentation Components
6. ✅ Integration & Testing

## Notes

- Follow the same patterns used in NodeRow.tsx refactoring
- Use path aliases (`@types`, `@services`, `@utils`, `@components`)
- Create unit tests for each extracted service/hook
- Maintain backward compatibility during refactoring
- Update imports to use aliases throughout
