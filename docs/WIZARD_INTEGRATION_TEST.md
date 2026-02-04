# Wizard Integration Test Plan

## Overview
This document describes the end-to-end integration testing for the Card-Based Wizard, including backend API integration, AI prompt validation, and functional testing.

## Prerequisites

### Backend Setup
1. **FastAPI Server** must be running on `http://localhost:8000`
2. **Express Server** must be running on `http://localhost:3100` (for proxy)
3. **MongoDB** must be running and accessible
4. **OpenAI API Key** must be configured in `newBackend/core/core_settings.py`

### Frontend Setup
1. **Vite Dev Server** must be running on `http://localhost:5173`
2. All dependencies installed: `npm install`

## Endpoint Mapping

### Phase A: Structure Generation
- **Frontend**: `src/wizard/services/structureGenerationService.ts`
- **Backend**: `POST /api/nlp/generate-structure`
- **Backend File**: `newBackend/api/api_nlp.py:958`
- **Service**: `newBackend/services/ai/ai_structure_service.py`
- **Prompt**: `backend/ai_prompts/generate_structure_prompt.py`

### Phase B: Structure Regeneration
- **Frontend**: `src/wizard/services/structureGenerationService.ts`
- **Backend**: `POST /api/nlp/regenerate-structure`
- **Backend File**: `newBackend/api/api_nlp.py:1016`
- **Service**: `newBackend/services/ai/ai_structure_service.py`
- **Prompt**: `backend/ai_prompts/regenerate_structure_prompt.py`

### STEP 1: Contract Refinement
- **Frontend**: `src/utils/wizard/refineContract.ts`
- **Backend**: `POST /api/nlp/generate-contracts` (alias for `refine-contract`)
- **Backend File**: `newBackend/api/api_nlp.py:1088`
- **Prompt**: `backend/ai_prompts/generate_contracts_prompt.py`

### STEP 2: Canonical Values
- **Frontend**: `src/utils/wizard/generateCanonicalValues.ts`
- **Backend**: `POST /api/nlp/generate-canonical-values`
- **Backend File**: `newBackend/api/api_nlp.py:200`
- **Prompt**: `backend/ai_prompts/generate_canonical_values_prompt.py`

### STEP 3: Constraints
- **Frontend**: `src/utils/wizard/generateConstraints.ts`
- **Backend**: `POST /api/nlp/generate-constraints`
- **Backend File**: `newBackend/api/api_nlp.py:400`
- **Prompt**: `backend/ai_prompts/generate_constraints_prompt.py`

### STEP 4: Engines
- **Frontend**: `src/utils/wizard/generateEnginesUnified.ts`
- **Backend**: `POST /api/nlp/generate-engines`
- **Backend File**: `newBackend/api/api_nlp.py:485`
- **Prompt**: `backend/ai_prompts/generate_engines_prompt.py`

### STEP 5: Escalation
- **Frontend**: `src/utils/wizard/generateEscalation.ts`
- **Backend**: `POST /api/nlp/generate-escalation`
- **Backend File**: `newBackend/api/api_nlp.py:600`
- **Prompt**: `backend/ai_prompts/generate_escalation_prompt.py`

### STEP 6: Test Examples
- **Frontend**: `src/utils/wizard/generateTestExamples.ts`
- **Backend**: `POST /api/nlp/generate-test-examples`
- **Backend File**: `newBackend/api/api_nlp.py:725`
- **Prompt**: `backend/ai_prompts/generate_test_examples_prompt.py`

### STEP 7: AI Messages
- **Frontend**: `src/utils/wizard/generateAIMessages.ts`
- **Backend**: `POST /api/nlp/generate-ai-messages`
- **Backend File**: `newBackend/api/api_nlp.py:824`
- **Prompt**: `backend/ai_prompts/generate_ai_messages_prompt.py`

## Test Scenarios

### Test 1: Complete Wizard Flow (Happy Path)

**Steps:**
1. Open wizard from landing page
2. Enter task label: "Date of Birth"
3. Click "Generate Structure"
4. Verify structure is generated (root + sub-nodes)
5. Click "Va bene" to approve structure
6. Set all nodes to "AI" mode
7. Click "Start Generation"
8. Verify all 7 steps complete for each node
9. Verify progress indicators update in real-time
10. Verify final result contains: contract, engines, escalation, test examples, AI messages

