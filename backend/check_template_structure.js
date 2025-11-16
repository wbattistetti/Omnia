/**
 * Script per verificare la struttura di un template dopo la semplificazione
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB_NAME = 'factory';

async function checkTemplate() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(DB_NAME);
    const templatesCollection = db.collection('Task_Templates');

    // Prendi il template "Month"
    const template = await templatesCollection.findOne({ label: 'Month' });

    if (!template) {
      console.log('❌ Template "Month" not found');
      return;
    }

    console.log('📋 Template "Month" structure:\n');
    console.log(JSON.stringify(template, null, 2));

    console.log('\n\n🔍 Analysis:');
    console.log(`- Has dataType: ${template.dataType !== undefined ? 'YES ❌' : 'NO ✅'}`);
    console.log(`- Has mainData: ${template.mainData !== undefined ? 'YES ❌' : 'NO ✅'}`);
    console.log(`- Has subDataIds: ${template.subDataIds !== undefined ? 'YES ✅' : 'NO ❌'}`);
    console.log(`- Has stepPrompts at root: ${template.stepPrompts !== undefined ? 'YES ✅' : 'NO ❌'}`);
    console.log(`- Has stepPrompts in metadata: ${template.metadata?.stepPrompts !== undefined ? 'YES ❌' : 'NO ✅'}`);
    console.log(`- Has metadata.isMainData: ${template.metadata?.isMainData !== undefined ? 'YES ❌' : 'NO ✅'}`);
    console.log(`- Has metadata.isSubData: ${template.metadata?.isSubData !== undefined ? 'YES ❌' : 'NO ✅'}`);

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

checkTemplate().catch(console.error);

