#!/usr/bin/env node

/**
 * FASE 1: Rimozioni 100% sicure
 * Rimuove file temporanei, directory legacy, script migrazione completati
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const filesToRemove = [
  // File temporanei root
  'temp_cursor_content.txt',
  'temp_drag_content.txt',
  'CustomNode_clean.tsx',
  'CustomNode_fixed.tsx',
  'FlowEditor_fixed.tsx',
  'backend/groq_ddt_api.py.backup',

  // Script temporanei root
  'ABILITA_NUOVO_HOOK.js',
  'augmentAgentActs.cjs',
  'augmentAgentActs.js',
  'crea_actions_factory.cjs',
  'crea_factory_dbs.cjs',
  'crea_industries_factory.cjs',
  'crea_industries_factory.js',
  'ddt.cjs',
  'delay-start.js',
  'Invoke-RestMethod',

  // Test temporanei root
  'test_new_templates.py',
  'test_request.json',
  'test_schema_structure.py',
  'test_single_request.py',
  'test_step2_intelligence.py',
  'test_template_integration.cjs',
  'test_template_integration.js',
];

const directoriesToRemove = [
  'src/components/SidebarOLD',
];

const migrationScriptsToRemove = [
  // Step scripts
  'backend/migrations/step1_setup_collections.js',
  'backend/migrations/step2_copy_data.js',
  'backend/migrations/step2b_migrate_project_acts.js',
  'backend/migrations/step3_seed_builtins.js',
  'backend/migrations/step4_migrate_task_templates_to_enum.js',
  'backend/migrations/step5_add_ddt_patterns.js',

  // Migrate scripts
  'backend/migrations/migrate_tasks_unified_model.js',
  'backend/migrations/migrate_projects_tasks.js',
  'backend/migrations/migrate_endpoints_task_templates_to_tasks.js',
  'backend/migrations/migrate_to_hybrid_structure.js',
  'backend/migrations/migrate_steps_to_array.js',
  'backend/migrations/migrate_steps_to_root_level.js',
  'backend/migrations/migrate_taskId_to_id.js',
  'backend/migrations/migrate_nlpcontract_to_datacontract.js',
  'backend/migrations/migrate_to_allowed_contexts.js',
  'backend/migrations/migrate_date_tasks.js',

  // Complete scripts
  'backend/migrations/complete_tasks_migration.js',
  'backend/migrations/identify_active_project_and_migrate.js',
];

function removeFile(filePath) {
  const fullPath = path.join(projectRoot, filePath);
  try {
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`✅ Removed: ${filePath}`);
      return true;
    } else {
      console.log(`⚠️  Not found: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error removing ${filePath}:`, error.message);
    return false;
  }
}

function removeDirectory(dirPath) {
  const fullPath = path.join(projectRoot, dirPath);
  try {
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
      console.log(`✅ Removed directory: ${dirPath}`);
      return true;
    } else {
      console.log(`⚠️  Directory not found: ${dirPath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error removing directory ${dirPath}:`, error.message);
    return false;
  }
}

console.log('🧹 FASE 1: Starting safe removals...\n');

let removedCount = 0;
let notFoundCount = 0;

// Remove files
console.log('📄 Removing files...');
filesToRemove.forEach(file => {
  if (removeFile(file)) {
    removedCount++;
  } else {
    notFoundCount++;
  }
});

// Remove migration scripts
console.log('\n📜 Removing completed migration scripts...');
migrationScriptsToRemove.forEach(script => {
  if (removeFile(script)) {
    removedCount++;
  } else {
    notFoundCount++;
  }
});

// Remove directories
console.log('\n📁 Removing legacy directories...');
directoriesToRemove.forEach(dir => {
  if (removeDirectory(dir)) {
    removedCount++;
  } else {
    notFoundCount++;
  }
});

console.log('\n📊 Summary:');
console.log(`   ✅ Removed: ${removedCount} items`);
console.log(`   ⚠️  Not found: ${notFoundCount} items`);
console.log('\n✅ FASE 1 completed!');
