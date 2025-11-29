# Runtime Engine - Backend Runtime for Flow Orchestration

This directory contains the runtime engine components moved from the frontend:
- **Compiler**: Compiles flowchart + DDT into flat list of tasks
- **Orchestrator**: Executes tasks in sequence based on conditions
- **DDT Engine**: Handles data collection dialogs
- **Session**: Manages session state

## Structure

```
runtime/
├── compiler/          # FlowCompiler logic
├── orchestrator/      # DialogueEngine logic
├── ddt/              # DDT Engine logic
├── session/           # Session state management
└── types/            # Shared TypeScript types
```

## Usage

The runtime is exposed via Express endpoints in `backend/server.js` and can also be called from FastAPI.

