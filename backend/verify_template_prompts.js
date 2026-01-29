// Script per verificare che tutti i prompt dei templates abbiano GUID e translations
const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function verifyTemplates() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const factoryDb = client.db(dbFactory);
    // Template di dati DDT sono in Task_Templates, non type_templates
    const templates = factoryDb.collection('Task_Templates');
    const translations = factoryDb.collection('Translations');

    // Trova tutti i templates
    const allTemplates = await templates.find({}).toArray();
    console.log(`📋 Found ${allTemplates.length} templates to verify\n`);

    const results = {
      totalTemplates: allTemplates.length,
      templatesWithIssues: [],
      totalPrompts: 0,
      promptsWithGuid: 0,
      promptsWithoutGuid: 0,
      guidsWithTranslations: 0,
      guidsWithoutTranslations: 0,
      missingTranslations: []
    };

    // Funzione ricorsiva per estrarre tutti i steps
    const extractsteps = (node, path = '') => {
      const prompts = [];

      if (node.steps) {
        Object.entries(node.steps).forEach(([stepKey, keys]) => {
          if (Array.isArray(keys)) {
            keys.forEach(key => {
              prompts.push({
                path: path ? `${path}/${stepKey}` : stepKey,
                key: key,
                isGuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)
              });
            });
          }
        });
      }

      // Ricorsivo per subData
      if (node.subData && Array.isArray(node.subData)) {
        node.subData.forEach(sub => {
          const subPath = path ? `${path}/${sub.label || sub.name || 'sub'}` : (sub.label || sub.name || 'sub');
          prompts.push(...extractsteps(sub, subPath));
        });
      }

      return prompts;
    };

    // Verifica ogni template
    for (const template of allTemplates) {
      const templateIssues = {
        templateName: template.label || template.name || template._id,
        templateId: template._id,
        issues: []
      };

      const allPrompts = [];

      // Root level steps
      if (template.steps) {
        allPrompts.push(...extractsteps(template, 'root'));
      }

      // mainData steps
      if (template.mainData && Array.isArray(template.mainData)) {
        template.mainData.forEach((main, mainIdx) => {
          const mainPath = `main[${mainIdx}]/${main.label || main.name || 'main'}`;
          allPrompts.push(...extractsteps(main, mainPath));
        });
      }

      results.totalPrompts += allPrompts.length;

      // Verifica ogni prompt
      const uniqueGuids = new Set();
      for (const prompt of allPrompts) {
        if (prompt.isGuid) {
          results.promptsWithGuid++;
          uniqueGuids.add(prompt.key);
        } else {
          results.promptsWithoutGuid++;
          templateIssues.issues.push({
            type: 'NO_GUID',
            path: prompt.path,
            key: prompt.key
          });
        }
      }

      // Verifica che tutti i GUID abbiano translations
      if (uniqueGuids.size > 0) {
        const guidArray = Array.from(uniqueGuids);
        const translationsFound = await translations.find({
          guid: { $in: guidArray },
          type: 'Template'
        }).toArray();

        const foundGuids = new Set(translationsFound.map(t => t.guid));
        const missingGuids = guidArray.filter(g => !foundGuids.has(g));

        results.guidsWithTranslations += foundGuids.size;
        results.guidsWithoutTranslations += missingGuids.length;

        if (missingGuids.length > 0) {
          templateIssues.issues.push({
            type: 'MISSING_TRANSLATIONS',
            guids: missingGuids,
            count: missingGuids.length
          });

          missingGuids.forEach(guid => {
            results.missingTranslations.push({
              template: templateIssues.templateName,
              guid: guid
            });
          });
        }
      }

      if (templateIssues.issues.length > 0) {
        results.templatesWithIssues.push(templateIssues);
      }
    }

    // Report finale
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 VERIFICATION REPORT');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`📦 Templates: ${results.totalTemplates}`);
    console.log(`   ✅ OK: ${results.totalTemplates - results.templatesWithIssues.length}`);
    console.log(`   ⚠️  Issues: ${results.templatesWithIssues.length}\n`);

    console.log(`🔑 Prompts: ${results.totalPrompts}`);
    console.log(`   ✅ With GUID: ${results.promptsWithGuid}`);
    console.log(`   ❌ Without GUID: ${results.promptsWithoutGuid}\n`);

    console.log(`🌐 Translations: ${results.guidsWithTranslations + results.guidsWithoutTranslations} unique GUIDs`);
    console.log(`   ✅ With translations: ${results.guidsWithTranslations}`);
    console.log(`   ❌ Missing translations: ${results.guidsWithoutTranslations}\n`);

    if (results.templatesWithIssues.length > 0) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('⚠️  TEMPLATES WITH ISSUES:');
      console.log('═══════════════════════════════════════════════════════════\n');

      results.templatesWithIssues.forEach((template, idx) => {
        console.log(`${idx + 1}. ${template.templateName} (${template.templateId})`);

        const noGuidIssues = template.issues.filter(i => i.type === 'NO_GUID');
        const missingTransIssues = template.issues.filter(i => i.type === 'MISSING_TRANSLATIONS');

        if (noGuidIssues.length > 0) {
          console.log(`   ❌ ${noGuidIssues.length} prompts without GUID:`);
          noGuidIssues.slice(0, 5).forEach(issue => {
            console.log(`      - ${issue.path}: "${issue.key}"`);
          });
          if (noGuidIssues.length > 5) {
            console.log(`      ... and ${noGuidIssues.length - 5} more`);
          }
        }

        if (missingTransIssues.length > 0) {
          missingTransIssues.forEach(issue => {
            console.log(`   ❌ ${issue.count} GUIDs without translations:`);
            issue.guids.slice(0, 5).forEach(guid => {
              console.log(`      - ${guid}`);
            });
            if (issue.guids.length > 5) {
              console.log(`      ... and ${issue.guids.length - 5} more`);
            }
          });
        }
        console.log('');
      });
    }

    if (results.missingTranslations.length > 0) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📝 SUMMARY OF MISSING TRANSLATIONS:');
      console.log('═══════════════════════════════════════════════════════════\n');
      console.log(`Total GUIDs missing translations: ${results.missingTranslations.length}\n`);
      console.log('First 20 missing GUIDs:');
      results.missingTranslations.slice(0, 20).forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item.guid} (${item.template})`);
      });
      if (results.missingTranslations.length > 20) {
        console.log(`  ... and ${results.missingTranslations.length - 20} more`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    if (results.promptsWithoutGuid === 0 && results.guidsWithoutTranslations === 0) {
      console.log('✅ ALL CHECKS PASSED! All prompts have GUIDs and translations.');
    } else {
      console.log('⚠️  SOME ISSUES FOUND. See details above.');
    }
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Verification error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

verifyTemplates().catch(console.error);







