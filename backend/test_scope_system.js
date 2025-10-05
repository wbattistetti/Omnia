/*
 * Script per testare il nuovo sistema di scope filtering
 * 
 * Usage: node backend/test_scope_system.js
 */

const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';

async function testScopeSystem() {
  const client = new MongoClient(uri);
  
  try {
    console.log('🔗 Connecting to MongoDB...');
    await client.connect();
    
    const db = client.db('factory');
    
    console.log('\n🎯 Testing scope filtering system...');
    
    // Test 1: Verifica che i documenti abbiano i campi scope e industry
    console.log('\n📊 Test 1: Verifica campi scope e industry');
    const agentActs = await db.collection('AgentActs').find({}).limit(3).toArray();
    
    agentActs.forEach((act, index) => {
      console.log(`\n   Document ${index + 1}:`);
      console.log(`     _id: ${act._id}`);
      console.log(`     label: ${act.label}`);
      console.log(`     scope: ${act.scope || 'MISSING'}`);
      console.log(`     industry: ${act.industry || 'MISSING'}`);
    });
    
    // Test 2: Query con scope filtering
    console.log('\n📊 Test 2: Query con scope filtering');
    
    // Query per elementi globali
    const globalQuery = { scope: 'global' };
    const globalCount = await db.collection('AgentActs').countDocuments(globalQuery);
    console.log(`   Global elements: ${globalCount}`);
    
    // Query per elementi industry-specific
    const industryQuery = { scope: 'industry', industry: 'utility-gas' };
    const industryCount = await db.collection('AgentActs').countDocuments(industryQuery);
    console.log(`   Industry-specific elements (utility-gas): ${industryCount}`);
    
    // Query combinata (come farà il nuovo sistema)
    const combinedQuery = {
      $or: [
        { scope: 'global' },
        { scope: 'industry', industry: 'utility-gas' }
      ]
    };
    const combinedCount = await db.collection('AgentActs').countDocuments(combinedQuery);
    console.log(`   Combined query result: ${combinedCount}`);
    
    // Test 3: Verifica endpoint POST
    console.log('\n📊 Test 3: Simulazione endpoint POST');
    
    const testPayload = {
      industry: 'utility-gas',
      scope: ['global', 'industry']
    };
    
    console.log(`   Test payload:`, JSON.stringify(testPayload, null, 2));
    
    // Simula la query che farà l'endpoint POST
    const endpointQuery = {};
    if (testPayload.scope && Array.isArray(testPayload.scope)) {
      const scopeConditions = [];
      
      if (testPayload.scope.includes('global')) {
        scopeConditions.push({ scope: 'global' });
      }
      
      if (testPayload.scope.includes('industry') && testPayload.industry) {
        scopeConditions.push({ 
          scope: 'industry', 
          industry: testPayload.industry 
        });
      }
      
      if (scopeConditions.length > 0) {
        endpointQuery.$or = scopeConditions;
      }
    }
    
    console.log(`   Generated query:`, JSON.stringify(endpointQuery, null, 2));
    
    const endpointResult = await db.collection('AgentActs').find(endpointQuery).limit(5).toArray();
    console.log(`   Endpoint result count: ${endpointResult.length}`);
    
    if (endpointResult.length > 0) {
      console.log(`   First result:`, {
        _id: endpointResult[0]._id,
        label: endpointResult[0].label,
        scope: endpointResult[0].scope,
        industry: endpointResult[0].industry
      });
    }
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during testing:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

testScopeSystem()
  .then(() => {
    console.log('\n🎉 Test completed successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
