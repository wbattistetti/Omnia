const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function inspectDateTemplate() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(dbFactory);
    const collection = db.collection('Task_Templates');
    
    // Find Date template
    const dateTemplate = await collection.findOne({ name: 'Date' });
    
    if (!dateTemplate) {
      console.error('❌ Template "Date" not found');
      return;
    }
    
    console.log('\n📋 Template Date - Full structure:');
    console.log('  id:', dateTemplate.id);
    console.log('  _id:', dateTemplate._id);
    console.log('  name:', dateTemplate.name);
    console.log('  label:', dateTemplate.label);
    console.log('  keys:', Object.keys(dateTemplate));
    
    console.log('\n🔍 SubData fields:');
    console.log('  subData exists?', 'subData' in dateTemplate);
    console.log('  subData type:', typeof dateTemplate.subData);
    console.log('  subData value:', dateTemplate.subData);
    
    console.log('\n🔍 SubDataIds fields:');
    console.log('  subDataIds exists?', 'subDataIds' in dateTemplate);
    console.log('  subDataIds type:', typeof dateTemplate.subDataIds);
    console.log('  subDataIds value:', dateTemplate.subDataIds);
    
    console.log('\n🔍 NLP Contract:');
    if (dateTemplate.nlpContract) {
      console.log('  templateName:', dateTemplate.nlpContract.templateName);
      console.log('  templateId:', dateTemplate.nlpContract.templateId);
      console.log('  subDataMapping keys:', Object.keys(dateTemplate.nlpContract.subDataMapping));
      console.log('  subDataMapping full:', JSON.stringify(dateTemplate.nlpContract.subDataMapping, null, 2));
    }
    
    // Try to find related templates
    console.log('\n🔍 Searching for Day/Month/Year templates:');
    const relatedTemplates = await collection.find({
      name: { $in: ['Day', 'Month', 'Year', 'day', 'month', 'year'] }
    }).toArray();
    
    console.log('  Found:', relatedTemplates.length);
    relatedTemplates.forEach(t => {
      console.log(`    - ${t.name} (id: ${t.id || t._id}, label: ${t.label})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

inspectDateTemplate().catch(console.error);