**Expected Results:**
- Structure generated with root "Data" and sub-nodes (Day, Month, Year)
- All 7 pipeline steps complete successfully
- Progress chips show green checkmarks
- Final artifacts are valid and complete

### Test 2: Structure Regeneration

**Steps:**
1. Generate initial structure for "Email Address"
2. Click "Non va bene"
3. Enter feedback: "Add validation for domain"
4. Click "Riprova"
5. Verify new structure includes validation nodes

**Expected Results:**
- New structure generated based on feedback
- Previous structure is replaced
- New structure includes requested changes

### Test 3: Mixed AI/Manual Mode

**Steps:**
1. Generate structure for "Address"
2. Set root node to "AI" mode
3. Set "Street" sub-node to "Manual" mode
4. Click "Start Generation"
5. Verify only root node runs pipeline
6. Verify "Street" remains in manual mode

**Expected Results:**
- Only AI nodes execute pipeline
- Manual nodes remain pending
- Progress only shown for AI nodes

### Test 4: Error Handling

**Steps:**
1. Stop backend server
2. Try to generate structure
3. Verify error message is shown
4. Restart backend
5. Retry generation
6. Verify it works

**Expected Results:**
- Error message displayed clearly
- User can retry after fixing issue
- No crashes or infinite loading

### Test 5: AI Mode Propagation

**Steps:**
1. Generate structure with nested nodes (3 levels deep)
2. Set root node to "AI" mode
3. Verify all children automatically set to "AI"
4. Start generation
5. Verify all nodes execute pipeline

**Expected Results:**
- All children inherit AI mode
- All nodes show progress
- All nodes complete successfully

## Validation Checklist

### Backend API Validation

- [ ] All endpoints return valid JSON
- [ ] All endpoints handle errors gracefully
- [ ] All endpoints validate input parameters
- [ ] All endpoints use retry strategy
- [ ] All endpoints log appropriately

### Frontend Integration Validation

- [ ] All API calls use correct endpoints
- [ ] All API calls handle errors
- [ ] All API calls show loading states
- [ ] All API calls update progress
- [ ] All API calls validate responses

### AI Prompt Validation

- [ ] All prompts produce valid JSON
- [ ] All prompts respect TypeScript types
- [ ] All prompts are deterministic
- [ ] All prompts include examples
- [ ] All prompts handle edge cases

### UI/UX Validation

- [ ] Progress indicators update in real-time
- [ ] Error messages are clear and actionable
- [ ] Loading states are visible
- [ ] Success states are clear
- [ ] Navigation is intuitive

## Running Tests

### Manual Testing
1. Start all servers (backend, frontend)
2. Open browser to `http://localhost:5173`
3. Follow test scenarios above
4. Document any issues

### Automated Testing (Future)
```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e
```

## Debugging

### Backend Logs
Check FastAPI console for:
- `[generate-structure]` - Structure generation
- `[generate-contracts]` - Contract refinement
- `[generate-engines]` - Engine generation
- `[generate-ai-messages]` - Message generation

### Frontend Logs
Check browser console for:
- `[AppContent]` - App state changes
- `[ProjectService]` - API calls
- `[structureGenerationService]` - Structure generation
- `[generationService]` - Pipeline execution

### Network Tab
Check browser Network tab for:
- API request/response pairs
- Response status codes
- Response payloads
- Request timing

## Known Issues

### Issue 1: Backend Not Reachable
**Symptom**: Projects don't load, wizard fails
**Solution**: Ensure backend is running on port 8000

### Issue 2: AI Timeout
**Symptom**: Generation hangs indefinitely
**Solution**: Check OpenAI API key, increase timeout

### Issue 3: Invalid JSON Response
**Symptom**: Parsing errors in console
**Solution**: Check AI prompt, add retry logic

## Next Steps

1. ✅ Complete backend endpoint implementation
2. ✅ Complete frontend integration
3. ⏳ Add automated tests
4. ⏳ Add error recovery
5. ⏳ Add performance monitoring
6. ⏳ Add user analytics
