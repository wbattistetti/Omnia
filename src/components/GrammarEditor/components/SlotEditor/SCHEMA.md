# Slot Editor - Component Schema

## 📋 Overview

Modular, maintainable Slot Editor with hierarchical tree structure, undo/redo, validation, and alphabetical sorting.

## 🏗️ Architecture

### Directory Structure

```
src/components/GrammarEditor/
├── components/
│   └── SlotEditor/
│       ├── SlotEditor.tsx                    # Main orchestrator
│       ├── SlotTree.tsx                      # Tree renderer
│       ├── SlotTreeNode.tsx                  # Generic tree node (reusable)
│       ├── AddNode.tsx                       # "..." add node (reusable)
│       ├── EditingNode.tsx                   # Inline editing input
│       ├── SlotNode.tsx                       # Slot-specific node
│       ├── SemanticSetNode.tsx              # Semantic Set node
│       ├── SemanticValueNode.tsx            # Semantic Value node
│       ├── LinguisticValueNode.tsx          # Linguistic Value node
│       └── styles.ts                         # Centralized styles
│
├── hooks/
│   └── SlotEditor/
│       ├── useSlotEditor.ts                  # Main hook (orchestrator)
│       ├── useSlotTree.ts                    # Tree state (expand/collapse, selection)
│       ├── useAddNode.ts                     # Add node editing state
│       ├── useSlotEditorActions.ts           # CRUD actions with validation
│       └── useUndoRedo.ts                    # Undo/Redo stack management
│
├── core/
│   └── domain/
│       └── slotEditor.ts                     # Pure functions (validation, normalization, tree building)
│
└── types/
    └── slotEditorTypes.ts                    # TypeScript types
```

## 🎯 Component Responsibilities

### 1. SlotEditor.tsx
- **Responsibility**: Main orchestrator
- **Props**: `editorMode: 'text' | 'graph'`
- **Features**:
  - Collapsible panel
  - Theme management (text/graph mode)
  - Keyboard shortcuts (Ctrl+Z, Ctrl+Y)
  - Composes all sub-components

### 2. SlotTree.tsx
- **Responsibility**: Tree rendering
- **Features**:
  - Renders sections: "Slots", "Semantic Sets"
  - Manages tree structure
  - Passes data to nodes

### 3. SlotTreeNode.tsx (Reusable)
- **Responsibility**: Base node rendering
- **Props**:
  ```typescript
  {
    icon: ReactNode;
    label: string;
    isExpanded: boolean;
    hasChildren: boolean;
    onToggle: () => void;
    onSelect: () => void;
    isSelected: boolean;
    children?: ReactNode;
    level: number;
  }
  ```

### 4. AddNode.tsx (Reusable)
- **Responsibility**: "..." add node
- **Props**:
  ```typescript
  {
    placeholder: string;
    onAdd: (name: string) => void;
    level: number;
  }
  ```
- **Behavior**:
  - Click → enters editing (EditingNode)
  - ENTER → calls `onAdd(name)` → recreates AddNode
  - ESC → cancels, returns to "..."

### 5. EditingNode.tsx (Reusable)
- **Responsibility**: Inline editing input
- **Props**:
  ```typescript
  {
    initialValue: string;
    placeholder: string;
    onSave: (value: string) => void;
    onCancel: () => void;
    autoFocus: boolean;
    validation?: ValidationResult;
    suggestions?: SynonymSuggestion[];
  }
  ```
- **Behavior**:
  - Auto-focus on mount
  - ENTER → `onSave(value)`
  - ESC → `onCancel()`
  - Shows validation errors/warnings
  - Shows synonym suggestions

### 6-9. Specific Node Components
- **SlotNode.tsx**: Slot rendering (green → icon)
- **SemanticSetNode.tsx**: Set rendering (pencil icon, shows count)
- **SemanticValueNode.tsx**: Value rendering (red pencil icon)
- **LinguisticValueNode.tsx**: Synonym rendering (green speech bubble)

## 🔧 Hooks

### useSlotEditor.ts
- **Responsibility**: Main orchestrator hook
- **Returns**:
  - `tree: TreeNode[]` (alphabetically sorted)
  - `slots`, `semanticSets`
  - `theme` (colors based on editor mode)
  - All CRUD actions
  - Undo/Redo functions

### useSlotTree.ts
- **Responsibility**: Tree state management
- **State**:
  - `expanded: Set<string>` (expanded node IDs)
  - `selected: string | null` (selected node ID)
- **Functions**:
  - `toggleExpanded(id)`
  - `setSelected(id)`
  - `expandAll()`
  - `collapseAll()`

