# TaskTree Generation Pipeline - Documentation

Welcome to the TaskTree Generation Pipeline documentation. This system generates complete conversational AI parsers from natural language descriptions.

## Quick Start

1. **Read the Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)
2. **Understand the Layers**: [LAYER_DIAGRAM.md](./LAYER_DIAGRAM.md)
3. **Migrate from DDT**: [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)

## Documentation Index

### Core Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete architecture overview
  - Layer structure
  - Module documentation
  - Data flow diagrams
  - Future enhancements

- **[LAYER_DIAGRAM.md](./LAYER_DIAGRAM.md)** - Visual layer architecture
  - Layer interaction diagrams
  - Data flow visualization
  - Dependency graphs

- **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - Migration from DDT to TaskTree
  - Terminology mapping
  - Code changes
  - Import path updates
  - Common issues

### Planning Documents

- **[RENAME_DDT_TO_TASKTREE_PLAN.md](./RENAME_DDT_TO_TASKTREE_PLAN.md)** - Renaming plan
- **[TASK_TEMPLATES_V2_VERIFICATION.md](./TASK_TEMPLATES_V2_VERIFICATION.md)** - Template verification
- **[DDT_COLLECTION_IMPLEMENTATION.md](./DDT_COLLECTION_IMPLEMENTATION.md)** - Collection implementation

## Architecture Overview

The system follows a **7-Layer Architecture**:

1. **Orchestrator Layer** - Coordinates all generation steps
2. **Contract Layer** - Builds semantic contracts
3. **Constraint Layer** - Generates validation constraints
4. **Engine Layer** - Generates recognition engines
5. **Escalation Layer** - Generates escalation strategies
6. **Test Layer** - Generates test examples
7. **Messaging Layer** - Generates user-facing messages

## Key Principles

- **Single Responsibility**: Each module has one clear purpose
- **Pure Functions**: Generation logic is side-effect free
- **Layered Separation**: Clear boundaries between layers
- **Orchestrator Pattern**: Single point of coordination
- **Testability**: All layers are unit-testable

## Module Structure

```
src/utils/
├── wizard/              # Generation pipeline
│   ├── analyzeTree.ts
│   ├── proposeEngines.ts
│   ├── buildGenerationPlan.ts
│   ├── generateContract.ts
│   ├── generateEngines.ts
│   ├── generateTestExamples.ts
│   ├── executeGenerationPlan.ts
│   └── types.ts
│
└── contract/            # Contract building
    ├── readEntityProperties.ts
    ├── readSubgroupProperties.ts
    ├── buildSubgroups.ts
    └── buildEntity.ts
```

## Getting Started

### For Developers

1. Read [ARCHITECTURE.md](./ARCHITECTURE.md) to understand the system
2. Check [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) if migrating from DDT
3. Review code comments in critical files
4. Run tests: `npm test`

### For Architects

1. Review [LAYER_DIAGRAM.md](./LAYER_DIAGRAM.md) for visual architecture
2. Understand layer boundaries and responsibilities
3. Review future enhancements section

### For Migrators

1. Start with [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)
2. Follow the migration checklist
3. Use backward compatibility features during transition

## Terminology

| Term | Description |
|------|-------------|
| **TaskTree** | Runtime view built from Template + Instance |
| **TaskTemplate** | Persisted template structure |
| **SemanticContract** | Contract defining data structure and constraints |
| **Engine** | Recognition engine (regex, NER, LLM, heuristic) |
| **Orchestrator** | Coordinates all generation steps |

## Testing

All modules have comprehensive unit tests:

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- wizard
npm test -- contract
```

## Contributing

When contributing:

1. **Follow Layer Boundaries**: Don't mix layer responsibilities
2. **Write Tests**: All new functions must have tests
3. **Update Documentation**: Keep docs in sync with code
4. **Maintain Backward Compatibility**: Use deprecation warnings

## Support

For questions or issues:

1. Check relevant documentation
2. Review code comments
3. Check test files for usage examples
4. Open an issue with appropriate tags

## Status

**Current Version**: Post-Refactoring (7-Layer Architecture)

- ✅ Architecture refactored
- ✅ Modules separated
- ✅ Tests comprehensive
- ✅ Documentation complete
- ⏳ Future enhancements planned

---

**Last Updated**: 2025-01-27
**Architecture Version**: 2.0 (7-Layer)
