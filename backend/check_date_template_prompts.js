/**
 * Script per verificare se il template Date ha tutti i prompt per tutti gli steps
 * inclusi i subData atomici referenziati (Day, Month, Year)
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB_FACTORY = 'factory';

// Step types richiesti
const REQUIRED_STEP_TYPES = ['start', 'noMatch', 'noInput', 'confirmation', 'notConfirmed', 'success'];

// Template ID del template Date (dal codice)
const DATE_TEMPLATE_ID = '723a1aa9-a904-4b55-82f3-a501dfbe0351';

// SubData IDs attesi (Day, Month, Year)
const SUBDATA_IDS = [
  '879ad4a5-dc07-4ee0-809a-e37acb0cb91f', // Day
  'f4dc80fd-3d3b-424c-9f05-0fe1e4130e1f', // Month
  '3f7c43bf-23c5-4328-bb71-938cd8ea7ad7'  // Year
];

/**
 * Verifica se uno step ha prompt (textKey o value nei tasks)
 */
function hasPromptsInStep(step) {
  if (!step || !step.escalations || !Array.isArray(step.escalations)) {
    return false;
  }

  return step.escalations.some(esc => {
    if (!esc.tasks || !Array.isArray(esc.tasks)) {
      return false;
    }

    return esc.tasks.some(task => {
      if (!task.parameters || !Array.isArray(task.parameters)) {
        return false;
      }

      // Cerca un parametro 'text' con textKey o value
      const textParam = task.parameters.find(p => p.parameterId === 'text');
      return textParam && (textParam.textKey || textParam.value);
    });
  });
}

/**
 * Verifica tutti gli steps di un template
 */
function checkTemplateSteps(template, templateName) {
  console.log(`\n📋 Checking template: ${templateName}`);
  console.log(`   ID: ${template.id || template._id}`);
  console.log(`   Label: ${template.label || template.name || 'N/A'}`);

  // Verifica se ha steps
  if (!template.steps || typeof template.steps !== 'object') {
    console.log(`   ❌ NO STEPS FOUND`);
    return { hasSteps: false, missingSteps: REQUIRED_STEP_TYPES, hasPrompts: false };
  }

  const stepsKeys = Object.keys(template.steps);
  console.log(`   ✅ Has steps object with ${stepsKeys.length} keys: ${stepsKeys.join(', ')}`);

  // Verifica struttura steps
  // Può essere:
  // 1. template.steps = { start: {...}, noMatch: {...}, ... } (template atomico)
  // 2. template.steps = { "nodeId": { start: {...}, ... }, ... } (template composito)

  let allSteps = {};
  const isComposite = stepsKeys.some(key => !REQUIRED_STEP_TYPES.includes(key));

  if (isComposite) {
    // Template composito: steps organizzati per nodeId
    console.log(`   📦 Composite template structure (steps per nodeId)`);

    // Per il template Date, gli steps dovrebbero essere per il nodeId principale
    // Cerca il nodeId che corrisponde al template stesso
    const mainNodeId = template.id || template._id;
    const mainSteps = template.steps[mainNodeId];

    if (mainSteps) {
      allSteps = mainSteps;
      console.log(`   ✅ Found steps for main node: ${mainNodeId}`);
    } else {
      // Prova con il primo nodeId disponibile
      const firstNodeId = stepsKeys[0];
      allSteps = template.steps[firstNodeId];
      console.log(`   ⚠️  Main node steps not found, using first nodeId: ${firstNodeId}`);
    }
  } else {
    // Template atomico: steps direttamente in template.steps
    console.log(`   🔹 Atomic template structure (steps at root)`);
    allSteps = template.steps;
  }

  // Verifica ogni step type richiesto
  const missingSteps = [];
  const stepsWithPrompts = [];
  const stepsWithoutPrompts = [];

  for (const stepType of REQUIRED_STEP_TYPES) {
    const step = allSteps[stepType];

    if (!step) {
      missingSteps.push(stepType);
      console.log(`   ❌ Missing step: ${stepType}`);
    } else {
      const hasPrompts = hasPromptsInStep(step);
      if (hasPrompts) {
        stepsWithPrompts.push(stepType);
        console.log(`   ✅ Step ${stepType}: HAS prompts`);
      } else {
        stepsWithoutPrompts.push(stepType);
        console.log(`   ⚠️  Step ${stepType}: NO prompts found`);
      }
    }
  }

  return {
    hasSteps: true,
    missingSteps,
    stepsWithPrompts,
    stepsWithoutPrompts,
    hasPrompts: stepsWithoutPrompts.length === 0 && missingSteps.length === 0
  };
}

/**
 * Verifica subData referenziati
 */
