/**
 * Script: Identifica collezioni MongoDB obsolete
 *
 * Analizza:
 * 1. Tutte le collezioni esistenti nel database
 * 2. Quali sono usate nel codice (backend/server.js)
 * 3. Quali sono obsolete e possono essere rimosse
 *
 * LOGICA:
 * - Collezione usata nel codice → MANTIENI
 * - Collezione vuota e non usata → OBSOLETA
 * - Collezione duplicata con altra → OBSOLETA (dopo migrazione)
 * - Collezione deprecata ma ancora usata → DA MIGRARE
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';
const dbProjects = 'Projects';

// ✅ Collezioni ATTIVE (usate nel codice)
const ACTIVE_COLLECTIONS = {
  factory: [
    'Tasks',              // ✅ Collection principale per task templates
    'Heuristics',         // ✅ Pattern euristiche per task type detection
    'factory_types',      // ✅ NLP extractors
    'ddt_library',        // ✅ DDT Library V2 (da verificare se vuota)
    'task_templates',     // ⚠️ Usata da /api/factory/task-templates-v2 (da migrare a Tasks)
    'AgentActs',          // ⚠️ Deprecata ma ancora usata (linea 644, 2735, 2756)
    'BackendCalls',       // ✅ Attiva
    'Conditions',         // ✅ Attiva
    'MacroTasks',         // ✅ Attiva
    'Constants',          // ✅ Attiva
    'Industries',         // ✅ Attiva
    'Translations',       // ✅ Attiva
    'DataDialogueTemplates', // ✅ Attiva (usata linea 3845)
    'Extractors',         // ✅ Attiva - NLP extractors (usata da setup_extractors.js e /api/extractors/*)
    'ExtractorBindings',  // ✅ Attiva - NLP extractor bindings (usata da setup_extractors.js)
    'IDETranslations',    // ⚠️ Attiva ma legacy (usata da endpoint linea 2849)
    'DataDialogueTranslations' // ⚠️ Attiva ma legacy (usata da endpoint linea 2872, 2975)
  ],
  Projects: [
    'projects_catalog',   // ✅ Attiva - catalogo progetti
    'projects'            // ⚠️ Da verificare se duplicata con projects_catalog
  ]
};

// ❌ Collezioni OBSOLETE (già eliminate o da eliminare)
const OBSOLETE_COLLECTIONS = {
  factory: [
    'Task_Templates'      // ❌ Già eliminata (migrata a Tasks)
  ],
  Projects: []
};

// ⚠️ Collezioni DA VERIFICARE (potrebbero essere obsolete)
const TO_VERIFY_COLLECTIONS = {
  factory: [
    'IDETranslations',           // ⚠️ Potrebbe essere unificata in Translations
    'DataDialogueTranslations',  // ⚠️ Potrebbe essere unificata in Translations
    'type_templates'             // ⚠️ Da verificare se ancora usata
  ],
  Projects: []
};

async function analyze() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');
    console.log('='.repeat(80));
    console.log('📊 ANALISI COLLEZIONI OBSOLETE');
    console.log('='.repeat(80));
    console.log();

    // ===================================
    // 1. ANALIZZA FACTORY DATABASE
    // ===================================
    console.log('📦 FACTORY DATABASE');
    console.log('-'.repeat(80));
    const factoryDb = client.db(dbFactory);
    const factoryCollections = await factoryDb.listCollections().toArray();
    const factoryCollectionNames = factoryCollections.map(c => c.name).sort();

    console.log(`Trovate ${factoryCollectionNames.length} collezioni:\n`);

    const factoryAnalysis = {
      active: [],
      obsolete: [],
      toVerify: [],
      unknown: []
    };

    for (const collName of factoryCollectionNames) {
      const count = await factoryDb.collection(collName).countDocuments();

      if (ACTIVE_COLLECTIONS.factory.includes(collName)) {
        factoryAnalysis.active.push({ name: collName, count });
        console.log(`✅ ${collName.padEnd(30)} ${count.toString().padStart(5)} documenti - ATTIVA`);
      } else if (OBSOLETE_COLLECTIONS.factory.includes(collName)) {
        factoryAnalysis.obsolete.push({ name: collName, count });
        console.log(`❌ ${collName.padEnd(30)} ${count.toString().padStart(5)} documenti - OBSOLETA`);
      } else if (TO_VERIFY_COLLECTIONS.factory.includes(collName)) {
        factoryAnalysis.toVerify.push({ name: collName, count });
        console.log(`⚠️  ${collName.padEnd(30)} ${count.toString().padStart(5)} documenti - DA VERIFICARE`);
      } else {
        factoryAnalysis.unknown.push({ name: collName, count });
        console.log(`❓ ${collName.padEnd(30)} ${count.toString().padStart(5)} documenti - SCONOSCIUTA`);
      }
    }

    // ===================================
    // 2. ANALIZZA PROJECTS DATABASE
    // ===================================
    console.log('\n📂 PROJECTS DATABASE');
    console.log('-'.repeat(80));
    const projectsDb = client.db(dbProjects);
    const projectsCollections = await projectsDb.listCollections().toArray();
    const projectsCollectionNames = projectsCollections.map(c => c.name).sort();

    console.log(`Trovate ${projectsCollectionNames.length} collezioni:\n`);

    const projectsAnalysis = {
      active: [],
      obsolete: [],
      toVerify: [],
      unknown: []
    };

    for (const collName of projectsCollectionNames) {
      const count = await projectsDb.collection(collName).countDocuments();

      if (ACTIVE_COLLECTIONS.Projects.includes(collName)) {
        projectsAnalysis.active.push({ name: collName, count });
        console.log(`✅ ${collName.padEnd(30)} ${count.toString().padStart(5)} documenti - ATTIVA`);
      } else if (OBSOLETE_COLLECTIONS.Projects.includes(collName)) {
        projectsAnalysis.obsolete.push({ name: collName, count });
        console.log(`❌ ${collName.padEnd(30)} ${count.toString().padStart(5)} documenti - OBSOLETA`);
      } else if (TO_VERIFY_COLLECTIONS.Projects.includes(collName)) {
        projectsAnalysis.toVerify.push({ name: collName, count });
        console.log(`⚠️  ${collName.padEnd(30)} ${count.toString().padStart(5)} documenti - DA VERIFICARE`);
      } else {
        projectsAnalysis.unknown.push({ name: collName, count });
        console.log(`❓ ${collName.padEnd(30)} ${count.toString().padStart(5)} documenti - SCONOSCIUTA`);
      }
    }

    // ===================================
    // 3. ANALISI DETTAGLIATA COLLEZIONI DA VERIFICARE
    // ===================================
    console.log('\n' + '='.repeat(80));
    console.log('🔍 ANALISI DETTAGLIATA COLLEZIONI DA VERIFICARE');
    console.log('='.repeat(80));

    // 3.1 ddt_library
    console.log('\n📋 ddt_library (factory):');
    const ddtLibrary = await factoryDb.collection('ddt_library').find({}).toArray();
    const emptyDDTs = ddtLibrary.filter(ddt =>
      !ddt.ddt ||
      (ddt.ddt && typeof ddt.ddt === 'object' &&
       (!ddt.ddt.mainData || (Array.isArray(ddt.ddt.mainData) && ddt.ddt.mainData.length === 0)) &&
       (!ddt.ddt.steps || (typeof ddt.ddt.steps === 'object' && Object.keys(ddt.ddt.steps || {}).length === 0)))
    );
    console.log(`   Totale: ${ddtLibrary.length}`);
    console.log(`   Vuoti: ${emptyDDTs.length}`);
    console.log(`   Con contenuto: ${ddtLibrary.length - emptyDDTs.length}`);
    if (emptyDDTs.length === ddtLibrary.length && ddtLibrary.length > 0) {
      console.log(`   ⚠️  TUTTI i DDT sono VUOTI - può essere eliminata`);
    } else if (ddtLibrary.length === 0) {
      console.log(`   ⚠️  Collection VUOTA - può essere eliminata`);
    } else {
      console.log(`   ✅ Ha contenuto valido - MANTIENI`);
    }

    // 3.2 task_templates vs Tasks
    console.log('\n📋 task_templates vs Tasks (factory):');
    const taskTemplates = await factoryDb.collection('task_templates').find({}).toArray();
    const tasks = await factoryDb.collection('Tasks').find({}).toArray();
    console.log(`   task_templates: ${taskTemplates.length} documenti`);
    console.log(`   Tasks: ${tasks.length} documenti`);

    // Verifica duplicati per ID
    const taskTemplatesIds = new Set(taskTemplates.map(t => t.id || t._id?.toString()).filter(Boolean));
    const tasksIds = new Set(tasks.map(t => t.id || t._id?.toString()).filter(Boolean));
    const duplicateIds = [...taskTemplatesIds].filter(id => tasksIds.has(id));
    console.log(`   ID duplicati: ${duplicateIds.length}`);

    if (duplicateIds.length > 0) {
      console.log(`   ⚠️  Ha ${duplicateIds.length} ID duplicati con Tasks`);
      console.log(`   💡 Dopo migrazione endpoint, task_templates può essere eliminata`);
    } else {
      console.log(`   ✅ Nessun ID duplicato - potrebbero essere complementari`);
      console.log(`   💡 Verifica se task_templates ha scope filtering che Tasks non ha`);
    }

    // 3.3 projects vs projects_catalog
    console.log('\n📋 projects vs projects_catalog (Projects):');
    const projects = await projectsDb.collection('projects').find({}).toArray();
    const projectsCatalog = await projectsDb.collection('projects_catalog').find({}).toArray();
    console.log(`   projects: ${projects.length} documenti`);
    console.log(`   projects_catalog: ${projectsCatalog.length} documenti`);

    if (projects.length === 0 && projectsCatalog.length > 0) {
      console.log(`   ⚠️  projects è VUOTA - può essere eliminata`);
      console.log(`   💡 projects_catalog è la fonte di verità`);
    } else if (projects.length > 0 && projectsCatalog.length > 0) {
      console.log(`   ⚠️  Entrambe hanno documenti - verifica se sono duplicate`);
      console.log(`   💡 projects potrebbe essere legacy`);
    }

    // 3.4 IDETranslations e DataDialogueTranslations
    console.log('\n📋 IDETranslations e DataDialogueTranslations (factory):');
    try {
      const ideTranslations = await factoryDb.collection('IDETranslations').find({}).toArray();
      const dataDialogueTranslations = await factoryDb.collection('DataDialogueTranslations').find({}).toArray();
      const translations = await factoryDb.collection('Translations').find({}).toArray();

      console.log(`   IDETranslations: ${ideTranslations.length} documenti`);
      console.log(`   DataDialogueTranslations: ${dataDialogueTranslations.length} documenti`);
      console.log(`   Translations: ${translations.length} documenti`);

      if (ideTranslations.length === 0 && dataDialogueTranslations.length === 0) {
        console.log(`   ⚠️  Entrambe VUOTE - possono essere eliminate`);
        console.log(`   💡 Translations è la collection unificata`);
      } else if (ideTranslations.length > 0 || dataDialogueTranslations.length > 0) {
        console.log(`   ⚠️  Hanno ancora documenti - verifica se sono migrati in Translations`);
        console.log(`   💡 Dopo migrazione, possono essere eliminate`);
      }
    } catch (error) {
      if (error.codeName === 'NamespaceNotFound') {
        console.log(`   ✅ Già eliminate`);
      } else {
        console.log(`   ❌ Errore: ${error.message}`);
      }
    }

    // 3.5 AgentActs
    console.log('\n📋 AgentActs (factory):');
    const agentActs = await factoryDb.collection('AgentActs').find({}).toArray();
    console.log(`   AgentActs: ${agentActs.length} documenti`);
    console.log(`   ⚠️  DEPRECATA ma ancora usata (endpoint linea 644, 2735, 2756)`);
    console.log(`   💡 Dopo migrazione completa a Tasks, può essere eliminata`);

    // ===================================
    // 4. RIEPILOGO FINALE
    // ===================================
    console.log('\n' + '='.repeat(80));
    console.log('📊 RIEPILOGO FINALE');
    console.log('='.repeat(80));

    console.log('\n❌ COLLEZIONI OBSOLETE (possono essere eliminate):');
    const allObsolete = [
      ...factoryAnalysis.obsolete,
      ...projectsAnalysis.obsolete
    ];

    // Aggiungi collezioni vuote e non usate
    const emptyUnused = [
      ...factoryAnalysis.unknown.filter(c => c.count === 0),
      ...projectsAnalysis.unknown.filter(c => c.count === 0)
    ];

    if (allObsolete.length === 0 && emptyUnused.length === 0) {
      console.log('   Nessuna collezione obsoleta trovata');
    } else {
      allObsolete.forEach(c => {
        console.log(`   - ${c.name} (${c.count} documenti)`);
      });
      emptyUnused.forEach(c => {
        console.log(`   - ${c.name} (VUOTA, ${c.count} documenti)`);
      });
    }

    console.log('\n⚠️  COLLEZIONI DA MIGRARE (dopo migrazione, possono essere eliminate):');
    const toMigrate = [
      { name: 'task_templates', reason: 'Duplicata con Tasks - migrare endpoint /api/factory/task-templates-v2' },
      { name: 'AgentActs', reason: 'Deprecata - migrare a Tasks' },
      { name: 'ddt_library', reason: 'Vuota o ridondante - verificare se serve ancora' },
      { name: 'projects', reason: 'Potrebbe essere duplicata con projects_catalog' },
      { name: 'IDETranslations', reason: 'Unificata in Translations' },
      { name: 'DataDialogueTranslations', reason: 'Unificata in Translations' }
    ];

    toMigrate.forEach(c => {
      console.log(`   - ${c.name}: ${c.reason}`);
    });

    console.log('\n✅ COLLEZIONI ATTIVE (mantieni):');
    const allActive = [
      ...factoryAnalysis.active,
      ...projectsAnalysis.active
    ];

    allActive.forEach(c => {
      console.log(`   - ${c.name} (${c.count} documenti)`);
    });

    console.log('\n❓ COLLEZIONI SCONOSCIUTE (da analizzare manualmente):');
    const allUnknown = [
      ...factoryAnalysis.unknown.filter(c => c.count > 0),
      ...projectsAnalysis.unknown.filter(c => c.count > 0)
    ];

    if (allUnknown.length === 0) {
      console.log('   Nessuna collezione sconosciuta');
    } else {
      allUnknown.forEach(c => {
        console.log(`   - ${c.name} (${c.count} documenti) - verifica se è usata nel codice`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('💡 RACCOMANDAZIONI');
    console.log('='.repeat(80));
    console.log('\n1. Elimina collezioni vuote e non usate');
    console.log('2. Migra endpoint da task_templates a Tasks');
    console.log('3. Migra endpoint da AgentActs a Tasks');
    console.log('4. Verifica se ddt_library è vuota e può essere eliminata');
    console.log('5. Verifica se projects è duplicata con projects_catalog');
    console.log('6. Migra IDETranslations e DataDialogueTranslations in Translations (se non già fatto)');
    console.log('7. Dopo migrazioni, elimina collezioni obsolete');

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

