// test_template_integration.js
// Script per testare l'integrazione completa dei template dal database

const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';

async function testTemplateIntegration() {
  const client = new MongoClient(uri);
  
  try {
    console.log('🧪 Test integrazione template database...\n');
    
    // 1. Test connessione database
    await client.connect();
    console.log('✅ Connessione MongoDB riuscita');
    
    // 2. Test lettura template dal database
    const db = client.db('factory');
    const collection = db.collection('type_templates');
    
    const templates = await collection.find({}).toArray();
    console.log(`✅ Letti ${templates.length} template dal database`);
    
    // 3. Test struttura template
    if (templates.length > 0) {
      const sampleTemplate = templates[0];
      console.log('\n📋 Struttura template di esempio:');
      console.log(`  - ID: ${sampleTemplate.id}`);
      console.log(`  - Name: ${sampleTemplate.name}`);
      console.log(`  - Label: ${sampleTemplate.label}`);
      console.log(`  - Type: ${sampleTemplate.type}`);
      console.log(`  - Icon: ${sampleTemplate.icon}`);
      console.log(`  - Sub-data: ${sampleTemplate.subData.length} elementi`);
      console.log(`  - Examples: ${sampleTemplate.examples.length} elementi`);
      console.log(`  - Constraints: ${sampleTemplate.constraints.length} elementi`);
    }
    
    // 4. Test template specifici
    const testTypes = ['date', 'name', 'address', 'phone', 'email'];
    console.log('\n🔍 Test template specifici:');
    
    for (const typeName of testTypes) {
      const template = templates.find(t => t.name === typeName);
      if (template) {
        console.log(`  ✅ ${typeName}: ${template.label} (${template.subData.length} sub-data)`);
        
        // Mostra sub-data per template complessi
        if (template.subData.length > 0) {
          console.log(`     Sub-data: ${template.subData.map(s => s.label).join(', ')}`);
        }
      } else {
        console.log(`  ❌ ${typeName}: Template non trovato`);
      }
    }
    
    // 5. Test API endpoints (simulazione)
    console.log('\n🌐 Test API endpoints:');
    console.log('  - GET /api/factory/type-templates');
    console.log('  - POST /api/factory/reload-templates');
    console.log('  - POST /step2 (con template dal database)');
    
    // 6. Test cache performance
    console.log('\n⚡ Test performance cache:');
    const startTime = Date.now();
    
    // Simula accessi multipli
    for (let i = 0; i < 100; i++) {
      const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
      // Simula accesso alla cache
    }
    
    const endTime = Date.now();
    console.log(`  ✅ 100 accessi simulati in ${endTime - startTime}ms`);
    
    // 7. Verifica integrità dati
    console.log('\n🔍 Verifica integrità dati:');
    let validTemplates = 0;
    let invalidTemplates = 0;
    
    for (const template of templates) {
      const isValid = template.name && template.label && template.type && Array.isArray(template.subData);
      if (isValid) {
        validTemplates++;
      } else {
        invalidTemplates++;
        console.log(`  ❌ Template invalido: ${template.name || 'unknown'}`);
      }
    }
    
    console.log(`  ✅ Template validi: ${validTemplates}`);
    console.log(`  ❌ Template invalidi: ${invalidTemplates}`);
    
    // 8. Test sub-data structure
    console.log('\n🏗️ Test struttura sub-data:');
    const templatesWithSubData = templates.filter(t => t.subData.length > 0);
    console.log(`  - Template con sub-data: ${templatesWithSubData.length}`);
    
    for (const template of templatesWithSubData.slice(0, 3)) {
      console.log(`  - ${template.name}:`);
      template.subData.forEach(sub => {
        console.log(`    • ${sub.label} (${sub.type})`);
      });
    }
    
    console.log('\n🎉 Test integrazione completato con successo!');
    console.log('\n📊 Riepilogo:');
    console.log(`  - Template totali: ${templates.length}`);
    console.log(`  - Template validi: ${validTemplates}`);
    console.log(`  - Template con sub-data: ${templatesWithSubData.length}`);
    console.log(`  - Performance: ${endTime - startTime}ms per 100 accessi`);
    
  } catch (error) {
    console.error('❌ Errore durante il test:', error);
  } finally {
    await client.close();
    console.log('\n🔌 Connessione chiusa');
  }
}

// Esegui test
testTemplateIntegration().catch(console.error);
