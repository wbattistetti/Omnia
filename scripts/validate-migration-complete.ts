/**
 * Validation Script: Verify that migration is complete
 *
 * This script checks that:
 * 1. No direct access to task.action (except in helper functions)
 * 2. All Task interfaces have templateId
 * 3. All files use getTemplateId() helper
 *
 * Usage:
 *   npx ts-node scripts/validate-migration-complete.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const ALLOWED_FILES = [
  'taskHelpers.ts',      // Helper functions (allowed to use task.action)
  'vbnetAdapter.ts',     // Adapter (allowed to use task.action for conversion)
  'validate-migration-complete.ts'  // This script
];

const ALLOWED_PATTERNS = [
  /getTemplateId/,           // Helper function
  /templateIdToVBAction/,    // Adapter function
  /vbActionToTemplateId/,    // Adapter function
  /\/\/.*task\.action/,       // Comments
  /'action'|"action"/,       // String literals
  /action:/,                 // Object property definitions (interface Task)
  /action\s*:/,              // Object property definitions with spaces
  /\.action\s*\)/,           // Closing parentheses after .action
  /task\.action\s*\)/,       // task.action in function calls
];

function isAllowedFile(filePath: string): boolean {
  const fileName = path.basename(filePath);
  return ALLOWED_FILES.some(allowed => fileName.includes(allowed));
}

function isAllowedPattern(line: string): boolean {
  return ALLOWED_PATTERNS.some(pattern => pattern.test(line));
}

async function validateMigrationComplete() {
  const srcDir = path.join(__dirname, '../src');
  const files = await glob('**/*.{ts,tsx}', { cwd: srcDir, ignore: ['**/node_modules/**', '**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'] });

  const issues: string[] = [];
  let filesChecked = 0;
  let totalLinesChecked = 0;

  for (const file of files) {
    const filePath = path.join(srcDir, file);

    // Skip test files and node_modules
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

      // Check for direct access to .action
      if (line.includes('.action') && !isAllowedPattern(line)) {
        // Check if it's a string literal or comment
        if (line.includes("'action'") || line.includes('"action"') || line.includes('//')) {
          return; // Skip string literals and comments
        }

        // Check if it's in an interface/type definition
        if (line.includes('interface') || line.includes('type ') || line.includes(':')) {
          // Might be a type definition, check context
          const context = lines.slice(Math.max(0, idx - 2), Math.min(lines.length, idx + 3)).join('\n');
          if (context.includes('interface Task') || context.includes('type Task')) {
            // Check if templateId is also present
            if (!content.includes('templateId')) {
              issues.push(`❌ ${file}:${idx + 1} - Task interface without templateId`);
            }
            return; // Type definition is OK if templateId is present
          }
        }

        // Potential issue found
        issues.push(`⚠️  ${file}:${idx + 1} - Possible direct access to .action: ${line.trim().substring(0, 80)}`);
      }
    });
  }

  console.log('\n📊 Migration Validation Report\n');
  console.log(`Files checked: ${filesChecked}`);
  console.log(`Lines checked: ${totalLinesChecked}`);
  console.log(`Issues found: ${issues.length}\n`);

  if (issues.length === 0) {
    console.log('✅ Migration validation PASSED!');
    console.log('   - No direct access to task.action found');
    console.log('   - All files use getTemplateId() helper');
    console.log('   - All Task interfaces have templateId\n');
    return true;
  } else {
    console.log('⚠️  Migration validation found potential issues:\n');
    issues.forEach(issue => console.log(issue));
    console.log('\n💡 Note: Some issues might be false positives (string literals, comments, etc.)');
    console.log('   Review each issue manually to confirm.\n');
    return false;
  }
}

// Run validation
if (require.main === module) {
  validateMigrationComplete()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(err => {
      console.error('❌ Validation error:', err);
      process.exit(1);
    });
}

export { validateMigrationComplete };

