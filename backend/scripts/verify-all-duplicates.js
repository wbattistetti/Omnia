/**
 * Script di verifica duplicati COMPLETO
 *
 * Verifica duplicati tra:
 * 1. Database Factory (collection 'tasks')
 * 2. Database Projects (collection 'tasks' per ogni progetto)
 * 3. Confronta ID tra Factory e Projects per trovare conflitti
 */

const { MongoClient } = require('mongodb');

// MongoDB connection string
const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';
const dbProjects = 'Projects';

async function verifyAllDuplicates() {
  let client;

  try {
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('🔍 VERIFICA DUPLICATI COMPLETA: Factory + Projects');
    console.log('═══════════════════════════════════════════════════════════════════════════\n');

    console.log('🔌 Connessione a MongoDB...');
    client = new MongoClient(uri);
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    // ✅ 1. Carica template Factory
    console.log('📦 Caricamento template Factory...');
    const factoryDb = client.db(dbFactory);
    const factoryTemplates = await factoryDb.collection('tasks').find({}).toArray();
    console.log(`✅ Caricati ${factoryTemplates.length} template Factory\n`);

    // ✅ 2. Carica template Projects
    console.log('📦 Caricamento template Projects...');
    const projectsDb = client.db(dbProjects);
    const projectCollections = await projectsDb.listCollections().toArray();

    const allProjectTemplates = [];
    const projectTemplatesByProject = new Map();

    for (const coll of projectCollections) {
      if (coll.name === 'tasks') {
        // Collection 'tasks' a root level
        const templates = await projectsDb.collection('tasks').find({}).toArray();
        allProjectTemplates.push(...templates);
        projectTemplatesByProject.set('root', templates);
        console.log(`   ✅ Root 'tasks': ${templates.length} template`);
      } else {
        // Collection 'tasks' dentro un progetto
        try {
          const projectDb = client.db(coll.name);
          const templates = await projectDb.collection('tasks').find({}).toArray();
          if (templates.length > 0) {
            allProjectTemplates.push(...templates);
            projectTemplatesByProject.set(coll.name, templates);
            console.log(`   ✅ Project '${coll.name}': ${templates.length} template`);
          }
        } catch (err) {
          // Ignora errori per collection che non sono database
        }
      }
    }

    console.log(`✅ Totale template Projects: ${allProjectTemplates.length}\n`);

    // ✅ 3. Verifica duplicati INTERNI a Factory
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('🔍 VERIFICA: Duplicati INTERNI Factory');
    console.log('═══════════════════════════════════════════════════════════════════════════\n');

    const factoryIdMap = new Map();
    factoryTemplates.forEach(t => {
      const id = t.id || t._id?.toString();
      if (id) {
        if (!factoryIdMap.has(id)) {
          factoryIdMap.set(id, []);
        }
        factoryIdMap.get(id).push(t);
      }
    });

    const factoryDuplicates = Array.from(factoryIdMap.entries()).filter(([id, templates]) => templates.length > 1);
    if (factoryDuplicates.length > 0) {
      console.error(`🔴 Duplicati Factory: ${factoryDuplicates.length}\n`);
      factoryDuplicates.forEach(([id, templates]) => {
        console.error(`   ID: ${id} (${templates.length} volte)`);
      });
    } else {
      console.log('✅ Nessun duplicato interno in Factory\n');
    }

    // ✅ 4. Verifica duplicati INTERNI a Projects
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('🔍 VERIFICA: Duplicati INTERNI Projects');
    console.log('═══════════════════════════════════════════════════════════════════════════\n');

    const projectIdMap = new Map();
    allProjectTemplates.forEach(t => {
      const id = t.id || t._id?.toString();
      if (id) {
        if (!projectIdMap.has(id)) {
          projectIdMap.set(id, []);
        }
        projectIdMap.get(id).push(t);
      }
    });

    const projectDuplicates = Array.from(projectIdMap.entries()).filter(([id, templates]) => templates.length > 1);
    if (projectDuplicates.length > 0) {
      console.error(`🔴 Duplicati Projects: ${projectDuplicates.length}\n`);
      projectDuplicates.forEach(([id, templates]) => {
        console.error(`   ID: ${id} (${templates.length} volte)`);
        templates.forEach((t, idx) => {
          console.error(`      [${idx + 1}] name=${t.name || t.label || 'N/A'}, type=${t.type || 'N/A'}`);
        });
      });
    } else {
      console.log('✅ Nessun duplicato interno in Projects\n');
    }

    // ✅ 5. Verifica CONFLITTI tra Factory e Projects (stesso ID)
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('🔍 VERIFICA: Conflitti Factory ↔ Projects (stesso ID)');
    console.log('═══════════════════════════════════════════════════════════════════════════\n');

    const factoryIds = new Set();
    factoryTemplates.forEach(t => {
      const id = t.id || t._id?.toString();
      if (id) factoryIds.add(id);
    });

    const conflicts = [];
    allProjectTemplates.forEach(t => {
      const id = t.id || t._id?.toString();
      if (id && factoryIds.has(id)) {
        const factoryTemplate = factoryTemplates.find(ft => (ft.id || ft._id?.toString()) === id);
        conflicts.push({
          id,
          factoryTemplate: {
            name: factoryTemplate?.name || factoryTemplate?.label || 'N/A',
            type: factoryTemplate?.type || 'N/A'
          },
          projectTemplate: {
            name: t.name || t.label || 'N/A',
            type: t.type || 'N/A'
          }
        });
      }
    });

    if (conflicts.length > 0) {
      console.error(`🔴 CONFLITTI TROVATI: ${conflicts.length} ID presenti sia in Factory che in Projects\n`);
      conflicts.forEach((conflict, idx) => {
        console.error(`📌 CONFLITTO #${idx + 1}: ID = ${conflict.id}`);
        console.error(`   Factory: name=${conflict.factoryTemplate.name}, type=${conflict.factoryTemplate.type}`);
        console.error(`   Project: name=${conflict.projectTemplate.name}, type=${conflict.projectTemplate.type}`);
        console.error('');
      });
    } else {
      console.log('✅ Nessun conflitto tra Factory e Projects\n');
    }

    // ✅ Statistiche finali
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('📊 STATISTICHE FINALI');
    console.log('═══════════════════════════════════════════════════════════════════════════\n');
    console.log(`Factory templates: ${factoryTemplates.length}`);
    console.log(`Projects templates: ${allProjectTemplates.length}`);
    console.log(`Factory ID univoci: ${factoryIdMap.size}`);
    console.log(`Projects ID univoci: ${projectIdMap.size}`);
    console.log(`Duplicati Factory: ${factoryDuplicates.length}`);
    console.log(`Duplicati Projects: ${projectDuplicates.length}`);
    console.log(`Conflitti Factory ↔ Projects: ${conflicts.length}\n`);

    return {
      factory: {
        total: factoryTemplates.length,
        uniqueIds: factoryIdMap.size,
        duplicates: factoryDuplicates.length
      },
      projects: {
        total: allProjectTemplates.length,
        uniqueIds: projectIdMap.size,
        duplicates: projectDuplicates.length
      },
      conflicts: conflicts.length,
      details: {
        factoryDuplicates,
        projectDuplicates,
        conflicts
      }
    };

  } catch (error) {
    console.error('❌ ERRORE:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Disconnesso da MongoDB');
    }
  }
}

// Esegui verifica
if (require.main === module) {
  verifyAllDuplicates()
    .then(result => {
      console.log('\n✅ Verifica completata!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Verifica fallita:', error);
      process.exit(1);
    });
}

module.exports = { verifyAllDuplicates };
