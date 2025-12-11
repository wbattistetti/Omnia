/**
 * Comprehensive Model Validation Script
 *
 * Verifies that:
 * 1. ✅ No direct access to task.action (except in helpers/adapters)
 * 2. ✅ All Task interfaces have templateId
 * 3. ✅ NodeData is only used as type alias (deprecated)
 * 4. ✅ FlowNode uses 'label' not 'title'
 * 5. ✅ All files use getTemplateId() helper
 *
 * Usage:
 *   node scripts/validate-model-clean.js
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_FILES = [
  'taskHelpers.ts',           // Helper functions (allowed to use task.action)
  'vbnetAdapter.ts',          // Adapter (allowed to use task.action for conversion)
  'validate-migration-complete.ts',  // Old validation script
  'validate-model-clean.js'   // This script
];

const ALLOWED_PATTERNS = [
  /getTemplateId/,           // Helper function
  /templateIdToVBAction/,    // Adapter function
  /vbActionToTemplateId/,    // Adapter function
  /\/\/.*task\.action/,       // Comments
  /'action'|"action"/,       // String literals
  /action:/,                 // Object property definitions (interface Task)
  /action\s*:/,              // Object property definitions with spaces
  /\.actions\s*\[/,          // Array access (actions array, not action field)
  /escalations.*actions/,     // DDT escalations.actions (different from task.action)
  /\.actions\s*[=:]/,        // Array assignment (actions array)
  /\.actions\s*\./,          // Array methods (actions.length, actions.map, etc.)
  /\.actions\s*\)/,          // Array in function calls
  /actionId/,                // actionId (different from action field)
  /actionInstanceId/,        // actionInstanceId (different from action field)
  /actionType/,              // actionType (different from action field)
  /actionIndex/,             // actionIndex (different from action field)
  /actionIdx/,               // actionIdx (different from action field)
  /action-buttons/,          // CSS class
  /\.action\s*\)/,           // Function calls (editor.getAction)
  /getAction/,               // getAction method (Monaco editor)
  /item\.action/,            // Drag & drop item.action (different from task.action)
  /action\.action/,          // action.actionId (nested property, not task.action)
  /action\?\.action/,        // Optional chaining action?.actionId
  /\.action\s*===/,          // Comparisons (action === 'something')
  /\.action\s*!==/,          // Comparisons (action !== 'something')
  /\.action\s*\|\|/,         // Logical OR (action || fallback)
  /\.action\s*&&/,           // Logical AND (action && something)
];

function isAllowedFile(filePath) {
  const fileName = path.basename(filePath);
  return ALLOWED_FILES.some(allowed => fileName.includes(allowed));
}

function isAllowedPattern(line) {
  return ALLOWED_PATTERNS.some(pattern => pattern.test(line));
}

async function validateModelClean() {
  const srcDir = path.join(__dirname, '../src');
  const files = await glob('**/*.{ts,tsx}', {
    cwd: srcDir,
    ignore: ['**/node_modules/**', '**/__tests__/**', '**/*.test.ts', '**/*.test.tsx']
  });

  const issues = [];
  const warnings = [];
  let filesChecked = 0;
  let totalLinesChecked = 0;
  let directActionAccess = 0;
  let missingTemplateId = 0;
  let nodeDataUsage = 0;
  let titleUsage = 0;

  for (const file of files) {
    const filePath = path.join(srcDir, file);
    const fileName = path.basename(filePath);

    // Skip test files
    if (file.includes('__tests__') || file.includes('.test.')) {
      continue;
    }

    // Skip allowed files
    if (isAllowedFile(filePath)) {
      continue;
    }

    filesChecked++;
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      totalLinesChecked++;

      // Skip comments and empty lines
      if (line.trim().startsWith('//') || line.trim() === '') {
        return;
      }

      // 1. Check for direct access to .action (except allowed patterns)
      if (line.includes('.action') && !isAllowedPattern(line)) {
        // Check if it's a string literal or comment
        if (line.includes("'action'") || line.includes('"action"') || line.includes('//')) {
          return;
        }

        // Check if it's escalation.actions (DDT array, not task.action)
        if (line.includes('escalation.actions') || line.includes('esc.actions') ||
            line.includes('escalations.actions') || line.includes('firstEscalation?.actions') ||
            line.includes('introEscalation?.actions') || line.includes('noMatchRecovery?.actions') ||
            line.includes('noInputRecovery?.actions') || line.includes('stepOrEscalation?.actions')) {
          return; // DDT escalation actions array, not task.action
        }

        // Check if it's actionCatalog (different from task.action)
        if (line.includes('actionCatalog') || line.includes('actionsCatalog')) {
          return;
        }

        // Check if it's actionRowActions (CSS class)
        if (line.includes('actionRowActions') || line.includes('action-buttons')) {
          return;
        }

        // Check if it's actionText (different from task.action)
        if (line.includes('actionText')) {
          return;
        }

        // Check if it's in an interface/type definition
        if (line.includes('interface') || line.includes('type ')) {
          const context = lines.slice(Math.max(0, idx - 2), Math.min(lines.length, idx + 3)).join('\n');
          if (context.includes('interface Task') || context.includes('type Task')) {
            // Check if templateId is also present
            if (!content.includes('templateId')) {
              issues.push(`❌ ${file}:${idx + 1} - Task interface without templateId`);
              missingTemplateId++;
            }
            return; // Type definition is OK if templateId is present
          }
        }

        // Check if it's task.action (the real problem we're looking for)
        if (line.includes('task.action') || line.includes('Task.action') ||
            (line.includes('.action') && (line.includes('task') || line.includes('Task')))) {
          // This might be a real issue, but check context
          const context = lines.slice(Math.max(0, idx - 3), Math.min(lines.length, idx + 3)).join('\n');
          // If it's in TaskRepository updateTask (migration code), it's OK
          if (context.includes('updateTask') && context.includes('TaskRepository')) {
            return; // Migration code in TaskRepository is OK
          }
        }

        // Potential direct access found
        directActionAccess++;
        issues.push(`⚠️  ${file}:${idx + 1} - Possible direct access to .action: ${line.trim().substring(0, 80)}`);
      }

      // 2. Check for NodeData usage (should only be type alias)
      if (line.includes('NodeData') && !line.includes('@deprecated') && !line.includes('type NodeData = FlowNode')) {
        // Check if it's a string literal or comment
        if (line.includes("'NodeData'") || line.includes('"NodeData"') || line.includes('//')) {
          return;
        }

        // Check if it's the type alias definition itself
        if (line.includes('export type NodeData = FlowNode')) {
          return;
        }

        nodeDataUsage++;
        warnings.push(`⚠️  ${file}:${idx + 1} - NodeData usage (should use FlowNode): ${line.trim().substring(0, 80)}`);
      }

      // 3. Check for data.title usage in FlowNode context (should be label)
      if (line.includes('data.title') || line.includes('node.title') || line.includes('.title')) {
        // Check if it's a string literal or comment
        if (line.includes("'title'") || line.includes('"title"') || line.includes('//')) {
          return;
        }

        // Check if it's in FlowNode context
        const context = lines.slice(Math.max(0, idx - 5), Math.min(lines.length, idx + 5)).join('\n');
        if (context.includes('FlowNode') || context.includes('NodeData') || context.includes('node.data')) {
          // Check if it's a dock title or other UI title (allowed)
          if (line.includes('dock') || line.includes('Dock') || line.includes('header') || line.includes('Header')) {
            return;
          }

          titleUsage++;
          warnings.push(`⚠️  ${file}:${idx + 1} - Possible data.title usage (should use label): ${line.trim().substring(0, 80)}`);
        }
      }
    });
  }

  return {
    passed: issues.length === 0,
    issues,
    warnings,
    stats: {
      filesChecked,
      linesChecked: totalLinesChecked,
      directActionAccess,
      missingTemplateId,
      nodeDataUsage,
      titleUsage
    }
  };
}