### useAddNode.ts
- **Responsibility**: Add node editing state
- **State**:
  - `isEditing: boolean`
  - `editValue: string`
- **Functions**:
  - `startEditing()`
  - `save(value: string)`
  - `cancel()`

### useSlotEditorActions.ts
- **Responsibility**: CRUD operations with validation
- **Functions**:
  - `createSlot(name, type)` → validates, normalizes, records undo
  - `updateSlotName(id, newName)` → validates, normalizes, records undo
  - `removeSlot(id)` → records undo
  - `createSemanticSet(name)` → validates, normalizes, records undo
  - `updateSemanticSetName(id, newName)` → validates, normalizes, records undo
  - `removeSemanticSet(id)` → records undo
  - `addSemanticValue(setId, value)` → validates, normalizes, records undo
  - `addLinguisticValue(setId, valueId, synonym)` → validates, normalizes, records undo

### useUndoRedo.ts
- **Responsibility**: Undo/Redo stack management
- **State**:
  - `undoStack: Operation[]` (max 50)
  - `redoStack: Operation[]`
- **Functions**:
  - `recordOperation(op)` → adds to undo stack, clears redo
  - `undo()` → pops from undo, pushes to redo
  - `redo()` → pops from redo, pushes to undo
  - `clear()` → clears both stacks
- **Properties**:
  - `canUndo: boolean`
  - `canRedo: boolean`

## 🧪 Domain Functions (slotEditor.ts)

### Validation
- `validateSlotName(name, existingSlots, excludeId?)` → `ValidationResult`
- `validateSemanticSetName(name, existingSets, excludeId?)` → `ValidationResult`
- `validateSemanticValue(value, existingValues, excludeId?)` → `ValidationResult`
- `validateLinguisticValue(synonym, existingSynonyms, excludeIndex?)` → `ValidationResult`

### Normalization
- `normalizeInput(input)` → trimmed, lowercase, no accents
- `normalizeForComparison(input)` → aggressive normalization for duplicate detection

### Suggestions
- `suggestSynonyms(value, existingValues, maxSuggestions?)` → `SynonymSuggestion[]`
  - Pattern-based (remove "the", dots, etc.)
  - Similarity-based (Levenshtein distance)

### Tree Building
- `buildTreeStructure(slots, semanticSets)` → `TreeNode[]`
  - Alphabetically sorts all levels
  - Creates hierarchical structure

### Utilities
- `findNodeById(tree, id)` → `TreeNode | null`

## 📊 Data Flow

```
SlotEditor
  └─> useSlotEditor
      ├─> useUndoRedo (undo/redo stack)
      ├─> useSlotEditorActions (CRUD with validation)
      └─> buildTreeStructure (alphabetically sorted)
          └─> SlotTree
              └─> useSlotTree (expand/collapse, selection)
                  └─> SlotNode / SemanticSetNode / SemanticValueNode / LinguisticValueNode
                      └─> SlotTreeNode (base rendering)
                          └─> AddNode (when needed)
                              └─> useAddNode (editing state)
                                  └─> EditingNode (input with validation/suggestions)
```

## ✅ Features

### ✅ Undo/Redo
- Simple operation stack (max 50 operations)
- Records all CRUD operations
- Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Y (redo)

### ✅ Validation
- **Duplicate detection**: Case-insensitive, normalized comparison
- **Format validation**: Slot names must be alphanumeric with underscores
- **Empty validation**: All fields must be non-empty
- **Length validation**: Slot names 2-50 characters

### ✅ Normalization
- **Input normalization**: Trim, lowercase, remove accents
- **Comparison normalization**: Remove punctuation, normalize whitespace
- Applied automatically to all inputs

### ✅ Synonym Suggestions
- **Pattern-based**: Remove "the", dots, etc.
- **Similarity-based**: Levenshtein distance > 0.6
- Shown in EditingNode when adding linguistic values

### ✅ Alphabetical Sorting
- **Slots**: Sorted alphabetically
- **Semantic Sets**: Sorted alphabetically
- **Semantic Values**: Sorted alphabetically within each set
- **Linguistic Values**: Sorted alphabetically within each value
- Uses `localeCompare` with `sensitivity: 'base'` for case-insensitive sorting

## 🎨 Styling

- **Theme support**: Text mode (light) and Graph mode (dark)
- **Centralized styles**: `styles.ts` exports reusable style objects
- **Responsive**: Adapts to panel width

## 🔑 Key Principles

1. **Single Responsibility**: Each component/hook has one clear purpose
2. **Reusability**: Generic components (SlotTreeNode, AddNode, EditingNode)
3. **Maintainability**: Logic separated from presentation
4. **Testability**: Pure functions in domain layer
5. **Scalability**: Easy to add new node types or features
