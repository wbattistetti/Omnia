// add_template_label_translations.js
// Script per aggiungere traduzioni label dei template DDT nella collection Translations
const { MongoClient } = require('mongodb');
const { translations: labelTranslations } = require('./template_label_translations');

async function addTemplateLabelTranslations() {
  const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const db = client.db('factory');

    // 1. Leggi tutti i template DDT
    const query = {
      $or: [
        { type: 3 },
        { type: { $regex: /^datarequest$/i } },
        { type: { $regex: /^data$/i } },
        { name: { $regex: /^(datarequest|getdata|data)$/i } },
        { taskType: { $regex: /^(datarequest|getdata|data)$/i } }
      ]
    };

    const [templates1, templates2] = await Promise.all([
      db.collection('Task_Templates').find(query).toArray(),
      db.collection('task_templates').find(query).toArray()
    ]);

    // Rimuovi duplicati
    const templateMap = new Map();
    [...templates1, ...templates2].forEach(t => {
      const id = t.id || t._id?.toString();
      if (id && !templateMap.has(id)) {
        templateMap.set(id, t);
      }
    });

    const templates = Array.from(templateMap.values());
    console.log(`📋 Trovati ${templates.length} template DDT\n`);

    if (templates.length === 0) {
      console.log('⚠️  Nessun template trovato. Esco.');
      return;
    }

    // 2. Mostra le label attuali
    console.log('📝 Label attuali dei template:');
    templates.forEach((t, idx) => {
      const id = t.id || t._id?.toString();
      const label = t.label || t.name || 'N/A';
      console.log(`  ${idx + 1}. "${label}" (ID: ${id})`);
    });
    console.log('');

    // 3. Per ogni template, crea traduzioni label in 3 lingue
    const translationsToInsert = [];

    for (const template of templates) {
      const templateId = template.id || template._id?.toString();
      const currentLabel = template.label || template.name || 'Unknown';

      if (!templateId) {
        console.log(`⚠️  Skipping template senza ID: ${currentLabel}`);
        continue;
      }

      // ✅ Usa traduzioni dal mapping (con fallback alla label originale)
      const translations = labelTranslations[currentLabel] || {
        it: currentLabel,
        en: currentLabel,
        pt: currentLabel
      };

      console.log(`Processing: "${currentLabel}" (ID: ${templateId})`);
      console.log(`  IT: "${translations.it}"`);
      console.log(`  EN: "${translations.en}"`);
      console.log(`  PT: "${translations.pt}"`);

      // Crea 3 documenti Translations (uno per lingua)
      for (const [lang, text] of Object.entries(translations)) {
        translationsToInsert.push({
          guid: templateId,
          language: lang,
          text: text,
          projectId: null,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    console.log(`\n💾 Preparati ${translationsToInsert.length} traduzioni da inserire\n`);

    // 4. Inserisci in Translations (upsert per evitare duplicati)
    const translationsColl = db.collection('Translations');
    const bulkOps = translationsToInsert.map(doc => ({
      updateOne: {
        filter: {
          guid: doc.guid,
          language: doc.language
        },
        update: {
          $set: {
            guid: doc.guid,
            language: doc.language,
            text: doc.text,
            projectId: doc.projectId,
            updatedAt: doc.updatedAt
          },
          $setOnInsert: {
            createdAt: doc.createdAt
          }
        },
        upsert: true
      }
    }));

    if (bulkOps.length > 0) {
      console.log('⏳ Inserendo traduzioni...');
      const result = await translationsColl.bulkWrite(bulkOps);
      console.log(`\n✅ Completato!`);
      console.log(`   - Inserite: ${result.upsertedCount}`);
      console.log(`   - Aggiornate: ${result.modifiedCount}`);
      console.log(`   - Totale: ${result.upsertedCount + result.modifiedCount}\n`);
    }

  } catch (error) {
    console.error('❌ Errore:', error);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  } finally {
    await client.close();
    console.log('🔌 Connessione chiusa');
  }
}

addTemplateLabelTranslations();

