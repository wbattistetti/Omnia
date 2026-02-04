/**
 * Wizard Integration Test Script
 *
 * Quick test script to verify backend-frontend integration.
 * Run this after starting both backend and frontend servers.
 */

const BACKEND_URL = 'http://localhost:8000';
const FRONTEND_URL = 'http://localhost:5173';

async function testBackendHealth() {
  console.log('\n🔍 Testing Backend Health...');
  try {
    // Try a simple endpoint instead of /health
    const response = await fetch(`${BACKEND_URL}/api/nlp/generate-structure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskLabel: 'test' })
    });

    // If we get any response (even error), backend is reachable
    if (response.status !== 0) {
      console.log('✅ Backend is reachable');
      return true;
    } else {
      console.log('❌ Backend is not reachable');
      return false;
    }
  } catch (error) {
    console.log('❌ Backend is not reachable:', error.message);
    return false;
  }
}

async function testStructureGeneration() {
  console.log('\n🔍 Testing Structure Generation...');
  try {
    const response = await fetch(`${BACKEND_URL}/api/nlp/generate-structure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskLabel: 'Email Address',
        provider: 'openai'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Structure generation failed:', response.status, errorText);
      return false;
    }

    const data = await response.json();
    if (data.success && data.structure) {
      console.log('✅ Structure generation works');
      console.log(`   Generated ${data.structure.length} nodes`);
      return true;
    } else {
      console.log('❌ Invalid response structure:', data);
      return false;
    }
  } catch (error) {
    console.log('❌ Structure generation error:', error.message);
    return false;
  }
}

async function testContractRefinement() {
  console.log('\n🔍 Testing Contract Refinement...');
  try {
    const contract = {
      entity: {
        label: 'Email',
        type: 'email',
        description: 'User email address'
      },
      outputCanonical: {
        format: 'value'
      }
    };

    const response = await fetch(`${BACKEND_URL}/api/nlp/generate-contracts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contract,
        nodeLabel: 'Email',
        provider: 'openai'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Contract refinement failed:', response.status, errorText);
      return false;
    }

    const data = await response.json();
    // Backend returns { success: true, refinement: {...} } or { success: true, contract: {...} }
    if (data.success && (data.contract || data.refinement)) {
      console.log('✅ Contract refinement works');
      if (data.refinement) {
        console.log('   Response format: refinement object');
      } else {
        console.log('   Response format: contract object');
      }
      return true;
    } else {
      console.log('❌ Invalid response:', JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error) {
    console.log('❌ Contract refinement error:', error.message);
    return false;
  }
}

async function testEnginesGeneration() {
  console.log('\n🔍 Testing Engines Generation...');
  try {
    const contract = {
      entity: {
        label: 'Email',
        type: 'email',
        description: 'User email address'
      },
      outputCanonical: {
        format: 'value'
      }
    };

    const response = await fetch(`${BACKEND_URL}/api/nlp/generate-engines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contract,
        nodeLabel: 'Email',
        provider: 'openai'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Engines generation failed:', response.status, errorText);
      return false;
    }

    const data = await response.json();
    // Backend returns { success: true, engines: {...} } with all engine types
    if (data.success && data.engines) {
      const engines = data.engines;
      const engineTypes = Object.keys(engines).filter(k => k !== 'error' && k !== 'success');

      if (engineTypes.length > 0) {
        console.log('✅ Engines generation works');
        console.log(`   Generated engines: ${engineTypes.join(', ')}`);
        return true;
      } else {
        console.log('❌ No engines in response:', JSON.stringify(data, null, 2));
        return false;
      }
    } else if (data.regex || data.rule_based || data.ner) {
      // Fallback: check if engines are at root level
      const engineTypes = Object.keys(data).filter(k => k !== 'error' && k !== 'success');
      console.log('✅ Engines generation works (legacy format)');
      console.log(`   Generated engines: ${engineTypes.join(', ')}`);
      return true;
    } else {
      console.log('❌ Invalid response:', JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error) {
    console.log('❌ Engines generation error:', error.message);
    return false;
  }
}

async function testFrontendReachability() {
  console.log('\n🔍 Testing Frontend Reachability...');
  try {
    const response = await fetch(`${FRONTEND_URL}`);
    if (response.ok) {
      console.log('✅ Frontend is reachable');
      return true;
    } else {
      console.log('❌ Frontend returned error:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Frontend is not reachable:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🧪 Wizard Integration Test Suite');
  console.log('═══════════════════════════════════════════════════════');

  const results = {
    backendHealth: await testBackendHealth(),
    structureGeneration: await testStructureGeneration(),
    contractRefinement: await testContractRefinement(),
    enginesGeneration: await testEnginesGeneration(),
    frontendReachability: await testFrontendReachability()
  };

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 Test Results Summary');
  console.log('═══════════════════════════════════════════════════════');

  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;

  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}`);
  });

  console.log(`\n${passed}/${total} tests passed`);

  if (passed === total) {
    console.log('\n🎉 All tests passed! Wizard is ready for use.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
