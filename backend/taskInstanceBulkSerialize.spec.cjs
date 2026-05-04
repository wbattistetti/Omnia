'use strict';

/**
 * Node built-in tests (avoid Vitest jsdom setup for pure backend module).
 * Run: node --test backend/taskInstanceBulkSerialize.spec.cjs
 */

const test = require('node:test');
const assert = require('node:assert');
const {
  buildInstanceTaskDocument,
  getAllowedInstanceFieldKeysForTaskType,
  TaskType,
} = require('./taskInstanceBulkSerialize.js');

const now = new Date('2026-01-01T00:00:00.000Z');
const projectId = 'proj-1';

test('SayMessage instance includes parameters and label', () => {
  const textGuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const item = {
    id: 'row-task-1',
    type: TaskType.SayMessage,
    templateId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    templateVersion: 2,
    labelKey: 'lbl',
    label: 'saluta',
    parameters: [{ parameterId: 'text', value: textGuid }],
  };
  const doc = buildInstanceTaskDocument(item, { projectId, now });
  assert.deepStrictEqual(doc.parameters, item.parameters);
  assert.strictEqual(doc.label, 'saluta');
  assert.strictEqual(doc.type, TaskType.SayMessage);
});

test('BackendCall instance includes endpoint/method/params', () => {
  const item = {
    id: 'bc-1',
    type: TaskType.BackendCall,
    templateId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    labelKey: 'k',
    endpoint: '/api/x',
    method: 'POST',
    params: { a: 1 },
  };
  const doc = buildInstanceTaskDocument(item, { projectId, now });
  assert.strictEqual(doc.endpoint, '/api/x');
  assert.strictEqual(doc.method, 'POST');
  assert.deepStrictEqual(doc.params, { a: 1 });
});

test('BackendCall instance includes advancement and mock table fields', () => {
  const item = {
    id: 'bc-adv-1',
    type: TaskType.BackendCall,
    templateId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    labelKey: 'k',
    inputs: [{ internalName: 'startDate' }],
    mockTable: [{ x: 1 }],
    inputAdvancement: { startDate: { enabled: true, dslExpression: 'prev.startDate' } },
    inputAdvancementTypes: { startDate: 'Date' },
    advancementTestPrevJson: '{"startDate":"2026-05-04"}',
  };
  const doc = buildInstanceTaskDocument(item, { projectId, now });
  assert.deepStrictEqual(doc.inputs, item.inputs);
  assert.deepStrictEqual(doc.mockTable, item.mockTable);
  assert.deepStrictEqual(doc.inputAdvancement, item.inputAdvancement);
  assert.deepStrictEqual(doc.inputAdvancementTypes, item.inputAdvancementTypes);
  assert.strictEqual(doc.advancementTestPrevJson, item.advancementTestPrevJson);
});

test('AI Agent instance merges agent fields', () => {
  const item = {
    id: 'ag-1',
    type: TaskType.AIAgent,
    templateId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    labelKey: 'x',
    agentPrompt: 'hello',
    steps: {},
  };
  const doc = buildInstanceTaskDocument(item, { projectId, now });
  assert.strictEqual(doc.agentPrompt, 'hello');
});

test('getAllowedInstanceFieldKeysForTaskType includes parameters for SayMessage', () => {
  const keys = getAllowedInstanceFieldKeysForTaskType(TaskType.SayMessage);
  assert.ok(keys.includes('parameters'));
  assert.ok(keys.includes('label'));
});
