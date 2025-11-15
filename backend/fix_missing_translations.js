// Script per creare entries vuote per tutti i GUID mancanti
const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function fixMissingTranslations() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const factoryDb = client.db(dbFactory);
    // Template di dati DDT sono in Task_Templates, non type_templates
    const templates = factoryDb.collection('Task_Templates');
    const translations = factoryDb.collection('Translations');

    // Raccogli tutti i GUID dai templates
    console.log('📋 Collecting all GUIDs from templates...\n');

    const allGuids = new Set();
    const allTemplates = await templates.find({}).toArray();

    const collectGuids = (node) => {
      if (node.stepPrompts) {
        Object.values(node.stepPrompts).forEach(keys => {
          if (Array.isArray(keys)) {
            keys.forEach(key => {
              if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) {
                allGuids.add(key);
              }
            });
          }
        });
      }
      if (node.subData && Array.isArray(node.subData)) {
        node.subData.forEach(sub => collectGuids(sub));
      }
    };

    for (const template of allTemplates) {
      if (template.stepPrompts) {
        collectGuids(template);
      }
      if (template.mainData && Array.isArray(template.mainData)) {
        template.mainData.forEach(main => collectGuids(main));
      }
    }

    console.log(`Found ${allGuids.size} unique GUIDs in templates\n`);

    // Verifica quali GUID hanno già translations
    const guidArray = Array.from(allGuids);
    const existingTranslations = await translations.find({
      guid: { $in: guidArray },
      type: 'Template'
    }).toArray();

    const existingGuids = new Set(existingTranslations.map(t => t.guid));
    const missingGuids = guidArray.filter(g => !existingGuids.has(g));

    console.log(`✅ GUIDs with translations: ${existingGuids.size}`);
    console.log(`❌ GUIDs missing translations: ${missingGuids.length}\n`);

    if (missingGuids.length > 0) {
      console.log('📝 Creating empty translations for missing GUIDs...\n');

      const emptyTranslations = [];
      missingGuids.forEach(guid => {
        ['en', 'it', 'pt'].forEach(lang => {
          emptyTranslations.push({
            guid: guid,
            language: lang,
            text: '', // Vuoto - da tradurre manualmente
            projectId: null,
            type: 'Template',
            createdAt: new Date(),
            updatedAt: new Date()
          });
        });
      });

      if (emptyTranslations.length > 0) {
        await translations.insertMany(emptyTranslations, { ordered: false });
        console.log(`✅ Created ${emptyTranslations.length} empty translations for ${missingGuids.length} GUIDs\n`);
        console.log('⚠️  Note: These translations are empty and need to be filled manually.\n');
      }
    } else {
      console.log('✅ All GUIDs already have translations!\n');
    }

    console.log('✅ Fix completed!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

fixMissingTranslations().catch(console.error);