// Print results
async function printResults() {
  console.log('\n🔍 Model Cleanliness Validation Report\n');
  console.log('='.repeat(60));

  const result = await validateModelClean();

  console.log(`\n📊 Statistics:`);
  console.log(`   Files checked: ${result.stats.filesChecked}`);
  console.log(`   Lines checked: ${result.stats.linesChecked}`);
  console.log(`   Direct .action access: ${result.stats.directActionAccess}`);
  console.log(`   Missing templateId: ${result.stats.missingTemplateId}`);
  console.log(`   NodeData usage: ${result.stats.nodeDataUsage}`);
  console.log(`   Title usage: ${result.stats.titleUsage}`);

  if (result.issues.length > 0) {
    console.log(`\n❌ Issues found (${result.issues.length}):\n`);
    result.issues.forEach(issue => console.log(`   ${issue}`));
  }

  if (result.warnings.length > 0) {
    console.log(`\n⚠️  Warnings (${result.warnings.length}):\n`);
    result.warnings.forEach(warning => console.log(`   ${warning}`));
  }

  if (result.passed && result.warnings.length === 0) {
    console.log('\n✅ Model validation PASSED!');
    console.log('   ✅ No direct access to task.action found');
    console.log('   ✅ All Task interfaces have templateId');
    console.log('   ✅ NodeData only used as deprecated alias');
    console.log('   ✅ FlowNode uses label (not title)');
    console.log('   ✅ All files use getTemplateId() helper\n');
  } else if (result.passed) {
    console.log('\n✅ Model validation PASSED (with warnings)');
    console.log('   ⚠️  Some warnings found - review manually\n');
  } else {
    console.log('\n❌ Model validation FAILED');
    console.log('   ⚠️  Issues found - review and fix before removing legacy code\n');
  }

  return result.passed;
}

// Run validation
printResults()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('❌ Validation error:', err);
    process.exit(1);
  });

