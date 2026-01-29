/**
 * Analizza i task di tipo DataRequest per verificare se hanno DDT completi
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function analyze() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const db = client.db(dbFactory);

    // ===================================
    // 1. ANALIZZA TUTTI I TASKS
    // ===================================
    console.log('📋 Step 1: Analizza tutti i Tasks...\n');

    const allTasks = await db.collection('Tasks').find({}).toArray();
    console.log(`   Tasks totali: ${allTasks.length}\n`);

    // Raggruppa per type
    const tasksByType = {};
    allTasks.forEach(task => {
      const type = task.type !== undefined ? task.type : 'undefined';
      if (!tasksByType[type]) {
        tasksByType[type] = [];
      }
      tasksByType[type].push(task);
    });

    console.log('   Tasks per type:');
    Object.entries(tasksByType).forEach(([type, tasks]) => {
      console.log(`      - Type ${type}: ${tasks.length} tasks`);
    });
    console.log();

    // ===================================
    // 2. ANALIZZA TASK DATAREQUEST (type=3)
    // ===================================
    console.log('='.repeat(70));
    console.log('📋 Step 2: Analizza Task DataRequest (type=3)...\n');

    const dataRequestTasks = allTasks.filter(t => t.type === 3);
    console.log(`   DataRequest tasks: ${dataRequestTasks.length}\n`);

    if (dataRequestTasks.length === 0) {
      console.log('   ⚠️  Nessun task di tipo DataRequest trovato!');
      console.log('   💡 Verifica se i task hanno type definito correttamente\n');
    } else {
      let withMainData = 0;
      let withSteps = 0;
      let withsteps = 0;
      let withFullDDT = 0;

      const examples = [];

      for (const task of dataRequestTasks) {
        let hasMainData = false;
        let hasSteps = false;
        let hassteps = false;

        // Verifica mainData
        if (task.mainData && Array.isArray(task.mainData) && task.mainData.length > 0) {
          hasMainData = true;
          withMainData++;

          // Verifica se mainData ha steps dentro i nodi
          for (const node of task.mainData) {
            if (node.steps && (Array.isArray(node.steps) || (typeof node.steps === 'object' && Object.keys(node.steps || {}).length > 0))) {
              hasSteps = true;
              withSteps++;
              break;
            }
          }
        }

        // Verifica steps a root level
        if (task.steps && (typeof task.steps === 'object' && Object.keys(task.steps || {}).length > 0)) {
          hassteps = true;
          withsteps++;
        }

        // Task con DDT completo
        if (hasMainData && (hasSteps || hassteps)) {
          withFullDDT++;
        }

        // Raccogli esempi
        if (hasMainData || hassteps) {
          examples.push({
            id: task.id,
            label: task.label,
            hasMainData: hasMainData,
            mainDataCount: task.mainData?.length || 0,
            hasSteps: hasSteps,
            hassteps: hassteps,
            stepsKeys: task.steps ? Object.keys(task.steps) : []
          });
        }
      }

      console.log(`   DataRequest con mainData: ${withMainData}/${dataRequestTasks.length}`);
      console.log(`   DataRequest con steps (dentro mainData): ${withSteps}/${dataRequestTasks.length}`);
      console.log(`   DataRequest con steps (root level): ${withsteps}/${dataRequestTasks.length}`);
      console.log(`   DataRequest con DDT completo: ${withFullDDT}/${dataRequestTasks.length}\n`);

      if (examples.length > 0) {
        console.log('   Esempi DataRequest con DDT:');
        examples.slice(0, 5).forEach(ex => {
          console.log(`      - ${ex.id}: ${ex.label || 'N/A'}`);
          console.log(`        mainData: ${ex.hasMainData ? `${ex.mainDataCount} nodi` : 'NO'}`);
          console.log(`        steps: ${ex.hasSteps ? 'Sì' : 'No'}`);
          console.log(`        steps: ${ex.hassteps ? `Sì (${ex.stepsKeys.length} keys)` : 'No'}`);
        });
        console.log();
      } else {
        console.log('   ⚠️  Nessun DataRequest ha mainData o steps!\n');
      }

      // Mostra esempio completo di un DataRequest
      if (dataRequestTasks.length > 0) {
        const sample = dataRequestTasks[0];
        console.log('   Esempio completo primo DataRequest:');
        console.log(`      ID: ${sample.id}`);
        console.log(`      Label: ${sample.label || 'N/A'}`);
        console.log(`      Type: ${sample.type}`);
        console.log(`      TemplateId: ${sample.templateId || 'null'}`);
        console.log(`      Campi presenti: ${Object.keys(sample).join(', ')}`);
        console.log(`      mainData: ${sample.mainData ? (Array.isArray(sample.mainData) ? `${sample.mainData.length} elementi` : typeof sample.mainData) : 'assente'}`);
        console.log(`      steps: ${sample.steps ? (typeof sample.steps === 'object' ? `${Object.keys(sample.steps).length} keys` : typeof sample.steps) : 'assente'}`);
        console.log(`      steps: ${sample.steps ? (typeof sample.steps === 'object' ? `${Object.keys(sample.steps).length} keys` : typeof sample.steps) : 'assente'}`);

        if (sample.mainData && Array.isArray(sample.mainData) && sample.mainData.length > 0) {
          console.log(`      mainData[0] keys: ${Object.keys(sample.mainData[0]).join(', ')}`);
          if (sample.mainData[0].steps) {
            console.log(`      mainData[0].steps: ${typeof sample.mainData[0].steps === 'object' ? `${Object.keys(sample.mainData[0].steps).length} keys` : typeof sample.mainData[0].steps}`);
          }
        }
        console.log();
      }
    }

    // ===================================
    // 3. VERIFICA TASK CON templateId = DataRequest/GetData
    // ===================================
    console.log('='.repeat(70));
    console.log('📋 Step 3: Verifica task con templateId DataRequest/GetData...\n');

    const tasksWithDataRequestTemplateId = allTasks.filter(t => {
      const templateId = (t.templateId || '').toLowerCase();
      return templateId === 'datarequest' || templateId === 'getdata' || templateId === 'data';
    });

    console.log(`   Tasks con templateId DataRequest/GetData: ${tasksWithDataRequestTemplateId.length}\n`);

    if (tasksWithDataRequestTemplateId.length > 0) {
      let withMainData = 0;
      for (const task of tasksWithDataRequestTemplateId) {
        if (task.mainData && Array.isArray(task.mainData) && task.mainData.length > 0) {
          withMainData++;
        }
      }
      console.log(`   Con mainData: ${withMainData}/${tasksWithDataRequestTemplateId.length}\n`);

      // Mostra esempio
      const sample = tasksWithDataRequestTemplateId[0];
      console.log('   Esempio task con templateId DataRequest:');
      console.log(`      ID: ${sample.id}`);
      console.log(`      Type: ${sample.type}`);
      console.log(`      TemplateId: ${sample.templateId}`);
      console.log(`      mainData: ${sample.mainData ? (Array.isArray(sample.mainData) ? `${sample.mainData.length} elementi` : typeof sample.mainData) : 'assente'}`);
      console.log();
    }

    // ===================================
    // 4. VERIFICA TASK CON name/label che contiene "data"
    // ===================================
    console.log('='.repeat(70));
    console.log('📋 Step 4: Verifica task con name/label che contiene "data"...\n');

    const tasksWithDataInName = allTasks.filter(t => {
      const name = (t.name || '').toLowerCase();
      const label = (t.label || '').toLowerCase();
      return name.includes('data') || label.includes('data');
    });

    console.log(`   Tasks con "data" nel nome/label: ${tasksWithDataInName.length}\n`);

    if (tasksWithDataInName.length > 0) {
      let withMainData = 0;
      for (const task of tasksWithDataInName) {
        if (task.mainData && Array.isArray(task.mainData) && task.mainData.length > 0) {
          withMainData++;
        }
      }
      console.log(`   Con mainData: ${withMainData}/${tasksWithDataInName.length}\n`);
    }

    // ===================================
    // 5. CONCLUSIONI
    // ===================================
    console.log('='.repeat(70));
    console.log('📊 CONCLUSIONI');
    console.log('='.repeat(70));

    console.log(`\n1. Tasks totali: ${allTasks.length}`);
    console.log(`2. Tasks DataRequest (type=3): ${dataRequestTasks.length}`);
    console.log(`3. DataRequest con mainData: ${dataRequestTasks.filter(t => t.mainData && Array.isArray(t.mainData) && t.mainData.length > 0).length}`);
    console.log(`4. DataRequest con steps: ${dataRequestTasks.filter(t => t.steps && Object.keys(t.steps || {}).length > 0).length}`);

    if (dataRequestTasks.length > 0 && dataRequestTasks.filter(t => t.mainData && Array.isArray(t.mainData) && t.mainData.length > 0).length === 0) {
      console.log('\n⚠️  PROBLEMA: I task DataRequest NON hanno mainData!');
      console.log('💡 I task di tipo DataRequest dovrebbero avere DDT completi con mainData');
      console.log('💡 Verifica se i DDT sono salvati altrove o se c\'è un problema di migrazione');
    } else if (dataRequestTasks.length > 0) {
      console.log('\n✅ I task DataRequest hanno mainData');
    }

  } catch (error) {
    console.error('❌ Errore:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

if (require.main === module) {
  analyze().catch(console.error);
}

module.exports = { analyze };

