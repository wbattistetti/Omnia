// dbscript_full_migration.js
// MIGRAZIONE COMPLETA - TUTTI I COMPONENTI
const fs = require('fs');
const path = require('path');
const http = require('http');

// 1. ESTRATTORI (già testato e funzionante)
const EXTRACTORS = [
  {
    id: 'number',
    name: 'number',
    file: '../src/nlp/extractors/number.ts',
    regexPatterns: ["\\d+(\\.\\d+)?"],
    llmPrompt: "Extract numeric values from text",
    validators: [{ type: "range", min: 0, max: 1000000 }],
    examples: ["42", "3.14", "100"]
  },
  {
    id: 'email',
    name: 'email',
    file: '../src/nlp/extractors/email.ts',
    regexPatterns: ["[^\\s]+@[^\\s]+\\.[^\\s]+"],
    llmPrompt: "Extract email addresses from text",
    validators: [{ type: "format", pattern: "email" }],
    examples: ["test@example.com", "user.name@domain.it"]
  },
  {
    id: 'dateOfBirth',
    name: 'dateOfBirth',
    file: '../src/nlp/extractors/dateOfBirth.ts',
    regexPatterns: ["\\d{1,2}/\\d{1,2}/\\d{4}", "\\d{4}-\\d{2}-\\d{2}"],
    llmPrompt: "Extract date of birth from text",
    validators: [{ type: "date", minAge: 0, maxAge: 120 }],
    examples: ["01/01/1990", "15 marzo 1985"]
  },
  {
    id: 'phone',
    name: 'phone',
    file: '../src/nlp/extractors/phone.ts',
    regexPatterns: ["\\+?[0-9\\s\\(\\)\\-]{10,}"],
    llmPrompt: "Extract phone numbers from text",
    validators: [{ type: "format", pattern: "phone" }],
    examples: ["+393331234567", "02 1234567"]
  }
];

// 2. CONFIGURAZIONI DA MIGRARE
const CONFIGS = [
  {
    id: 'nlp_types_config',
    name: 'NLP Types Configuration',
    file: '../config/nlp-types.json',
    description: 'NLP types configuration from nlp-types.json'
  },
  {
    id: 'type_templates_config',
    name: 'Type Templates Configuration',
    file: '../config/type_templates.json',
    description: 'Type templates configuration'
  },
  {
    id: 'extraction_registry',
    name: 'Extraction Registry',
    file: '../backend/extractionRegistry.js',
    description: 'Extraction registry configuration'
  }
];

// 3. AI PROMPTS (cartella intera)
const AI_PROMPTS_DIR = '../backend/ai_prompts/';

async function migrateComponent(typeConfig, content) {
  const factoryType = {
    id: typeConfig.id,
    name: typeConfig.name,
    extractorCode: content,
    regexPatterns: typeConfig.regexPatterns || [],
    llmPrompt: typeConfig.llmPrompt || typeConfig.description,
    validators: typeConfig.validators || [],
    examples: typeConfig.examples || [],
    nerRules: "",
    permissions: { read: ["*"], write: ["admin"] },
    auditLog: false,
    metadata: {
      description: typeConfig.description,
      version: "1.0.0",
      lastUpdated: new Date().toISOString()
    }
  };

  await saveToDatabase(factoryType);
  console.log(`✅ ${typeConfig.name} migrato!`);
}

async function migrateExtractors() {
  console.log('🚀 STEP 1: Migrazione estrattori...\n');

  for (const extractor of EXTRACTORS) {
    try {
      console.log(`📦 ${extractor.name}`);
      const code = fs.readFileSync(path.join(__dirname, extractor.file), 'utf-8');
      await migrateComponent(extractor, code);
      await delay(100);
    } catch (error) {
      console.log(`❌ ${extractor.name}:`, error.message);
    }
  }
}

async function migrateConfigs() {
  console.log('\n🚀 STEP 2: Migrazione configurazioni...\n');

  for (const config of CONFIGS) {
    try {
      if (fs.existsSync(path.join(__dirname, config.file))) {
        console.log(`📦 ${config.name}`);
        const content = fs.readFileSync(path.join(__dirname, config.file), 'utf-8');
        await migrateComponent(config, content);
        await delay(100);
      } else {
        console.log(`⚠️ ${config.file} non trovato`);
      }
    } catch (error) {
      console.log(`❌ ${config.name}:`, error.message);
    }
  }
}

async function migrateAiPrompts() {
  console.log('\n🚀 STEP 3: Migrazione AI prompts...\n');

  try {
    const promptsDir = path.join(__dirname, AI_PROMPTS_DIR);
    if (fs.existsSync(promptsDir)) {
      const files = fs.readdirSync(promptsDir).filter(f => f.endsWith('.py'));

      for (const file of files) {
        try {
          console.log(`📦 AI Prompt: ${file}`);
          const content = fs.readFileSync(path.join(promptsDir, file), 'utf-8');
          await migrateComponent({
            id: `ai_prompt_${file.replace('.py', '')}`,
            name: `AI Prompt ${file}`,
            description: `AI prompt from ${file}`
          }, content);
          await delay(100);
        } catch (error) {
          console.log(`❌ ${file}:`, error.message);
        }
      }
    } else {
      console.log('⚠️ Cartella AI prompts non trovata');
    }
  } catch (error) {
    console.log('❌ AI prompts:', error.message);
  }
}

async function saveToDatabase(data) {
  return new Promise((resolve, reject) => {
    const jsonData = JSON.stringify(data);
    const options = {
      hostname: 'localhost',
      port: 8000,
      path: '/api/nlp/factory/types',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(jsonData)
      }
    };

    const req = http.request(options, (res) => {
      let response = '';
      res.on('data', chunk => response += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) resolve(response);
        else reject(new Error(`Status ${res.statusCode}: ${response}`));
      });
    });

    req.on('error', reject);
    req.write(jsonData);
    req.end();
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🎯 INIZIO MIGRAZIONE COMPLETA\n');

  await migrateExtractors();
  await migrateConfigs();
  await migrateAiPrompts();

  console.log('\n🎉 MIGRAZIONE COMPLETATA!');
  console.log('📊 Verifica: Invoke-RestMethod -Uri "http://localhost:8000/api/nlp/factory/types" -Method Get');
}

main().catch(console.error);