# DDT Intelligence Module

Modular, clean architecture for template intelligence and AI-powered template analysis.

## Architecture

This module provides a clean separation of concerns with the following components:

```
ddt-intelligence/
├── TemplateAnalysisConfig.js      # Configuration & validation
├── TemplateEmbeddingService.js    # Semantic similarity search
├── TemplatePromptBuilder.js       # Optimized prompt construction
├── TemplateResponseParser.js      # Response parsing & validation
├── TemplateIntelligenceOrchestrator.js  # Main orchestrator
└── index.js                       # Public exports
```

## Components

### 1. TemplateAnalysisConfig
- Provider/model validation
- Configuration constants
- Error message enhancement

### 2. TemplateEmbeddingService
- Pre-computes embeddings for all templates
- Finds top-K similar templates via cosine similarity
- **Integrated**: Uses Python FastAPI service (`intent_embeddings.py`) via `/api/embeddings/compute` endpoint

### 3. TemplatePromptBuilder
- Builds optimized prompts with only candidate templates (not all 53)
- Reduces prompt size by ~90% (from 259k to ~25k characters)
- Includes clear instructions and response format

### 4. TemplateResponseParser
- Parses JSON response from AI
- Validates response structure
- Normalizes response format

### 5. TemplateIntelligenceOrchestrator
- Main orchestrator that coordinates all components
- Implements RAG (Retrieval-Augmented Generation) pattern:
  1. **Retrieval**: Find top-K similar templates via embeddings
  2. **Prompt**: Build optimized prompt with only candidates
  3. **AI Call**: Send prompt to AI provider
  4. **Parse**: Parse and validate AI response

## Usage

```javascript
const { TemplateIntelligenceOrchestrator } = require('./services/ddt-intelligence');
const AIProviderService = require('./services/AIProviderService');

// Initialize
const aiProviderService = new AIProviderService();
const orchestrator = new TemplateIntelligenceOrchestrator(aiProviderService);

// Pre-compute embeddings (optional, but recommended)
await orchestrator.initialize(templates);

// Analyze user request
const result = await orchestrator.analyzeUserRequest(
  userDesc,
  templates,
  'groq',
  'llama-3.1-8b-instant'
);
```

## Benefits

1. **Modular**: Each component has a single, clear responsibility
2. **Isolated**: Prompt builder is completely separate from retrieval logic
3. **Testable**: Each component can be tested independently
4. **Scalable**: Easy to add new features or swap implementations
5. **Maintainable**: Clean, organized code structure

## Integration Status

- ✅ Architecture implemented
- ✅ All components created
- ✅ Server.js updated to use new orchestrator
- ✅ Embedding service integrated with Python FastAPI service
- ✅ Endpoint `/api/embeddings/compute` added to `intent_embeddings.py`
- ✅ FastAPI router registered in `app_min.py`

## Next Steps

1. ✅ **DONE**: Integrate `TemplateEmbeddingService` with Python embedding service
2. Add unit tests for each component
3. Add integration tests for orchestrator
4. Monitor prompt size reduction and AI response quality
5. Add caching layer for embeddings (MongoDB persistence)

## Requirements

- Python FastAPI service must be running on port 8000 (or set `EMBEDDING_SERVICE_URL` env var)
- Python service must have `sentence-transformers` installed
- The `/api/embeddings/compute` endpoint must be accessible
