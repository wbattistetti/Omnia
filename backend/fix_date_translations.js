/**
 * Script per correggere le traduzioni del template Date e subData con frasi più naturali
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB_FACTORY = 'factory';

const DATE_TEMPLATE_ID = '723a1aa9-a904-4b55-82f3-a501dfbe0351';
const SUBDATA_IDS = [
  '879ad4a5-dc07-4ee0-809a-e37acb0cb91f', // Day
  'f4dc80fd-3d3b-424c-9f05-0fe1e4130e1f', // Month
  '3f7c43bf-23c5-4328-bb71-938cd8ea7ad7'  // Year
];

function extractGuidsFromStep(step, stepType) {
  const guids = [];
  if (!step || !step.escalations || !Array.isArray(step.escalations)) return guids;

  for (const esc of step.escalations) {
    if (!esc.tasks || !Array.isArray(esc.tasks)) continue;
    for (const task of esc.tasks) {
      if (!task.parameters || !Array.isArray(task.parameters)) continue;
      const textParam = task.parameters.find(p => p.parameterId === 'text');
      if (textParam) {
        const guid = textParam.value || textParam.textKey;
        if (guid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guid)) {
          guids.push({ guid, stepType });
        }
      }
    }
  }
  return guids;
}

function extractAllGuidsFromTemplate(template) {
  const allGuids = [];
  if (!template.steps || typeof template.steps !== 'object') return allGuids;

  const stepsKeys = Object.keys(template.steps);
  const isComposite = stepsKeys.some(key => !['start', 'noMatch', 'noInput', 'confirmation', 'notConfirmed', 'success'].includes(key));

  let allSteps = {};
  if (isComposite) {
    const mainNodeId = template.id || template._id;
    allSteps = template.steps[mainNodeId] || template.steps[stepsKeys[0]] || {};
  } else {
    allSteps = template.steps;
  }

  const stepTypes = ['start', 'noMatch', 'noInput', 'confirmation', 'notConfirmed', 'success'];
  for (const stepType of stepTypes) {
    const step = allSteps[stepType];
    if (step) {
      const guids = extractGuidsFromStep(step, stepType);
      allGuids.push(...guids);
    }
  }
  return allGuids;
}

// Traduzioni corrette e naturali
const CORRECT_TRANSLATIONS = {
  // Date template - start
  'a7d37f3b-1db8-4919-8351-e97068edaf6e': {
    it: 'Che data?',
    en: 'What date?',
    pt: 'Que data?'
  },

  // Day template - start
  '7cb578aa-341a-48d0-83a4-80a830543a5b': {
    it: 'Che giorno?',
    en: 'What day?',
    pt: 'Que dia?'
  },

  // Month template - start
  'd1284cbb-e94c-4b09-99aa-7523e1bbbd7e': {
    it: 'Che mese?',
    en: 'What month?',
    pt: 'Que mês?'
  },

  // Year template - start
  'f3fd781a-3d5c-4cfd-ae11-73212ac6f536': {
    it: 'Che anno?',
    en: 'What year?',
    pt: 'Que ano?'
  }
};

async function fixTranslations() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(DB_FACTORY);
    const tasksCollection = db.collection('Tasks');
    const translationsCollection = db.collection('Translations');

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔧 CORREZIONE TRADUZIONI - Template Date e SubData');
    console.log('═══════════════════════════════════════════════════════════════\n');

    let updatedCount = 0;
    let errorCount = 0;

    // Correggi ogni traduzione
    for (const [guid, translations] of Object.entries(CORRECT_TRANSLATIONS)) {
      console.log(`\n🔧 Updating GUID: ${guid.substring(0, 30)}...`);

      for (const [language, text] of Object.entries(translations)) {
        try {
          const result = await translationsCollection.updateOne(
            {
              guid: guid,
              language: language,
              $or: [
                { projectId: null },
                { projectId: { $exists: false } }
              ]
            },
            {
              $set: {
                text: text,
                updatedAt: new Date()
              }
            },
            {
              upsert: false // Non creare se non esiste, solo aggiorna
            }
          );

          if (result.matchedCount > 0) {
            if (result.modifiedCount > 0) {
              console.log(`   ✅ ${language.toUpperCase()}: "${text}" (updated)`);
              updatedCount++;
            } else {
              console.log(`   ⚠️  ${language.toUpperCase()}: Already correct`);
            }
          } else {
            console.log(`   ⚠️  ${language.toUpperCase()}: Translation not found (may be project-specific)`);
          }
        } catch (error) {
          console.error(`   ❌ ${language.toUpperCase()}: Error - ${error.message}`);
          errorCount++;
        }
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`\n   Translations updated: ${updatedCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Total GUIDs processed: ${Object.keys(CORRECT_TRANSLATIONS).length}`);
    console.log('\n═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('🔌 Connection closed');
  }
}

fixTranslations().catch(console.error);
