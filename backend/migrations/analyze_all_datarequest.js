/**
 * Analizza tutti i task DataRequest per capire perché solo 3 hanno mainData
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function analyzeAllDataRequest() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const factoryDb = client.db(dbFactory);
    const collection = factoryDb.collection('Tasks');

    // Find all type: 3
    const allDataRequest = await collection.find({ type: 3 }).toArray();
    console.log(`📋 Found ${allDataRequest.length} tasks with type: 3\n`);

    // Categorize
    const withMainData = [];
    const withoutMainData = [];
    const withSteps = [];
    const withDialogueSteps = [];
    const withNlpContract = [];
    const withConstraints = [];

    for (const task of allDataRequest) {
      const hasMainData = task.mainData && Array.isArray(task.mainData) && task.mainData.length > 0;
      const hasSteps = task.steps && typeof task.steps === 'object' && Object.keys(task.steps).length > 0;
      const hasDialogueSteps = task.dialogueSteps && Array.isArray(task.dialogueSteps) && task.dialogueSteps.length > 0;
      const hasNlpContract = task.nlpContract && typeof task.nlpContract === 'object';
      const hasConstraints = task.constraints && Array.isArray(task.constraints) && task.constraints.length > 0;

      if (hasMainData) {
        withMainData.push(task);
      } else {
        withoutMainData.push(task);
      }

      if (hasSteps) withSteps.push(task);
      if (hasDialogueSteps) withDialogueSteps.push(task);
      if (hasNlpContract) withNlpContract.push(task);
      if (hasConstraints) withConstraints.push(task);
    }

    console.log('='.repeat(70));
    console.log('📊 CATEGORIZATION');
    console.log('='.repeat(70));
    console.log(`  With mainData: ${withMainData.length}`);
    console.log(`  Without mainData: ${withoutMainData.length}`);
    console.log(`  With steps (root): ${withSteps.length}`);
    console.log(`  With dialogueSteps: ${withDialogueSteps.length}`);
    console.log(`  With nlpContract (root): ${withNlpContract.length}`);
    console.log(`  With constraints (root): ${withConstraints.length}`);

    // Analyze tasks without mainData
    if (withoutMainData.length > 0) {
      console.log(`\n📋 Analyzing ${withoutMainData.length} tasks WITHOUT mainData:`);
      
      const sample = withoutMainData[0];
      console.log(`\n  Sample task:`);
      console.log(`    ID: ${sample.id || sample._id}`);
      console.log(`    Label: ${sample.label || 'N/A'}`);
      console.log(`    Type: ${sample.type}`);
      console.log(`    TemplateId: ${sample.templateId || 'null'}`);
      console.log(`    Has steps: ${sample.steps ? 'YES' : 'NO'}`);
      console.log(`    Has dialogueSteps: ${sample.dialogueSteps ? 'YES' : 'NO'}`);
      console.log(`    Has nlpContract: ${sample.nlpContract ? 'YES' : 'NO'}`);
      console.log(`    Has constraints: ${sample.constraints ? 'YES' : 'NO'}`);
      console.log(`    All keys: ${Object.keys(sample).join(', ')}`);

      // Check if they have steps at root level
      if (sample.steps) {
        console.log(`\n    Steps structure:`);
        console.log(`      Type: ${typeof sample.steps}`);
        if (typeof sample.steps === 'object') {
          console.log(`      Keys: ${Object.keys(sample.steps).join(', ')}`);
          const firstStep = sample.steps[Object.keys(sample.steps)[0]];
          if (firstStep) {
            console.log(`      First step has escalations: ${firstStep.escalations ? 'YES' : 'NO'}`);
          }
        }
      }
    }

    // Analyze tasks with mainData
    if (withMainData.length > 0) {
      console.log(`\n📋 Analyzing ${withMainData.length} tasks WITH mainData:`);
      
      for (const task of withMainData) {
        console.log(`\n  Task: ${task.id || task._id}`);
        console.log(`    Label: ${task.label || 'N/A'}`);
        console.log(`    TemplateId: ${task.templateId || 'null'}`);
        console.log(`    MainData nodes: ${task.mainData?.length || 0}`);
        
        if (task.mainData && task.mainData.length > 0) {
          const firstMain = task.mainData[0];
          console.log(`    MainData[0]:`);
          console.log(`      ID: ${firstMain.id || 'N/A'}`);
          console.log(`      Label: ${firstMain.label || 'N/A'}`);
          console.log(`      Has steps: ${firstMain.steps ? 'YES' : 'NO'}`);
          console.log(`      Has constraints: ${firstMain.constraints ? 'YES' : 'NO'}`);
          console.log(`      Has nlpContract: ${firstMain.nlpContract ? 'YES' : 'NO'}`);
          console.log(`      Has subData: ${firstMain.subData ? 'YES' : 'NO'}`);
          if (firstMain.subData) {
            console.log(`      SubData count: ${firstMain.subData.length}`);
          }
        }
      }
    }

    // Check if tasks without mainData have steps at root level (legacy format)
    const withoutMainDataButWithSteps = withoutMainData.filter(t => 
      t.steps && typeof t.steps === 'object' && Object.keys(t.steps).length > 0
    );
    
    if (withoutMainDataButWithSteps.length > 0) {
      console.log(`\n⚠️  Found ${withoutMainDataButWithSteps.length} tasks WITHOUT mainData BUT WITH steps (root level)`);
      console.log(`   These might be legacy format or incomplete templates`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

if (require.main === module) {
  analyzeAllDataRequest().catch(console.error);
}

module.exports = { analyzeAllDataRequest };

