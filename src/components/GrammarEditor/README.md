# Grammar Editor

Visual editor for building grammar graphs with semantic bindings. The editor exports the graph directly in JSON format for the VB.NET runtime to interpret.

## Architecture

The editor follows a clean, modular architecture:

```
GrammarEditor/
├── core/
│   ├── domain/          # Pure functions (no side effects)
│   └── state/           # Zustand store (state management)
├── features/             # Isolated features (no cross-imports)
├── hooks/                # Composed hooks
├── components/           # UI components
├── types/                # TypeScript types
└── utils/                # Shared utilities
```

## Key Features

- **Visual Graph Editor**: Create nodes and edges using ReactFlow
- **Node Creation**: Double-click canvas or press ENTER on a node
- **Semantic Binding**: Drag & drop semantic values/sets onto nodes
- **Export**: Direct graph export to JSON (no transformations)
- **Validation**: Real-time grammar validation

## Usage

```tsx
import { GrammarEditor } from './components/GrammarEditor';

function MyComponent() {
  const handleSave = (grammar: Grammar) => {
    // Save grammar to backend
    console.log('Grammar exported:', grammar);
  };

  return (
    <GrammarEditor
      initialGrammar={myGrammar}
      onSave={handleSave}
      onClose={() => console.log('Editor closed')}
      slots={availableSlots}
      semanticSets={availableSets}
    />
  );
}
```

## Export Format

The editor exports the grammar graph directly without transformations:

```json
{
  "id": "grammar-id",
  "name": "Grammar Name",
  "nodes": [...],
  "edges": [...],
  "slots": [...],
  "semanticSets": [...],
  "metadata": {...}
}
```

The VB.NET runtime reads this format directly and interprets the graph.

## Core Domain

All domain functions are pure (no side effects):

- `createGrammar()` - Creates new grammar
- `addNodeToGrammar()` - Adds node to grammar
- `bindSemanticValue()` - Binds semantic value to node
- `exportGrammar()` - Exports grammar as-is

## State Management

Uses Zustand for centralized state:

```tsx
const { grammar, addNode, updateNode } = useGrammarStore();
```

## Features

### Node Creation
- Double-click canvas → creates node
- ENTER on node → creates next node to the right

### Node Editing
- Edit label, synonyms, regex
- Bind semantic values/sets
- Set optional/repeatable flags

### Semantic Binding
- Drag semantic value → node (binds value)
- Drag semantic set → node (binds set)
- Select slot for output

### Graph Layout
- Horizontal layout
- Hierarchical layout (topological sort)

### Export
- Export to JSON
- Download JSON file
- Copy to clipboard

## Components

- `GrammarCanvas` - Main ReactFlow canvas
- `GrammarNode` - Custom node component
- `GrammarEdge` - Custom edge component
- `SemanticPanel` - Sidebar for slots and sets
- `GrammarToolbar` - Top toolbar with export buttons

## Hooks

- `useGrammarCanvas` - ReactFlow integration
- `useNodeInteractions` - Node click/drag handlers
- `useEdgeInteractions` - Edge click/delete handlers
- `useSemanticPanel` - Semantic panel management
- `useGrammarValidation` - Validation logic

## Notes

- The editor does NOT generate regex or NLPEngine
- The editor does NOT transform the graph
- The VB.NET runtime interprets the graph directly
- All domain functions are pure and testable
