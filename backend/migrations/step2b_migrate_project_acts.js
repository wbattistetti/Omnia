/**
 * STEP 2B: Migrate project_acts
 * 
 * Migra AgentActs da project_acts collection in ogni database progetto
 * Copia in task_templates e ddt_library con scope client-specific
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactoryName = 'factory';

/**
 * Mappa mode a built-in templateId
 */
function mapModeToBuiltIn(mode) {
  const mapping = {
    'DataRequest': 'GetData',
    'Message': 'SayMessage',
    'ProblemClassification': 'ClassifyProblem',
    'BackendCall': 'callBackend'
  };
  return mapping[mode] || 'SayMessage';
}

/**
 * Determina type da mode
 */
function mapModeToType(mode) {
  const mapping = {
    'DataRequest': 'DataRequest',
    'Message': 'Message',
    'ProblemClassification': 'ProblemClassification',
    'BackendCall': 'BackendCall'
  };
  return mapping[mode] || 'Message';
}

async function step2b_migrateProjectActs() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');
    
    const adminDb = client.db().admin();
    const dbFactory = client.db(dbFactoryName);
    
    // Lista tutti i database
    const dbList = await adminDb.listDatabases();
    console.log(`📋 Trovati ${dbList.databases.length} database\n`);
    
    let totalProjectsProcessed = 0;
    let totalTemplatesMigrated = 0;
    let totalDDTsMigrated = 0;
    const errors = [];
    
    // Processa ogni database
    for (const dbInfo of dbList.databases) {
      const dbName = dbInfo.name;
      
      // Salta database di sistema e factory
      if (dbName === 'admin' || dbName === 'local' || dbName === 'config' || dbName === dbFactoryName) {
        continue;
      }
      
      // Verifica se ha collection project_acts
      const projectDb = client.db(dbName);
      const collections = await projectDb.listCollections().toArray();
      const hasProjectActs = collections.some(c => c.name === 'project_acts');
      
      if (!hasProjectActs) {
        continue;
      }
      
      const projectActs = await projectDb.collection('project_acts').find({}).toArray();
      const projectActsCount = projectActs.length;
      
      if (projectActsCount === 0) {
        continue;
      }
      
      console.log(`\n📦 Database: ${dbName}`);
      console.log(`   Project Acts trovati: ${projectActsCount}`);
      
      let projectTemplatesMigrated = 0;
      let projectDDTsMigrated = 0;
      
      // Estrai projectId dal nome DB (es: "project_abc" → "abc")
      const projectId = dbName.startsWith('project_') 
        ? dbName.replace('project_', '') 
        : dbName;
      
      for (const act of projectActs) {
        try {
          const actId = act._id || act.id;
          
          // 1. Se ha DDT, copia in ddt_library con scope client
          if (act.ddtSnapshot || act.ddt) {
            const ddtId = `ddt_${actId}`;
            const ddtData = act.ddtSnapshot || act.ddt;
            
            await dbFactory.collection('ddt_library').updateOne(
              { id: ddtId },
              {
                $set: {
                  id: ddtId,
                  label: `DDT: ${act.label || act.name || actId}`,
                  scope: `client:${projectId}`,
                  ddt: ddtData,
                  _originalActId: actId,
                  _originalProject: projectId,
                  _migrationDate: new Date(),
                  _migrationSource: 'project_acts'
                }
              },
              { upsert: true }
            );
            
            projectDDTsMigrated++;
            totalDDTsMigrated++;
          }
          
          // 2. Copia project_act come TaskTemplate con scope client
          const mode = act.mode || 'Message';
          const templateId = mapModeToBuiltIn(mode);
          const type = mapModeToType(mode);
          
          const taskTemplate = {
            id: actId,
            label: act.label || act.name || actId,
            description: act.description || '',
            scope: `client:${projectId}`,
            type: type,
            templateId: templateId,
            category: act.category || null,
            isBuiltIn: false,
            
            // Default value
            defaultValue: (act.ddtSnapshot || act.ddt) 
              ? { ddtId: `ddt_${actId}` } 
              : {},
            
            // Metadata
            _originalActId: actId,
            _originalProject: projectId,
            _migrationDate: new Date(),
            _migrationSource: 'project_acts',
            _originalMode: mode
          };
          
          await dbFactory.collection('task_templates').updateOne(
            { id: actId },
            { $set: taskTemplate },
            { upsert: true }
          );
          
          projectTemplatesMigrated++;
          totalTemplatesMigrated++;
          
        } catch (error) {
          console.error(`   ❌ Errore migrando ${act._id || act.id}:`, error.message);
          errors.push({ 
            project: projectId, 
            actId: act._id || act.id, 
            error: error.message 
          });
        }
      }
      
      console.log(`   ✅ Template migrati: ${projectTemplatesMigrated}`);
      console.log(`   ✅ DDT migrati: ${projectDDTsMigrated}`);
      
      totalProjectsProcessed++;
    }
    
    // Riepilogo finale
    console.log('\n' + '='.repeat(60));
    console.log('📊 RIEPILOGO MIGRAZIONE PROJECT_ACTS');
    console.log('='.repeat(60));
    console.log(`Progetti processati:     ${totalProjectsProcessed}`);
    console.log(`Template migrati:        ${totalTemplatesMigrated}`);
    console.log(`DDT migrati:             ${totalDDTsMigrated}`);
    
    if (errors.length > 0) {
      console.log(`\n⚠️ Errori durante migrazione: ${errors.length}`);
      errors.slice(0, 5).forEach(e => {
        console.log(`   - ${e.project}/${e.actId}: ${e.error}`);
      });
      if (errors.length > 5) {
        console.log(`   ... e altri ${errors.length - 5} errori`);
      }
    }
    
    console.log('='.repeat(60));
    console.log('\n🎉 STEP 2B completato');
    
  } catch (error) {
    console.error('❌ Errore durante STEP 2B:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  step2b_migrateProjectActs()
    .then(() => {
      console.log('\n✅ Script completato');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Script fallito:', error);
      process.exit(1);
    });
}

module.exports = { step2b_migrateProjectActs };





