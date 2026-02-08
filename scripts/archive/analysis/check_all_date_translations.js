/**
 * Script per verificare TUTTE le traduzioni (it, en, pt) dei prompt del template Date e subData
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

async function checkAllTranslations() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(DB_FACTORY);
    const tasksCollection = db.collection('Tasks');
    const translationsCollection = db.collection('Translations');

    // Carica template Date
    const dateTemplate = await tasksCollection.findOne({
      $or: [
        { id: DATE_TEMPLATE_ID },
        { _id: DATE_TEMPLATE_ID }
      ]
    });

    if (!dateTemplate) {
      console.log('❌ Date template not found!');
      return;
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🌐 VERIFICA COMPLETA TRADUZIONI (IT, EN, PT)');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const templateMap = new Map();

    // Date template
    const dateGuids = extractAllGuidsFromTemplate(dateTemplate);
    templateMap.set(DATE_TEMPLATE_ID, { name: 'Date', guids: dateGuids });

    // SubData templates
    for (const subDataId of SUBDATA_IDS) {
      const subTemplate = await tasksCollection.findOne({
        $or: [{ id: subDataId }, { _id: subDataId }]
      });
      if (subTemplate) {
        const subName = subTemplate.label || subTemplate.name || subDataId;
        const subGuids = extractAllGuidsFromTemplate(subTemplate);
        templateMap.set(subDataId, { name: subName, guids: subGuids });
      }
    }

    // Raccogli tutti i GUID
    const allGuids = [];
    for (const [_, info] of templateMap.entries()) {
      allGuids.push(...info.guids.map(g => g.guid));
    }
    const uniqueGuids = [...new Set(allGuids)];

    // Carica tutte le traduzioni
    const translations = await translationsCollection.find({
      guid: { $in: uniqueGuids },
      $or: [
        { projectId: null },
        { projectId: { $exists: false } }
      ]
    }).toArray();

    // Organizza per GUID
    const translationsByGuid = new Map();
    for (const trans of translations) {
      if (!translationsByGuid.has(trans.guid)) {
        translationsByGuid.set(trans.guid, {});
      }
      translationsByGuid.get(trans.guid)[trans.language] = trans.text;
    }

    // Mostra tutte le traduzioni
    for (const [templateId, templateInfo] of templateMap.entries()) {
      console.log(`\n📋 Template: ${templateInfo.name}`);
      console.log('───────────────────────────────────────────────────────────────');

      for (const guidInfo of templateInfo.guids) {
        const guid = guidInfo.guid;
        const stepType = guidInfo.stepType;
        const trans = translationsByGuid.get(guid) || {};

        console.log(`\n   [${stepType}] GUID: ${guid.substring(0, 30)}...`);
        console.log(`      IT: "${trans.it || trans['it'] || '❌ MISSING'}"`);
        console.log(`      EN: "${trans.en || '❌ MISSING'}"`);
        console.log(`      PT: "${trans.pt || '❌ MISSING'}"`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkAllTranslations().catch(console.error);
