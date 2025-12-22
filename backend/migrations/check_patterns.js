const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';

(async () => {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('factory');
  
  // Cerca template GetData
  const query = {
    $or: [
      { type: 3 },
      { type: { $regex: /^datarequest$/i } },
      { name: { $regex: /^(datarequest|getdata|data)$/i } }
    ]
  };
  
  const templates = await db.collection('Task_Templates').find(query).limit(10).toArray();
  console.log('\n=== TEMPLATE GETDATA TROVATI ===');
  console.log('Totale:', templates.length);
  
  templates.forEach((t, i) => {
    console.log(`\n--- Template ${i + 1} ---`);
    console.log('  name:', t.name);
    console.log('  label:', t.label);
    console.log('  type:', t.type);
    console.log('  hasPatterns:', !!t.patterns);
    console.log('  patterns type:', typeof t.patterns);
    if (t.patterns) {
      console.log('  patterns:', JSON.stringify(t.patterns, null, 2));
    } else {
      console.log('  ⚠️  NO PATTERNS FIELD');
    }
    console.log('  All keys:', Object.keys(t).filter(k => !k.startsWith('_')).join(', '));
  });
  
  // Cerca anche template specifici come "Date"
  console.log('\n=== TEMPLATE SPECIFICI (Date, Name, etc.) ===');
  const specificTemplates = await db.collection('Task_Templates').find({
    $or: [
      { name: { $regex: /^(date|name|phone|email|address)$/i } },
      { label: { $regex: /^(date|name|phone|email|address)$/i } }
    ]
  }).limit(10).toArray();
  
  console.log('Totale:', specificTemplates.length);
  specificTemplates.forEach((t, i) => {
    console.log(`\n--- Template ${i + 1} ---`);
    console.log('  name:', t.name);
    console.log('  label:', t.label);
    console.log('  hasPatterns:', !!t.patterns);
    if (t.patterns) {
      console.log('  patterns:', JSON.stringify(t.patterns, null, 2));
    } else {
      console.log('  ⚠️  NO PATTERNS FIELD');
    }
  });
  
  await client.close();
})();