async function checkSubDataTemplates(db, subDataIds) {
  const tasksCollection = db.collection('Tasks');
  const results = [];

  for (const subDataId of subDataIds) {
    console.log(`\n🔍 Checking subData template: ${subDataId}`);

    const subTemplate = await tasksCollection.findOne({
      $or: [
        { id: subDataId },
        { _id: subDataId }
      ]
    });

    if (!subTemplate) {
      console.log(`   ❌ Template not found in database`);
      results.push({ id: subDataId, found: false });
      continue;
    }

    const subTemplateName = subTemplate.label || subTemplate.name || subDataId;
    const checkResult = checkTemplateSteps(subTemplate, subTemplateName);
    results.push({
      id: subDataId,
      name: subTemplateName,
      found: true,
      ...checkResult
    });
  }

  return results;
}

/**
 * Main function
 */
async function checkDateTemplate() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(DB_FACTORY);
    const tasksCollection = db.collection('Tasks');

    // Cerca il template Date
    console.log('🔍 Searching for Date template...');
    const dateTemplate = await tasksCollection.findOne({
      $or: [
        { id: DATE_TEMPLATE_ID },
        { _id: DATE_TEMPLATE_ID },
        { name: 'Date' },
        { label: 'Date' }
      ]
    });

    if (!dateTemplate) {
      console.log('❌ Date template not found!');
      console.log('   Searched for:');
      console.log(`   - id: ${DATE_TEMPLATE_ID}`);
      console.log(`   - name: Date`);
      console.log(`   - label: Date`);

      // Lista tutti i template disponibili
      console.log('\n📋 Available templates:');
      const allTemplates = await tasksCollection.find({
        type: 3 // DataRequest
      }).limit(20).toArray();

      allTemplates.forEach(t => {
        console.log(`   - ${t.label || t.name || t.id} (id: ${t.id || t._id})`);
      });

      return;
    }

    console.log('✅ Date template found!\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📅 MAIN TEMPLATE: Date');
    console.log('═══════════════════════════════════════════════════════════════');

    // Verifica steps del template principale
    const mainResult = checkTemplateSteps(dateTemplate, 'Date');

    // Verifica subData referenziati
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📦 SUBDATA TEMPLATES');
    console.log('═══════════════════════════════════════════════════════════════');

    // Estrai subDataIds dal template se disponibili
    let subDataIdsToCheck = SUBDATA_IDS;
    if (dateTemplate.subDataIds && Array.isArray(dateTemplate.subDataIds)) {
      subDataIdsToCheck = dateTemplate.subDataIds;
      console.log(`\n📋 Found ${subDataIdsToCheck.length} subData references in template`);
    } else if (dateTemplate.data && Array.isArray(dateTemplate.data) && dateTemplate.data.length > 0) {
      // Estrai subData IDs da data[0].subData
      const firstMain = dateTemplate.data[0];
      if (firstMain.subData && Array.isArray(firstMain.subData)) {
        subDataIdsToCheck = firstMain.subData
          .map(sub => sub.id || sub.templateId)
          .filter(Boolean);
        console.log(`\n📋 Found ${subDataIdsToCheck.length} subData in data structure`);
      }
    }

    const subDataResults = await checkSubDataTemplates(db, subDataIdsToCheck);

    // Report finale
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY REPORT');
    console.log('═══════════════════════════════════════════════════════════════');

    console.log('\n📅 Main Template (Date):');
    if (!mainResult.hasSteps) {
      console.log('   ❌ NO STEPS FOUND');
    } else {
      if (mainResult.missingSteps.length > 0) {
        console.log(`   ⚠️  Missing steps: ${mainResult.missingSteps.join(', ')}`);
      }
      if (mainResult.stepsWithoutPrompts.length > 0) {
        console.log(`   ⚠️  Steps without prompts: ${mainResult.stepsWithoutPrompts.join(', ')}`);
      }
      if (mainResult.hasPrompts) {
        console.log('   ✅ ALL STEPS HAVE PROMPTS');
      }
    }

    console.log('\n📦 SubData Templates:');
    subDataResults.forEach((result, idx) => {
      if (!result.found) {
        console.log(`   [${idx + 1}] ${result.id}: ❌ NOT FOUND`);
      } else {
        const status = result.hasPrompts ? '✅' : '⚠️';
        console.log(`   [${idx + 1}] ${result.name || result.id}: ${status}`);
        if (result.missingSteps.length > 0) {
          console.log(`       Missing: ${result.missingSteps.join(', ')}`);
        }
        if (result.stepsWithoutPrompts.length > 0) {
          console.log(`       No prompts: ${result.stepsWithoutPrompts.join(', ')}`);
        }
      }
    });

    // Verifica complessiva
    const allHavePrompts = mainResult.hasPrompts &&
      subDataResults.every(r => r.found && r.hasPrompts);

    console.log('\n═══════════════════════════════════════════════════════════════');
    if (allHavePrompts) {
      console.log('✅ ALL TEMPLATES HAVE COMPLETE PROMPTS');
    } else {
      console.log('⚠️  SOME TEMPLATES ARE MISSING PROMPTS');
    }
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('🔌 Connection closed');
  }
}

// Esegui lo script
checkDateTemplate().catch(console.error);
