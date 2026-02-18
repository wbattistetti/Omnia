/**
 * ✅ MIGRATION SCRIPT: Convert translations from 2-letter to BCP 47 format
 *
 * Migrates:
 * - 'it' → 'it-IT'
 * - 'en' → 'en-US'
 * - 'pt' → 'pt-BR'
 * - 'es' → 'es-ES'
 * - 'fr' → 'fr-FR'
 *
 * Usage: node backend/scripts/migrateTranslationsToBCP47.js [--dry-run]
 */

const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';
const dbProjects = 'Projects';

// Mapping 2-letter → BCP 47
const localeMap = {
  'it': 'it-IT',
  'en': 'en-US',
  'pt': 'pt-BR',
  'es': 'es-ES',
  'fr': 'fr-FR'
};

async function migrateTranslations(dryRun = false) {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made\n');
    } else {
      console.log('🚀 MIGRATION MODE - Changes will be applied\n');
    }

    let totalMigrated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // 1. Migrate Factory translations
    console.log('📋 Migrating Factory translations...');
    const factoryDb = client.db(dbFactory);
    const factoryColl = factoryDb.collection('Translations');

    for (const [shortLocale, bcp47Locale] of Object.entries(localeMap)) {
      const count = await factoryColl.countDocuments({ language: shortLocale });
      if (count === 0) continue;

      console.log(`  - Found ${count} translations with language: '${shortLocale}'`);

      if (!dryRun) {
        const result = await factoryColl.updateMany(
          { language: shortLocale },
          { $set: { language: bcp47Locale } }
        );
        console.log(`    ✅ Migrated ${result.modifiedCount} translations to '${bcp47Locale}'`);
        totalMigrated += result.modifiedCount;
      } else {
        console.log(`    🔍 Would migrate ${count} translations to '${bcp47Locale}'`);
        totalMigrated += count;
      }
    }

    // 2. Migrate Project translations
    console.log('\n📋 Migrating Project translations...');
    const projectsDb = client.db(dbProjects);
    const projectsList = await projectsDb.listCollections().toArray();

    for (const collInfo of projectsList) {
      const projectId = collInfo.name;
      if (projectId === 'system.indexes') continue;

      try {
        const projDb = client.db(projectId);
        const projColl = projDb.collection('Translations');

        let projectMigrated = 0;
        let projectSkipped = 0;

        for (const [shortLocale, bcp47Locale] of Object.entries(localeMap)) {
          const count = await projColl.countDocuments({ language: shortLocale });
          if (count === 0) continue;

          console.log(`  - Project '${projectId}': Found ${count} translations with language: '${shortLocale}'`);

          if (!dryRun) {
            const result = await projColl.updateMany(
              { language: shortLocale },
              { $set: { language: bcp47Locale } }
            );
            console.log(`    ✅ Migrated ${result.modifiedCount} translations to '${bcp47Locale}'`);
            projectMigrated += result.modifiedCount;
            totalMigrated += result.modifiedCount;
          } else {
            console.log(`    🔍 Would migrate ${count} translations to '${bcp47Locale}'`);
            projectMigrated += count;
            totalMigrated += count;
          }
        }

        if (projectMigrated === 0) {
          projectSkipped++;
          totalSkipped++;
        }
      } catch (err) {
        console.error(`    ❌ Error migrating project '${projectId}':`, err.message);
        totalErrors++;
      }
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 MIGRATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`✅ Migrated: ${totalMigrated} translations`);
    console.log(`⏭️  Skipped: ${totalSkipped} projects (no changes needed)`);
    console.log(`❌ Errors: ${totalErrors}`);

    if (dryRun) {
      console.log('\n🔍 This was a DRY RUN - no changes were made');
      console.log('   Run without --dry-run to apply changes');
    } else {
      console.log('\n✅ Migration completed successfully!');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Main
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

console.log('═══════════════════════════════════════════════════════');
console.log('🔄 TRANSLATION MIGRATION: 2-letter → BCP 47');
console.log('═══════════════════════════════════════════════════════\n');

migrateTranslations(dryRun)
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
