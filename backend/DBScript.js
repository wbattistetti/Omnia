// migrate_type_templates_to_factory.js - VERSIONE CORRETTA
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Connection string MongoDB (stessa del server.js)
const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';

async function migrateTypeTemplates() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('🔌 Connesso al database MongoDB');

    // Leggi il file type_templates.json
    const templatesPath = path.join(__dirname, '..', 'config', 'type_templates.json');
    const templatesData = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));

    console.log(`📄 Letti ${Object.keys(templatesData.templates).length} template dal file JSON`);

    const db = client.db('factory');
    const collection = db.collection('type_templates');

    // Pulisci collezione esistente
    await collection.deleteMany({});
    console.log('🧹 Collezione type_templates pulita');

    // Converti ogni template nel formato Factory
    const factoryTemplates = [];

    for (const [typeName, template] of Object.entries(templatesData.templates)) {
      const factoryTemplate = {
        id: `template_${typeName}`,
        name: typeName,
        label: template.label,
        type: template.type,
        icon: template.icon,
        subData: template.subData || [],
        examples: template.examples || [],
        constraints: template.constraints || [],
        metadata: {
          description: `Template per tipo di dato: ${template.label}`,
          version: templatesData.version || '1.0',
          lastUpdated: new Date().toISOString(),
          author: 'system',
          tags: [typeName, template.type],
          originalTemplate: true
        },
        permissions: {
          canEdit: true,
          canDelete: false, // Non eliminare template di sistema
          canShare: true
        },
        auditLog: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      factoryTemplates.push(factoryTemplate);
      console.log(`✅ Convertito template: ${typeName} → ${template.label}`);
    }

    // Inserisci nel database
    if (factoryTemplates.length > 0) {
      const result = await collection.insertMany(factoryTemplates);
      console.log(`🎉 Inseriti ${result.insertedCount} template nel database Factory`);
    }

    // Verifica inserimento
    const count = await collection.countDocuments();
    console.log(`📊 Totale template nel database: ${count}`);

    // Mostra alcuni esempi
    const samples = await collection.find({}).limit(3).toArray();
    console.log('\n📋 Esempi di template migrati:');
    samples.forEach(t => {
      console.log(`  - ${t.name}: ${t.label} (${t.subData.length} sub-data)`);
    });

  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
  } finally {
    await client.close();
    console.log('🔌 Connessione chiusa');
  }
}

// Esegui migrazione
migrateTypeTemplates().catch(console.error);