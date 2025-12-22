/**
 * Restore General Templates
 * 
 * Identifica template che sono duplicati tra progetti (stesso id in più progetti)
 * e li promuove a scope "general", rimuovendo i duplicati client-specific.
 * 
 * Questo ripristina template generali come "data", "numero di telefono", ecc.
 * che erano stati sovrascritti da step2b_migrate_project_acts.js
 */

const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactoryName = 'factory';

async function restoreGeneralTemplates() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB');
    
    const db = client.db(dbFactoryName);
    
    // Trova tutti i template client-specific
    const clientTemplates = await db.collection('task_templates')
      .find({ scope: { $regex: /^client:/ } })
      .toArray();
    
    console.log(`\n📋 Trovati ${clientTemplates.length} template client-specific`);
    
    // Raggruppa per id per trovare duplicati
    const templatesById = {};
    clientTemplates.forEach(t => {
      if (!templatesById[t.id]) {
        templatesById[t.id] = [];
      }
      templatesById[t.id].push(t);
    });
    
    // Trova template che appaiono in più progetti (duplicati)
    const duplicates = Object.entries(templatesById)
      .filter(([id, templates]) => templates.length > 1)
      .map(([id, templates]) => ({ id, templates, count: templates.length }));
    
    console.log(`\n🔄 Trovati ${duplicates.length} template duplicati tra progetti`);
    
    let promoted = 0;
    let removed = 0;
    
    for (const { id, templates } of duplicates) {
      // Prendi il primo template come base (tutti dovrebbero essere simili)
      const baseTemplate = templates[0];
      
      // Crea template generale (senza scope client)
      const generalTemplate = {
        ...baseTemplate,
        scope: 'general',
        _promotedFromClient: true,
        _promotedDate: new Date(),
        _originalScopes: templates.map(t => t.scope)
      };
      
      // Rimuovi _originalProject e altri campi client-specific
      delete generalTemplate._originalProject;
      
      // Inserisci/aggiorna template generale
      await db.collection('task_templates').updateOne(
        { id: id, scope: 'general' },
        { $set: generalTemplate },
        { upsert: true }
      );
      
      promoted++;
      console.log(`  ✅ Promosso a general: ${id} - ${baseTemplate.label}`);
      
      // Rimuovi tutti i duplicati client-specific
      for (const template of templates) {
        await db.collection('task_templates').deleteOne({
          _id: template._id
        });
        removed++;
      }
    }
    
    // Verifica risultato
    const generalCount = await db.collection('task_templates')
      .countDocuments({ scope: 'general' });
    
    const clientCount = await db.collection('task_templates')
      .countDocuments({ scope: { $regex: /^client:/ } });
    
    console.log('\n📊 Riepilogo:');
    console.log(`   Template promossi a general: ${promoted}`);
    console.log(`   Template client rimossi: ${removed}`);
    console.log(`   Template general totali: ${generalCount}`);
    console.log(`   Template client rimanenti: ${clientCount}`);
    
    console.log('\n🎉 Restore completato!');
    
  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await client.close();
  }
}

// Esegui solo se chiamato direttamente
if (require.main === module) {
  restoreGeneralTemplates().catch(console.error);
}

module.exports = { restoreGeneralTemplates };




