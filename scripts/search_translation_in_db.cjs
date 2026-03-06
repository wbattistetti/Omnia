// Simple MongoDB search script for a specific Italian sentence in translations/tasks
// Usage:
//   node scripts/search_translation_in_db.cjs

/* eslint-disable no-console */

const { MongoClient } = require('mongodb');

const uri =
  process.env.MONGODB_URI ||
  'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';

async function main() {
  const client = new MongoClient(uri);

  const cliText = process.argv[2];
  const searchText = cliText && cliText.trim()
    ? cliText.trim()
    : 'Mi dica la numero del ticket';
  const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const searchPattern = new RegExp(escaped, 'i');

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    console.log('🔍 Searching for:', JSON.stringify(searchText));

    // 1) Search in factory.Translations
    const factoryDb = client.db('factory');
    const factoryTranslations = factoryDb.collection('Translations');

    const factoryResults = await factoryTranslations
      .find({
        $or: [{ text: searchPattern }, { guid: searchPattern }],
      })
      .toArray();

    if (factoryResults.length > 0) {
      console.log(`\n📋 Found ${factoryResults.length} result(s) in factory.Translations:`);
      factoryResults.forEach((doc, idx) => {
        console.log(`\n[factory.Translations #${idx + 1}]`);
        console.log('  _id    :', String(doc._id));
        console.log('  guid   :', doc.guid || 'N/A');
        console.log('  text   :', doc.text);
        console.log('  lang   :', doc.language || 'N/A');
        console.log('  project:', doc.projectId || 'N/A');
      });
    } else {
      console.log('\nℹ️  No matches in factory.Translations');
    }

    // 2) Search in each project <db>.Translations
    const adminDb = client.db().admin();
    const dbList = await adminDb.listDatabases();

    for (const dbInfo of dbList.databases) {
      const dbName = dbInfo.name;
      if (['admin', 'local', 'config', 'factory'].includes(dbName)) continue;

      try {
        const projDb = client.db(dbName);
        const collections = await projDb.listCollections({ name: 'Translations' }).toArray();
        if (collections.length === 0) continue;

        const projTranslations = projDb.collection('Translations');
        const projResults = await projTranslations
          .find({
            $or: [{ text: searchPattern }, { guid: searchPattern }],
          })
          .toArray();

        if (projResults.length > 0) {
          console.log(`\n📋 Found ${projResults.length} result(s) in ${dbName}.Translations:`);
          projResults.forEach((doc, idx) => {
            console.log(`\n[${dbName}.Translations #${idx + 1}]`);
            console.log('  _id   :', String(doc._id));
            console.log('  guid  :', doc.guid || 'N/A');
            console.log('  text  :', doc.text);
            console.log('  lang  :', doc.language || 'N/A');
          });
        }
      } catch (err) {
        console.warn(`⚠️  Skipping DB ${dbName}:`, err.message);
      }
    }

    // 3) Search also in factory.Tasks (examples / labels)
    const tasksColl = factoryDb.collection('Tasks');
    const taskResults = await tasksColl
      .find({
        $or: [
          { label: searchPattern },
          { examples: searchPattern },
          { 'data.examples': searchPattern },
          { 'data.nlpProfile.examples': searchPattern },
        ],
      })
      .toArray();

    if (taskResults.length > 0) {
      console.log(`\n📋 Found ${taskResults.length} result(s) in factory.Tasks:`);
      taskResults.forEach((task, idx) => {
        console.log(`\n[factory.Tasks #${idx + 1}]`);
        console.log('  _id  :', String(task._id));
        console.log('  id   :', task.id || 'N/A');
        console.log('  label:', task.label || 'N/A');
        if (task.examples) {
          console.log('  examples:', JSON.stringify(task.examples));
        }
      });
    } else {
      console.log('\nℹ️  No matches in factory.Tasks');
    }

    console.log('\n✅ Search completed');
  } catch (err) {
    console.error('❌ Error while searching:', err);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('❌ Unhandled error:', err);
});

