/**
 * Script per trovare i GUID esatti dei subData e verificare se hanno projectId
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB_FACTORY = 'factory';

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

async function findSubDataGuids() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(DB_FACTORY);
    const tasksCollection = db.collection('Tasks');
    const translationsCollection = db.collection('Translations');

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔍 RICERCA GUID SUBDATA E TRADUZIONI');
    console.log('═══════════════════════════════════════════════════════════════\n');

    for (const subDataId of SUBDATA_IDS) {
      const subTemplate = await tasksCollection.findOne({
        $or: [{ id: subDataId }, { _id: subDataId }]
      });

      if (!subTemplate) {
        console.log(`❌ Template ${subDataId} not found\n`);
        continue;
      }

      const subName = subTemplate.label || subTemplate.name || subDataId;
      console.log(`\n📦 Template: ${subName} (${subDataId})`);
      console.log('───────────────────────────────────────────────────────────────');

      const guids = extractAllGuidsFromTemplate(subTemplate);

      for (const guidInfo of guids) {
        const guid = guidInfo.guid;
        const stepType = guidInfo.stepType;

        console.log(`\n   [${stepType}] GUID: ${guid}`);

        // Cerca traduzioni con e senza projectId
        const translations = await translationsCollection.find({
          guid: guid
        }).toArray();

        if (translations.length === 0) {
          console.log(`      ❌ NO TRANSLATIONS FOUND`);
        } else {
          for (const trans of translations) {
            const projectInfo = trans.projectId ? ` (projectId: ${trans.projectId})` : ' (Factory)';
            console.log(`      ${trans.language.toUpperCase()}: "${trans.text}"${projectInfo}`);
          }
        }
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

findSubDataGuids().catch(console.error);
