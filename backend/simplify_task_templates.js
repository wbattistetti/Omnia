/**
 * Script per semplificare e pulire Task_Templates:
 * 1. Rimuove dataType (ridondante)
 * 2. Rimuove metadata.isMainData / metadata.isSubData (ridondanti)
 * 3. Rimuove mainData[] dai template (solo subDataIds serve)
 * 4. Sposta steps da mainData[] a root level
 * 5. Assicura che subDataIds sia presente (vuoto per atomici, pieno per compositi)
 * 6. Struttura unificata per tutti i template
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB_NAME = 'factory';

async function simplifyTaskTemplates() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(DB_NAME);
    const templatesCollection = db.collection('Task_Templates');

    const templates = await templatesCollection.find({}).toArray();
    console.log(`📦 Found ${templates.length} templates\n`);

    let updated = 0;
    let skipped = 0;

    for (const template of templates) {
      const templateName = template.label || template.name || template._id || 'unknown';
      console.log(`\n🔍 Processing: ${templateName}`);

      const update = {};
      const unset = {};

      // 1. Rimuovi dataType (ridondante)
      if (template.dataType !== undefined) {
        unset.dataType = '';
        console.log(`  ✅ Removing dataType: ${template.dataType}`);
      }

      // 2. Rimuovi metadata completamente (tutti i campi sono ridondanti)
      if (template.metadata) {
        unset.metadata = '';
        console.log(`  ✅ Removing metadata (including sourcePath)`);
      }

      // 3. Gestisci mainData[] e steps
      if (template.mainData && Array.isArray(template.mainData) && template.mainData.length > 0) {
        // Se c'è mainData, sposta steps a root level
        const firstMain = template.mainData[0];

        if (firstMain.steps) {
          // Sposta steps a root level
          update.steps = firstMain.steps;
          console.log(`  ✅ Moved steps from mainData[0] to root level`);
        }

        // Rimuovi mainData (non serve nei template, solo subDataIds)
        unset.mainData = '';
        console.log(`  ✅ Removing mainData[] (use subDataIds instead)`);
      } else if (template.steps) {
        // steps già a root level, mantienili
        console.log(`  ✅ steps already at root level`);
      }

      // 4. Assicura che subDataIds sia presente
      if (template.subDataIds === undefined) {
        // Deriva da mainData se esisteva, altrimenti array vuoto
        if (template.mainData && Array.isArray(template.mainData) && template.mainData.length > 0) {
          // Estrai gli ID dai templateRef o type dei mainData
          const ids = template.mainData
            .map(m => m.templateRef || m.type || m.id)
            .filter(id => id && typeof id === 'string');
          update.subDataIds = ids;
          console.log(`  ✅ Created subDataIds from mainData: [${ids.join(', ')}]`);
        } else {
          update.subDataIds = [];
          console.log(`  ✅ Created empty subDataIds (atomic template)`);
        }
      } else if (!Array.isArray(template.subDataIds)) {
        // Normalizza subDataIds se non è un array
        update.subDataIds = [];
        console.log(`  ✅ Normalized subDataIds to empty array`);
      }

      // Applica gli update solo se ci sono modifiche
      if (Object.keys(update).length > 0 || Object.keys(unset).length > 0) {
        const updateOp = {};
        if (Object.keys(update).length > 0) {
          updateOp.$set = update;
        }
        if (Object.keys(unset).length > 0) {
          updateOp.$unset = unset;
        }

        await templatesCollection.updateOne(
          { _id: template._id },
          updateOp
        );
        updated++;
        console.log(`  ✅ Template updated`);
      } else {
        skipped++;
        console.log(`  ⏭️  No changes needed`);
      }
    }

    console.log(`\n\n${'='.repeat(70)}`);
    console.log(`📊 SUMMARY`);
    console.log(`${'='.repeat(70)}\n`);
    console.log(`✅ Templates updated: ${updated}`);
    console.log(`⏭️  Templates skipped: ${skipped}`);
    console.log(`\n✅ All templates simplified!`);

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

simplifyTaskTemplates().catch(console.error);

