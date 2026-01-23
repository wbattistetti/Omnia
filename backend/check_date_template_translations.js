/**
 * Script per verificare le traduzioni dei prompt del template Date e subData
 * Verifica se ci sono mescolanze italiano/inglese nel database Factory
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB_FACTORY = 'factory';

// Template ID del template Date
const DATE_TEMPLATE_ID = '723a1aa9-a904-4b55-82f3-a501dfbe0351';

// SubData IDs attesi (Day, Month, Year)
const SUBDATA_IDS = [
  '879ad4a5-dc07-4ee0-809a-e37acb0cb91f', // Day
  'f4dc80fd-3d3b-424c-9f05-0fe1e4130e1f', // Month
  '3f7c43bf-23c5-4328-bb71-938cd8ea7ad7'  // Year
];

/**
 * Estrae tutti i GUID dei prompt da uno step
 */
function extractGuidsFromStep(step, stepType) {
  const guids = [];

  if (!step || !step.escalations || !Array.isArray(step.escalations)) {
    return guids;
  }

  for (const esc of step.escalations) {
    if (!esc.tasks || !Array.isArray(esc.tasks)) continue;

    for (const task of esc.tasks) {
      if (!task.parameters || !Array.isArray(task.parameters)) continue;

      const textParam = task.parameters.find(p => p.parameterId === 'text');
      if (textParam) {
        const guid = textParam.value || textParam.textKey;
        if (guid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guid)) {
          guids.push({
            guid,
            stepType,
            taskId: task.taskId || task.id
          });
        }
      }
    }
  }

  return guids;
}

/**
 * Estrae tutti i GUID da un template
 */
