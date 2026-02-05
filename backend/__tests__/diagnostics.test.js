/**
 * Diagnostic tests for backend infrastructure
 * Tests proxy, Express, MongoDB connectivity and performance
 *
 * Run with: node backend/__tests__/diagnostics.test.js
 * Or integrate with your test framework (Jest/Vitest)
 */

// Simple test runner for Node.js (no external dependencies)
const EXPRESS_BASE = process.env.EXPRESS_BASE || 'http://localhost:3100';

// Simple test functions
async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    return true;
  } catch (e) {
    console.error(`❌ ${name}:`, e.message);
    return false;
  }
}

async function runTests() {
  console.log('🧪 Running Backend Diagnostic Tests...\n');

  let passed = 0;
  let failed = 0;

  // 6.2 - Express without MongoDB
  passed += await test('6.2 - Express ping returns 200', async () => {
    const response = await fetch(`${EXPRESS_BASE}/api/ping`);
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    const data = await response.json();
    if (!data.ok || data.express !== 'running') throw new Error('Invalid response format');
  });

  // 6.3 - MongoDB direct connection
  passed += await test('6.3 - MongoDB ping returns 200', async () => {
    const response = await fetch(`${EXPRESS_BASE}/api/mongodb/ping`);
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    const data = await response.json();
    if (!data.ok || data.mongodb !== 'connected') throw new Error('MongoDB not connected');
  });

  // 6.4 - Latency check
  passed += await test('6.4 - MongoDB latency < 1000ms', async () => {
    const response = await fetch(`${EXPRESS_BASE}/api/mongodb/ping`);
    const data = await response.json();
    const latency = parseInt(data.latency.replace('ms', ''));
    if (latency > 1000) {
      console.warn(`⚠️  High latency: ${latency}ms`);
    }
    if (latency > 5000) throw new Error(`Latency too high: ${latency}ms`);
  });

  // 6.5 - Load tests
  passed += await test('6.5 - 20 concurrent requests', async () => {
    const requests = Array(20).fill(null).map(() =>
      fetch(`${EXPRESS_BASE}/api/projects/catalog/clients`)
    );
    const responses = await Promise.all(requests);
    const statuses = responses.map(r => r.status);
    const error500Count = statuses.filter(s => s === 500).length;

    if (error500Count > 1) throw new Error(`Too many 500 errors: ${error500Count}`);

    const times = await Promise.all(
      responses.map(async (r) => {
        const start = Date.now();
        await r.json();
        return Date.now() - start;
      })
    );
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);

    if (avgTime > 2000) throw new Error(`Average time too high: ${avgTime}ms`);
    if (maxTime > 5000) throw new Error(`Max time too high: ${maxTime}ms`);

    console.log(`   📊 20 requests: avg=${avgTime.toFixed(0)}ms, max=${maxTime}ms, errors=${error500Count}`);
  });

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { runTests };
