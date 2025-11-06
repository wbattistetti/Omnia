// backend/clear_factory_db.js
/*
 * Script per pulire le collezioni principali del DB Factory
 *
 * Collezioni che verranno pulite:
 * - AgentActs
 * - BackendCalls
 * - Conditions
 * - Tasks
 * - MacroTasks
 *
 * Usage:
 *   node backend/clear_factory_db.js
 *   node backend/clear_factory_db.js --force (salta conferma)
 */

const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

// Collezioni da pulire
const COLLECTIONS_TO_CLEAR = [
  'AgentActs',
  'BackendCalls',
  'Conditions',
  'Tasks',
  'MacroTasks'
];

async function clearFactoryDB(options = {}) {
  const { force = false } = options;
  const client = new MongoClient(uri);

  try {
    console.log('🔗 Connecting to MongoDB...');
    await client.connect();
    const db = client.db(dbFactory);

    // Lista tutte le collezioni esistenti nel DB
    console.log('\n🔍 Scanning Factory DB for collections...');
    const allCollections = await db.listCollections().toArray();
    const existingCollectionNames = allCollections.map(c => c.name);

    console.log(`\n📋 Found ${existingCollectionNames.length} collections in Factory DB:`);
    existingCollectionNames.forEach(name => console.log(`   - ${name}`));

    // Filtra solo le collezioni che esistono e che vogliamo pulire
    const collectionsToProcess = COLLECTIONS_TO_CLEAR.filter(name =>
      existingCollectionNames.includes(name)
    );

    const missingCollections = COLLECTIONS_TO_CLEAR.filter(name =>
      !existingCollectionNames.includes(name)
    );

    if (missingCollections.length > 0) {
      console.log('\n⚠️  Collections not found (will be skipped):');
      missingCollections.forEach(name => console.log(`   - ${name}`));
    }

    if (collectionsToProcess.length === 0) {
      console.log('\n❌ No collections to clear!');
      return;
    }

    // Conta documenti prima della pulizia
    console.log('\n📊 Document counts BEFORE clearing:');
    console.log('='.repeat(80));
    const countsBefore = {};
    let totalBefore = 0;

    for (const collectionName of collectionsToProcess) {
      const collection = db.collection(collectionName);
      const count = await collection.countDocuments({});
      countsBefore[collectionName] = count;
      totalBefore += count;
      console.log(`   ${collectionName.padEnd(30)} : ${count.toString().padStart(6)} documents`);
    }
    console.log('='.repeat(80));
    console.log(`   TOTAL${' '.repeat(25)} : ${totalBefore.toString().padStart(6)} documents`);

    if (totalBefore === 0) {
      console.log('\n✅ Factory DB collections are already empty. Nothing to delete.');
      return;
    }

    // Conferma prima di cancellare (a meno che non sia --force)
    if (!force) {
      console.log('\n⚠️  ⚠️  ⚠️  WARNING  ⚠️  ⚠️  ⚠️');
      console.log(`About to delete ${totalBefore} documents from ${collectionsToProcess.length} collections!`);
      console.log('This action CANNOT be undone!');
      console.log('\nCollections to clear:');
      collectionsToProcess.forEach(name => {
        console.log(`   - ${name} (${countsBefore[name]} documents)`);
      });
      console.log('\n⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️');
      console.log('\nTo proceed without confirmation, use: node backend/clear_factory_db.js --force');
      console.log('Press Ctrl+C to cancel, or wait 10 seconds to proceed...');

      // Attendi 10 secondi o input utente
      await new Promise(resolve => {
        const timeout = setTimeout(() => {
          console.log('\n⏱️  Timeout reached. Proceeding with deletion...');
          resolve();
        }, 10000);

        // Se l'utente preme Enter, procedi immediatamente
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.once('data', () => {
          clearTimeout(timeout);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          console.log('\n✅ Proceeding with deletion...');
          resolve();
        });
      });
    }

    // Cancella documenti da ogni collezione
    console.log('\n🗑️  Clearing collections...');
    console.log('='.repeat(80));

    const results = {};
    let totalDeleted = 0;

    for (const collectionName of collectionsToProcess) {
      const collection = db.collection(collectionName);

      try {
        const result = await collection.deleteMany({});
        results[collectionName] = result.deletedCount;
        totalDeleted += result.deletedCount;
        console.log(`   ✅ ${collectionName.padEnd(30)} : ${result.deletedCount.toString().padStart(6)} documents deleted`);
      } catch (error) {
        console.error(`   ❌ ${collectionName.padEnd(30)} : ERROR - ${error.message}`);
        results[collectionName] = 0;
      }
    }

    console.log('='.repeat(80));
    console.log(`   TOTAL DELETED${' '.repeat(16)} : ${totalDeleted.toString().padStart(6)} documents`);

    // Verifica che siano vuote
    console.log('\n🔍 Verifying collections are empty...');
    const countsAfter = {};
    let totalAfter = 0;

    for (const collectionName of collectionsToProcess) {
      const collection = db.collection(collectionName);
      const count = await collection.countDocuments({});
      countsAfter[collectionName] = count;
      totalAfter += count;

      if (count === 0) {
        console.log(`   ✅ ${collectionName.padEnd(30)} : EMPTY`);
      } else {
        console.log(`   ⚠️  ${collectionName.padEnd(30)} : ${count} documents still remain!`);
      }
    }

    // Riepilogo finale
    console.log('\n' + '='.repeat(80));
    console.log('📊 FINAL SUMMARY:');
    console.log('='.repeat(80));
    console.log(`   Collections processed: ${collectionsToProcess.length}`);
    console.log(`   Documents before:     ${totalBefore}`);
    console.log(`   Documents deleted:    ${totalDeleted}`);
    console.log(`   Documents after:      ${totalAfter}`);

    if (totalAfter === 0) {
      console.log('\n✅ ✅ ✅ Factory DB successfully cleared! ✅ ✅ ✅');
    } else {
      console.log(`\n⚠️  Warning: ${totalAfter} documents still remain in Factory DB`);
    }

    // Mostra dettagli per collezione
    console.log('\n📋 Per-collection details:');
    for (const collectionName of collectionsToProcess) {
      const before = countsBefore[collectionName];
      const deleted = results[collectionName];
      const after = countsAfter[collectionName];
      console.log(`   ${collectionName}:`);
      console.log(`      Before:  ${before}`);
      console.log(`      Deleted: ${deleted}`);
      console.log(`      After:   ${after} ${after === 0 ? '✅' : '⚠️'}`);
    }

  } catch (err) {
    console.error('\n❌ Error clearing Factory DB:', err);
    throw err;
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  force: args.includes('--force')
};

// Run script
clearFactoryDB(options)
  .then(() => {
    console.log('\n🎉 Script completed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Script failed:', err);
    process.exit(1);
  });
