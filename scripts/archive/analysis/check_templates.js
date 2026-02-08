const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';

(async () => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('factory');
    
    const totalGeneral = await db.collection('task_templates').countDocuments({ scope: 'general' });
    console.log('Total templates with scope=general:', totalGeneral);
    
    const withContexts = await db.collection('task_templates').countDocuments({ 
      scope: 'general', 
      contexts: { $exists: true, $ne: null } 
    });
    console.log('Templates with contexts field:', withContexts);
    
    const withoutContexts = await db.collection('task_templates').countDocuments({ 
      scope: 'general', 
      $or: [
        { contexts: { $exists: false } },
        { contexts: null }
      ]
    });
    console.log('Templates without contexts (migrated):', withoutContexts);
    
    const samples = await db.collection('task_templates').find({ scope: 'general' }).limit(10).toArray();
    console.log('\nSample templates:');
    samples.forEach(t => {
      console.log(`  - ${t.id} | ${t.label} | contexts: ${t.contexts ? JSON.stringify(t.contexts) : 'MISSING'}`);
    });
    
    // Test della query attuale
    console.log('\n--- Testing current query with context=NodeRow ---');
    const currentQuery = {
      scope: { $in: ['general'] },
      $or: [
        { contexts: { $in: ['NodeRow'] } },
        { contexts: { $exists: false } },
        { contexts: null }
      ]
    };
    const currentResult = await db.collection('task_templates').find(currentQuery).toArray();
    console.log('Current query returns:', currentResult.length, 'templates');
    
    // Test della query corretta con $and
    console.log('\n--- Testing corrected query with $and ---');
    const correctedQuery = {
      $and: [
        { scope: { $in: ['general'] } },
        {
          $or: [
            { contexts: { $in: ['NodeRow'] } },
            { contexts: { $exists: false } },
            { contexts: null }
          ]
        }
      ]
    };
    const correctedResult = await db.collection('task_templates').find(correctedQuery).toArray();
    console.log('Corrected query returns:', correctedResult.length, 'templates');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
})();




