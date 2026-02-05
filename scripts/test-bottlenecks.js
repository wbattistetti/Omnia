/**
 * Script per testare i colli di bottiglia del backend
 * Esegue test sequenziali e concorrenti per identificare problemi di performance
 */

const EXPRESS_BASE = 'http://localhost:3100';
const FASTAPI_BASE = 'http://localhost:8000';

async function test(name, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    console.log(`✅ ${name}: ${duration}ms`);
    return { success: true, duration, result };
  } catch (e) {
    const duration = Date.now() - start;
    console.error(`❌ ${name}: ${duration}ms - ${e.message}`);
    return { success: false, duration, error: e.message };
  }
}

async function testEndpoint(url, name) {
  return test(name, async () => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    return await response.json();
  });
}

async function testConcurrent(url, count, name) {
  console.log(`\n🔄 Testing ${name} with ${count} concurrent requests...`);
  const start = Date.now();
  const requests = Array(count).fill(null).map(() => fetch(url));

  const results = await Promise.allSettled(requests);
  const duration = Date.now() - start;

  const success = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
  const failed = results.length - success;

  console.log(`   ✅ Success: ${success}/${count}`);
  console.log(`   ❌ Failed: ${failed}/${count}`);
  console.log(`   ⏱️  Total time: ${duration}ms`);
  console.log(`   📊 Avg per request: ${(duration / count).toFixed(0)}ms`);

  return { success, failed, duration, avg: duration / count };
}

async function runDiagnostics() {
  console.log('🔍 DIAGNOSTICA COLLI DI BOTTIGLIA\n');
  console.log('='.repeat(60));

  // Test 1: Express ping (baseline)
  console.log('\n📌 TEST 1: Express Ping (baseline)');
  await testEndpoint(`${EXPRESS_BASE}/api/ping`, 'Express ping');

  // Test 2: MongoDB ping
  console.log('\n📌 TEST 2: MongoDB Connection');
  const mongoResult = await testEndpoint(`${EXPRESS_BASE}/api/mongodb/ping`, 'MongoDB ping');
  if (mongoResult.success && mongoResult.result) {
    console.log(`   📊 Pool size: ${mongoResult.result.poolSize}`);
    console.log(`   📊 Available: ${mongoResult.result.availableConnections}`);
    console.log(`   ⏱️  Latency: ${mongoResult.result.latency}`);
  }

  // Test 3: Catalog structure check
  console.log('\n📌 TEST 3: Catalog Structure Check');
  const structureResult = await testEndpoint(`${EXPRESS_BASE}/api/test/catalog-structure`, 'Catalog structure');
  if (structureResult.success && structureResult.result) {
    const timings = structureResult.result.timings;
    console.log(`   📊 Collection size: ${structureResult.result.data.collectionSize}`);
    console.log(`   ⏱️  countDocuments: ${timings.countDocuments}`);
    console.log(`   ⏱️  findOne: ${timings.findOne}`);
    console.log(`   ⏱️  simpleQuery: ${timings.simpleQuery}`);
    console.log(`   ⏱️  aggregation: ${timings.aggregation}`);
    if (structureResult.result.data.aggregationError) {
      console.log(`   ❌ Aggregation error: ${structureResult.result.data.aggregationError}`);
    }
  }

  // Test 4: Performance test
  console.log('\n📌 TEST 4: Performance Test');
  const perfResult = await testEndpoint(`${EXPRESS_BASE}/api/test/performance`, 'Performance test');
  if (perfResult.success && perfResult.result) {
    const r = perfResult.result.results;
    console.log(`   ⏱️  Express latency: ${r.express.latency}ms`);
    console.log(`   ⏱️  MongoDB latency: ${r.mongodb.latency}ms`);
    if (r.catalogQueries.ok) {
      console.log(`   ⏱️  countDocuments: ${r.catalogQueries.timings.countDocuments}ms`);
      console.log(`   ⏱️  findProjection: ${r.catalogQueries.timings.findProjection}ms`);
      console.log(`   ⏱️  aggregation: ${r.catalogQueries.timings.aggregation}ms`);
    }
    if (r.catalogQueries.errors.length > 0) {
      console.log(`   ❌ Errors: ${r.catalogQueries.errors.join(', ')}`);
    }
  }

  // Test 5: Catalog endpoints (quelli che falliscono)
  console.log('\n📌 TEST 5: Catalog Endpoints (quelli che falliscono)');
  await testEndpoint(`${EXPRESS_BASE}/api/projects/catalog/clients`, 'GET /api/projects/catalog/clients');
  await testEndpoint(`${EXPRESS_BASE}/api/projects/catalog/project-names`, 'GET /api/projects/catalog/project-names');
  await testEndpoint(`${EXPRESS_BASE}/api/projects/catalog/industries`, 'GET /api/projects/catalog/industries');

  // Test 6: Factory endpoints (quelli che falliscono)
  console.log('\n📌 TEST 6: Factory Endpoints (quelli che falliscono)');
  await testEndpoint(`${EXPRESS_BASE}/api/factory/tasks`, 'GET /api/factory/tasks');
  await testEndpoint(`${EXPRESS_BASE}/api/factory/ide-translations`, 'GET /api/factory/ide-translations');
  await testEndpoint(`${EXPRESS_BASE}/api/factory/template-label-translations?language=it`, 'GET /api/factory/template-label-translations');

  // Test 7: Concurrent load test
  console.log('\n📌 TEST 7: Concurrent Load Test');
  await testConcurrent(`${EXPRESS_BASE}/api/projects/catalog/clients`, 10, 'Catalog clients (10 concurrent)');
  await testConcurrent(`${EXPRESS_BASE}/api/factory/tasks`, 10, 'Factory tasks (10 concurrent)');

  // Test 8: Proxy test (se FastAPI è attivo)
  console.log('\n📌 TEST 8: Proxy Test (FastAPI → Express)');
  try {
    await testEndpoint(`${FASTAPI_BASE}/api/projects/catalog/clients`, 'Proxy: /api/projects/catalog/clients');
  } catch (e) {
    console.log(`   ⚠️  FastAPI non raggiungibile o proxy non configurato`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Diagnostica completata');
}

// Esegui diagnostica
runDiagnostics().catch(console.error);
