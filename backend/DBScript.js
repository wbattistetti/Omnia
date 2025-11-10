// backend/fix_heuristics_type_field.js
/*
 * Script per correggere il campo internalType → type in task_heuristics
 *
 * Il backend si aspetta il campo 'type' ma i documenti migrati hanno 'internalType'
 * Questo script copia internalType → type e rimuove internalType
 *
 * Usage: node backend/fix_heuristics_type_field.js
 */

const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function fixHeuristicsTypeField() {
  const client = new MongoClient(uri);

  try {
    console.log('🔗 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    const db = client.db(dbFactory);
    const taskHeuristicsColl = db.collection('task_heuristics');

    // Trova documenti con internalType ma senza type
    const docsToFix = await taskHeuristicsColl.find({
      internalType: { $exists: true },
      type: { $exists: false }
    }).toArray();

    console.log(`📊 Found ${docsToFix.length} documents with internalType but no type field\n`);

    if (docsToFix.length === 0) {
      // Verifica se ci sono documenti con type
      const docsWithType = await taskHeuristicsColl.countDocuments({
        type: { $exists: true }
      });

      if (docsWithType > 0) {
        console.log('✅ All documents already have type field');
      } else {
        console.log('⚠️  No documents found with type field');
        console.log('💡 Checking if documents have internalType that needs conversion...');

        // Verifica se ci sono documenti con solo internalType
        const docsWithInternalType = await taskHeuristicsColl.find({
          internalType: { $exists: true }
        }).toArray();

        if (docsWithInternalType.length > 0) {
          console.log(`📊 Found ${docsWithInternalType.length} documents with internalType`);
          console.log('🔄 Converting internalType → type for all documents...\n');

          let updated = 0;
          for (const doc of docsWithInternalType) {
            const result = await taskHeuristicsColl.updateOne(
              { _id: doc._id },
              {
                $set: { type: doc.internalType },
                $unset: { internalType: '' }
              }
            );

            if (result.modifiedCount > 0) {
              updated++;
              console.log(`  ✅ Fixed ${doc._id}: ${doc.internalType} → type`);
            }
          }

          console.log(`\n✅ Fixed ${updated} documents`);
        }
      }
      return;
    }

    // Mostra alcuni esempi
    console.log('📄 Sample documents to fix:');
    docsToFix.slice(0, 3).forEach((doc, i) => {
      console.log(`  ${i + 1}. _id: ${doc._id}, internalType: ${doc.internalType}, language: ${doc.language}`);
    });
    if (docsToFix.length > 3) {
      console.log(`  ... and ${docsToFix.length - 3} more`);
    }
    console.log('');

    // Aggiorna i documenti: copia internalType → type, poi rimuovi internalType
    console.log('🔄 Fixing documents...');
    let updated = 0;

    for (const doc of docsToFix) {
      const result = await taskHeuristicsColl.updateOne(
        { _id: doc._id },
        {
          $set: { type: doc.internalType },
          $unset: { internalType: '' }
        }
      );

      if (result.modifiedCount > 0) {
        updated++;
        console.log(`  ✅ Fixed ${doc._id}: ${doc.internalType} → type`);
      }
    }

    console.log(`\n✅ Fixed ${updated} documents`);

    // Verifica finale
    const remaining = await taskHeuristicsColl.countDocuments({
      internalType: { $exists: true }
    });

    const withType = await taskHeuristicsColl.countDocuments({
      type: { $exists: true }
    });

    const total = await taskHeuristicsColl.countDocuments({});

    console.log(`\n📊 Final state:`);
    console.log(`  - Total documents: ${total}`);
    console.log(`  - Documents with 'type' field: ${withType}`);
    console.log(`  - Documents still with 'internalType': ${remaining}`);

    if (remaining === 0 && withType === total) {
      console.log('\n🎉 All documents fixed! All have type field and no internalType.');
    } else if (remaining > 0) {
      console.log(`\n⚠️  ${remaining} documents still have internalType`);
      console.log('💡 Some documents might have both fields. Checking...');

      const docsWithBoth = await taskHeuristicsColl.find({
        type: { $exists: true },
        internalType: { $exists: true }
      }).toArray();

      if (docsWithBoth.length > 0) {
        console.log(`\n🔄 Removing internalType from ${docsWithBoth.length} documents that have both fields...`);
        let cleaned = 0;
        for (const doc of docsWithBoth) {
          await taskHeuristicsColl.updateOne(
            { _id: doc._id },
            { $unset: { internalType: '' } }
          );
          cleaned++;
        }
        console.log(`✅ Cleaned ${cleaned} documents`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n🔌 Connection closed');
  }
}

fixHeuristicsTypeField()
  .then(() => {
    console.log('\n✅ Fix completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fix failed:', error);
    process.exit(1);
  });