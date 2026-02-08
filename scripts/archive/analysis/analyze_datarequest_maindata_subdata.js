/**
 * Analizza i task DataRequest (type: 3) in dBFactory per verificare:
 * 1. Se hanno mainData che indica il tipo di dato
 * 2. Se hanno sub-data completi (es. per date: giorno, mese, anno)
 * 3. Identifica task incompleti o malformati
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

// Tipi di dato che dovrebbero avere sub-data specifici
const EXPECTED_SUBDATA = {
  'date': ['day', 'month', 'year', 'giorno', 'mese', 'anno'],
  'data': ['day', 'month', 'year', 'giorno', 'mese', 'anno'],
  'birthDate': ['day', 'month', 'year', 'giorno', 'mese', 'anno'],
  'birthdate': ['day', 'month', 'year', 'giorno', 'mese', 'anno'],
  'dateOfBirth': ['day', 'month', 'year', 'giorno', 'mese', 'anno'],
  'dob': ['day', 'month', 'year', 'giorno', 'mese', 'anno'],
};

function normalizeLabel(label) {
  if (!label) return '';
  return label.toLowerCase().trim();
}

function isDateType(label) {
  const normalized = normalizeLabel(label);
  return normalized.includes('date') || 
         normalized.includes('data') || 
         normalized.includes('nascita') ||
         normalized.includes('birth');
}

function getExpectedSubDataForType(label) {
  if (isDateType(label)) {
    return ['giorno', 'mese', 'anno', 'day', 'month', 'year'];
  }
  return [];
}

function analyzeSubData(mainDataNode) {
  const subData = mainDataNode.subData || [];
  const mainLabel = normalizeLabel(mainDataNode.label || mainDataNode.name || '');
  
  const analysis = {
    hasSubData: subData.length > 0,
    subDataCount: subData.length,
    subDataLabels: subData.map(s => normalizeLabel(s.label || s.name || '')),
    isDateType: isDateType(mainLabel),
    expectedSubData: getExpectedSubDataForType(mainLabel),
    missingSubData: [],
    hasAllExpected: false
  };

  if (analysis.isDateType && analysis.expectedSubData.length > 0) {
    // Verifica se ci sono tutti i sub-data necessari per una data
    const hasGiorno = analysis.subDataLabels.some(l => l.includes('giorno') || l.includes('day'));
    const hasMese = analysis.subDataLabels.some(l => l.includes('mese') || l.includes('month'));
    const hasAnno = analysis.subDataLabels.some(l => l.includes('anno') || l.includes('year'));

    analysis.missingSubData = [];
    if (!hasGiorno) analysis.missingSubData.push('giorno/day');
    if (!hasMese) analysis.missingSubData.push('mese/month');
    if (!hasAnno) analysis.missingSubData.push('anno/year');

    analysis.hasAllExpected = analysis.missingSubData.length === 0;
  } else if (analysis.isDateType) {
    // È una data ma non ha sub-data (dovrebbe averli)
    analysis.missingSubData = ['giorno/day', 'mese/month', 'anno/year'];
    analysis.hasAllExpected = false;
  } else {
    // Non è una data, non ci sono sub-data attesi
    analysis.hasAllExpected = true;
  }

  return analysis;
}

async function analyzeDataRequestTasks() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const factoryDb = client.db(dbFactory);
    const collection = factoryDb.collection('Tasks');

    // Find all type: 3 (DataRequest)
    const allDataRequest = await collection.find({ type: 3 }).toArray();
    console.log(`📋 Found ${allDataRequest.length} tasks with type: 3 (DataRequest)\n`);

    // Categorize
    const tasksWithoutMainData = [];
    const tasksWithMainData = [];
    const tasksWithIncompleteSubData = [];
    const tasksWithCompleteSubData = [];
    const dateTasksWithMissingSubData = [];

    for (const task of allDataRequest) {
      const hasMainData = task.mainData && Array.isArray(task.mainData) && task.mainData.length > 0;

      if (!hasMainData) {
        tasksWithoutMainData.push({
          id: task.id || task._id,
          label: task.label || 'N/A',
          templateId: task.templateId || null,
          hasSteps: !!(task.steps && Object.keys(task.steps).length > 0),
          hasDialogueSteps: !!(task.dialogueSteps && task.dialogueSteps.length > 0),
          hasNlpContract: !!(task.nlpContract),
        });
      } else {
        // Analizza ogni mainData node
        for (const mainDataNode of task.mainData) {
          const subDataAnalysis = analyzeSubData(mainDataNode);
          
          const taskInfo = {
            taskId: task.id || task._id,
            taskLabel: task.label || 'N/A',
            templateId: task.templateId || null,
            mainDataId: mainDataNode.id || 'N/A',
            mainDataLabel: mainDataNode.label || mainDataNode.name || 'N/A',
            subDataAnalysis: subDataAnalysis
          };

          tasksWithMainData.push(taskInfo);

          if (subDataAnalysis.isDateType && !subDataAnalysis.hasAllExpected) {
            dateTasksWithMissingSubData.push(taskInfo);
          }

          if (subDataAnalysis.hasSubData && !subDataAnalysis.hasAllExpected) {
            tasksWithIncompleteSubData.push(taskInfo);
          } else if (subDataAnalysis.hasAllExpected) {
            tasksWithCompleteSubData.push(taskInfo);
          }
        }
      }
    }

    // Report
    console.log('='.repeat(80));
    console.log('📊 ANALISI COMPLETA TASK DATAREQUEST');
    console.log('='.repeat(80));

    console.log(`\n1️⃣  TASK SENZA mainData: ${tasksWithoutMainData.length}`);
    if (tasksWithoutMainData.length > 0) {
      console.log('\n   Questi task NON hanno mainData che indica il tipo di dato:');
      tasksWithoutMainData.slice(0, 10).forEach((task, idx) => {
        console.log(`\n   ${idx + 1}. Task ID: ${task.id}`);
        console.log(`      Label: ${task.label}`);
        console.log(`      TemplateId: ${task.templateId || 'null'}`);
        console.log(`      Has steps: ${task.hasSteps ? 'YES' : 'NO'}`);
        console.log(`      Has dialogueSteps: ${task.hasDialogueSteps ? 'YES' : 'NO'}`);
        console.log(`      Has nlpContract: ${task.hasNlpContract ? 'YES' : 'NO'}`);
      });
      if (tasksWithoutMainData.length > 10) {
        console.log(`\n   ... e altri ${tasksWithoutMainData.length - 10} task`);
      }
    }

    console.log(`\n2️⃣  TASK CON mainData: ${tasksWithMainData.length}`);
    console.log(`   - Con sub-data completi: ${tasksWithCompleteSubData.length}`);
    console.log(`   - Con sub-data incompleti: ${tasksWithIncompleteSubData.length}`);

    console.log(`\n3️⃣  TASK DATE CON SUB-DATA MANCANTI: ${dateTasksWithMissingSubData.length}`);
    if (dateTasksWithMissingSubData.length > 0) {
      console.log('\n   ⚠️  PROBLEMA: Questi task di tipo DATE non hanno tutti i sub-data necessari:');
      dateTasksWithMissingSubData.forEach((task, idx) => {
        console.log(`\n   ${idx + 1}. Task ID: ${task.taskId}`);
        console.log(`      Task Label: ${task.taskLabel}`);
        console.log(`      MainData Label: ${task.mainDataLabel}`);
        console.log(`      MainData ID: ${task.mainDataId}`);
        console.log(`      Sub-data presenti: ${task.subDataAnalysis.subDataCount} (${task.subDataAnalysis.subDataLabels.join(', ')})`);
        console.log(`      Sub-data mancanti: ${task.subDataAnalysis.missingSubData.join(', ')}`);
        console.log(`      ⚠️  Dovrebbe avere: giorno, mese, anno`);
      });
    }

    // Dettaglio task con sub-data incompleti (non solo date)
    if (tasksWithIncompleteSubData.length > 0) {
      console.log(`\n4️⃣  ALTRI TASK CON SUB-DATA INCOMPLETI: ${tasksWithIncompleteSubData.length - dateTasksWithMissingSubData.length}`);
      const nonDateIncomplete = tasksWithIncompleteSubData.filter(t => !t.subDataAnalysis.isDateType);
      if (nonDateIncomplete.length > 0) {
        console.log('\n   Task con sub-data ma struttura incompleta:');
        nonDateIncomplete.slice(0, 5).forEach((task, idx) => {
          console.log(`\n   ${idx + 1}. Task ID: ${task.taskId}`);
          console.log(`      MainData Label: ${task.mainDataLabel}`);
          console.log(`      Sub-data presenti: ${task.subDataAnalysis.subDataCount}`);
          console.log(`      Labels: ${task.subDataAnalysis.subDataLabels.join(', ')}`);
        });
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📋 SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n   Totale task DataRequest: ${allDataRequest.length}`);
    console.log(`   ❌ Senza mainData: ${tasksWithoutMainData.length}`);
    console.log(`   ✅ Con mainData: ${tasksWithMainData.length}`);
    console.log(`   ⚠️  Date con sub-data mancanti: ${dateTasksWithMissingSubData.length}`);
    console.log(`   ⚠️  Altri con sub-data incompleti: ${tasksWithIncompleteSubData.length - dateTasksWithMissingSubData.length}`);
    console.log(`   ✅ Con sub-data completi: ${tasksWithCompleteSubData.length}`);

    // Raccomandazioni
    console.log('\n' + '='.repeat(80));
    console.log('💡 RACCOMANDAZIONI');
    console.log('='.repeat(80));
    console.log('\n   1. Task senza mainData:');
    console.log('      - Aggiungere mainData che indica il tipo di dato da raccogliere');
    console.log('      - Se è una data, creare mainData con sub-data: giorno, mese, anno');
    console.log('\n   2. Task date con sub-data mancanti:');
    console.log('      - Aggiungere i sub-data mancanti (giorno, mese, anno)');
    console.log('      - Ogni sub-data dovrebbe essere un task atomico in dBFactory');
    console.log('\n   3. Verificare che tutti i sub-data siano task atomici in dBFactory');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

if (require.main === module) {
  analyzeDataRequestTasks().catch(console.error);
}

module.exports = { analyzeDataRequestTasks };
