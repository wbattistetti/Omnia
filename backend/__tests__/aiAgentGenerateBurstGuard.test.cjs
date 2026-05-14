/**
 * Unit tests for sliding-window burst guard (Node built-in runner).
 * Run: node --test backend/__tests__/aiAgentGenerateBurstGuard.test.cjs
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { createSlidingWindowBurstGuard } = require('../lib/aiAgentGenerateBurstGuard.js');

test('allows up to maxPerWindow within windowMs', () => {
  let t = 0;
  const g = createSlidingWindowBurstGuard({
    windowMs: 1000,
    maxPerWindow: 10,
    now: () => t,
  });
  const key = 'client-a';
  for (let i = 0; i < 10; i += 1) {
    const r = g.tryConsume(key);
    assert.strictEqual(r.ok, true, `call ${i + 1}`);
  }
  const blocked = g.tryConsume(key);
  assert.strictEqual(blocked.ok, false);
  assert.ok(blocked.inWindow >= 10);
});

test('after window slides, allows again', () => {
  let t = 0;
  const g = createSlidingWindowBurstGuard({
    windowMs: 1000,
    maxPerWindow: 3,
    now: () => t,
  });
  const key = 'client-b';
  assert.strictEqual(g.tryConsume(key).ok, true);
  assert.strictEqual(g.tryConsume(key).ok, true);
  assert.strictEqual(g.tryConsume(key).ok, true);
  assert.strictEqual(g.tryConsume(key).ok, false);
  t = 1001;
  assert.strictEqual(g.tryConsume(key).ok, true);
});