function extractAllGuidsFromTemplate(template, templateName) {
  const allGuids = [];

  if (!template.steps || typeof template.steps !== 'object') {
    return allGuids;
  }

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

/**
 * Verifica se un testo è in italiano, inglese o misto
 */
function detectLanguage(text) {
  if (!text || typeof text !== 'string') return 'unknown';

  const textLower = text.toLowerCase();

  // Pattern italiani comuni
  const italianPatterns = [
    /\b(qual|quale|quando|dove|come|perché|perchè|chi|cosa)\b/i,
    /\b(è|sono|hai|ho|ha|hanno)\b/i,
    /\b(tuo|tua|tuoi|tue|nostro|nostra)\b/i,
    /\b(data|giorno|mese|anno|nascita|paziente)\b/i
  ];

  // Pattern inglesi comuni
  const englishPatterns = [
    /\b(what|when|where|how|why|who|which)\b/i,
    /\b(is|are|have|has|had|do|does|did)\b/i,
    /\b(your|you|we|our|their|the)\b/i,
    /\b(date|day|month|year|birth|patient)\b/i
  ];

  const hasItalian = italianPatterns.some(p => p.test(text));
  const hasEnglish = englishPatterns.some(p => p.test(text));

  if (hasItalian && hasEnglish) return 'mixed';
  if (hasItalian) return 'it';
  if (hasEnglish) return 'en';
  return 'unknown';
}

/**
 * Main function
 */
async function checkDateTemplateTranslations() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(DB_FACTORY);
    const tasksCollection = db.collection('Tasks');
    const translationsCollection = db.collection('Translations');

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
      return;
    }

    console.log('✅ Date template found!\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🌐 VERIFICA TRADUZIONI - Template Date e SubData');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Estrai GUID dal template Date
    console.log('📅 MAIN TEMPLATE: Date');
    console.log('───────────────────────────────────────────────────────────────');
    const dateGuids = extractAllGuidsFromTemplate(dateTemplate, 'Date');
    console.log(`   Found ${dateGuids.length} prompt GUIDs in Date template`);

    // Estrai GUID dai subData
    const allGuids = [...dateGuids];
    const templateMap = new Map();
    templateMap.set(DATE_TEMPLATE_ID, { name: 'Date', guids: dateGuids });

    for (const subDataId of SUBDATA_IDS) {
      const subTemplate = await tasksCollection.findOne({
        $or: [
          { id: subDataId },
          { _id: subDataId }
        ]
      });

      if (subTemplate) {
        const subName = subTemplate.label || subTemplate.name || subDataId;
        const subGuids = extractAllGuidsFromTemplate(subTemplate, subName);
        console.log(`\n📦 SUBDATA: ${subName}`);
        console.log(`   Found ${subGuids.length} prompt GUIDs`);
        allGuids.push(...subGuids);
        templateMap.set(subDataId, { name: subName, guids: subGuids });
      }
    }

    // Carica tutte le traduzioni
    const uniqueGuids = [...new Set(allGuids.map(g => g.guid))];
    console.log(`\n🔍 Loading translations for ${uniqueGuids.length} unique GUIDs...`);

    const translations = await translationsCollection.find({
      guid: { $in: uniqueGuids },
      $or: [
        { projectId: null },
        { projectId: { $exists: false } }
      ]
    }).toArray();

    console.log(`   Found ${translations.length} translations in Factory database\n`);

    // Organizza traduzioni per GUID e lingua
    const translationsByGuid = new Map();
    for (const trans of translations) {
      if (!translationsByGuid.has(trans.guid)) {
        translationsByGuid.set(trans.guid, {});
      }
      const guidTrans = translationsByGuid.get(trans.guid);
      guidTrans[trans.language] = trans.text;
    }

    // Analizza ogni template
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 ANALISI TRADUZIONI');
    console.log('═══════════════════════════════════════════════════════════════\n');

    let totalIssues = 0;

    for (const [templateId, templateInfo] of templateMap.entries()) {
      console.log(`\n📋 Template: ${templateInfo.name} (${templateId.substring(0, 20)}...)`);
      console.log('───────────────────────────────────────────────────────────────');

      const issues = [];
      const langStats = { it: 0, en: 0, pt: 0, mixed: 0, missing: 0 };

      for (const guidInfo of templateInfo.guids) {
        const guid = guidInfo.guid;
        const stepType = guidInfo.stepType;
        const trans = translationsByGuid.get(guid);

        if (!trans || Object.keys(trans).length === 0) {
          langStats.missing++;
          issues.push({
            guid: guid.substring(0, 20) + '...',
            stepType,
            issue: 'NO TRANSLATION FOUND',
            text: 'N/A'
          });
          continue;
        }

        // Verifica traduzione italiana (priorità)
        const itText = trans.it || trans['it'] || '';
        const enText = trans.en || '';
        const ptText = trans.pt || '';

        if (itText) {
          const detected = detectLanguage(itText);
          langStats[detected] = (langStats[detected] || 0) + 1;

          if (detected === 'mixed') {
            issues.push({
              guid: guid.substring(0, 20) + '...',
              stepType,
              issue: 'MIXED ITALIAN/ENGLISH',
              text: itText.substring(0, 60) + (itText.length > 60 ? '...' : ''),
              detected
            });
          } else if (detected === 'en') {
            issues.push({
              guid: guid.substring(0, 20) + '...',
              stepType,
              issue: 'ITALIAN TRANSLATION IS ENGLISH',
              text: itText.substring(0, 60) + (itText.length > 60 ? '...' : ''),
              detected
            });
          }
        } else if (enText) {
          langStats.en++;
          issues.push({
            guid: guid.substring(0, 20) + '...',
            stepType,
            issue: 'NO ITALIAN TRANSLATION (only English)',
            text: enText.substring(0, 60) + (enText.length > 60 ? '...' : ''),
            detected: 'en'
          });
        } else {
          langStats.missing++;
        }
      }

      // Statistiche
      console.log(`   📊 Statistics:`);
      console.log(`      Italian: ${langStats.it}`);
      console.log(`      English: ${langStats.en}`);
      console.log(`      Portuguese: ${langStats.pt}`);
      console.log(`      Mixed: ${langStats.mixed}`);
      console.log(`      Missing: ${langStats.missing}`);

      // Problemi
      if (issues.length > 0) {
        console.log(`\n   ⚠️  Issues found (${issues.length}):`);
        for (const issue of issues) {
          console.log(`      [${issue.stepType}] ${issue.issue}`);
          console.log(`         GUID: ${issue.guid}`);
          console.log(`         Text: "${issue.text}"`);
          if (issue.detected) {
            console.log(`         Detected language: ${issue.detected}`);
          }
        }
        totalIssues += issues.length;
      } else {
        console.log(`\n   ✅ No issues found - all translations are correct`);
      }
    }

    // Report finale
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`\n   Total GUIDs checked: ${uniqueGuids.length}`);
    console.log(`   Total translations found: ${translations.length}`);
    console.log(`   Total issues found: ${totalIssues}`);

    if (totalIssues === 0) {
      console.log('\n   ✅ ALL TRANSLATIONS ARE CORRECT (no Italian/English mix)');
    } else {
      console.log('\n   ⚠️  SOME TRANSLATIONS HAVE ISSUES (check details above)');
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
checkDateTemplateTranslations().catch(console.error);
