/**
 * Conta tutti i task DataRequest nel database
 * Verifica query e cerca in tutti i modi possibili
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function countDataRequestTasks() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    // Get all databases
    const adminDb = client.db().admin();
    const databases = await adminDb.listDatabases();
    const projectDbs = databases.databases
      .filter(db => db.name.startsWith('project_'))
      .map(db => db.name);

    console.log(`📁 Found ${projectDbs.length} project databases\n`);

    // 1. Factory.Tasks
    console.log('='.repeat(70));
    console.log('🏭 FACTORY.Tasks');
    console.log('='.repeat(70));
    const factoryDb = client.db(dbFactory);
    const factoryCollection = factoryDb.collection('Tasks');

    // Query 1: type: 3
    const type3 = await factoryCollection.find({ type: 3 }).toArray();
    console.log(`\n1. type: 3 → ${type3.length} tasks`);

    // Query 2: mainData exists
    const withMainData = await factoryCollection.find({ mainData: { $exists: true, $ne: null } }).toArray();
    console.log(`2. mainData exists → ${withMainData.length} tasks`);

    // Query 3: type: 3 AND mainData exists
    const type3WithMainData = await factoryCollection.find({ 
      type: 3, 
      mainData: { $exists: true, $ne: null } 
    }).toArray();
    console.log(`3. type: 3 AND mainData exists → ${type3WithMainData.length} tasks`);

    // Query 4: templateId contains "DataRequest" or "GetData"
    const dataRequestTemplateId = await factoryCollection.find({
      $or: [
        { templateId: 'DataRequest' },
        { templateId: 'GetData' },
        { templateId: /DataRequest/i },
        { templateId: /GetData/i }
      ]
    }).toArray();
    console.log(`4. templateId contains "DataRequest" or "GetData" → ${dataRequestTemplateId.length} tasks`);

    // Query 5: All tasks with mainData (any type)
    console.log(`\n5. All tasks with mainData (any type):`);
    const allWithMainData = await factoryCollection.find({ 
      mainData: { $exists: true, $ne: null } 
    }).toArray();
    
    const typeBreakdown = {};
    for (const task of allWithMainData) {
      const type = task.type !== undefined ? task.type : 'undefined';
      typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;
    }
    console.log(`   Type breakdown:`, typeBreakdown);

    // Show sample tasks
    if (type3WithMainData.length > 0) {
      console.log(`\n📋 Sample task (type: 3, with mainData):`);
      const sample = type3WithMainData[0];
      console.log(`   ID: ${sample.id || sample._id}`);
      console.log(`   Label: ${sample.label || 'N/A'}`);
      console.log(`   Type: ${sample.type}`);
      console.log(`   TemplateId: ${sample.templateId || 'null'}`);
      console.log(`   MainData length: ${sample.mainData?.length || 0}`);
      console.log(`   Has dialogueSteps: ${sample.dialogueSteps ? 'YES' : 'NO'}`);
      console.log(`   Has nested steps: ${sample.mainData?.some(m => m.steps) ? 'YES' : 'NO'}`);
    }

    // 2. Project databases
    console.log('\n' + '='.repeat(70));
    console.log('📁 PROJECT DATABASES');
    console.log('='.repeat(70));

    let totalProjects = 0;
    let totalType3 = 0;
    let totalWithMainData = 0;
    let totalType3WithMainData = 0;

    for (const dbName of projectDbs) {
      const projectDb = client.db(dbName);
      const projectCollection = projectDb.collection('tasks');

      const projectType3 = await projectCollection.find({ type: 3 }).toArray();
      const projectWithMainData = await projectCollection.find({ mainData: { $exists: true, $ne: null } }).toArray();
      const projectType3WithMainData = await projectCollection.find({ 
        type: 3, 
        mainData: { $exists: true, $ne: null } 
      }).toArray();

      if (projectType3.length > 0 || projectWithMainData.length > 0) {
        console.log(`\n  ${dbName}:`);
        console.log(`    type: 3 → ${projectType3.length}`);
        console.log(`    mainData exists → ${projectWithMainData.length}`);
        console.log(`    type: 3 AND mainData → ${projectType3WithMainData.length}`);

        totalProjects++;
        totalType3 += projectType3.length;
        totalWithMainData += projectWithMainData.length;
        totalType3WithMainData += projectType3WithMainData.length;
      }
    }

    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 FINAL SUMMARY');
    console.log('='.repeat(70));
    console.log(`\n🏭 FACTORY:`);
    console.log(`  type: 3 → ${type3.length}`);
    console.log(`  mainData exists → ${withMainData.length}`);
    console.log(`  type: 3 AND mainData → ${type3WithMainData.length}`);
    console.log(`  templateId DataRequest/GetData → ${dataRequestTemplateId.length}`);
    
    console.log(`\n📁 PROJECTS:`);
    console.log(`  Databases with tasks: ${totalProjects}`);
    console.log(`  Total type: 3 → ${totalType3}`);
    console.log(`  Total mainData exists → ${totalWithMainData}`);
    console.log(`  Total type: 3 AND mainData → ${totalType3WithMainData}`);

    console.log(`\n💡 TOTAL DataRequest tasks to migrate:`);
    console.log(`  Factory: ${type3WithMainData.length}`);
    console.log(`  Projects: ${totalType3WithMainData}`);
    console.log(`  GRAND TOTAL: ${type3WithMainData.length + totalType3WithMainData}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

if (require.main === module) {
  countDataRequestTasks().catch(console.error);
}

module.exports = { countDataRequestTasks };

