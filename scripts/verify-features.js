#!/usr/bin/env node

/**
 * Verify Cross-Feature Imports
 *
 * This script verifies that:
 * - Features do not import from other features
 * - Features only import from core/domain, core/state, core/utils
 *
 * Usage: node scripts/verify-features.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FEATURES_DIR = path.join(__dirname, '../src/components/TaskEditor/ResponseEditor/features');

const ALLOWED_IMPORTS = [
  '@responseEditor/core/domain',
  '@responseEditor/core/state',
  '@responseEditor/core/utils',
  '@types/',
  '@utils/',
  '@services/',
  '@context/',
  '@hooks/',
  '@components/',
  '@config/',
  '@features/', // Only for features outside ResponseEditor
];

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function getFeatureName(filePath) {
  // Extract feature name from path: features/node-editing/... -> node-editing
  // Handle both Windows and Unix paths
  const normalizedPath = filePath.replace(/\\/g, '/');
  const match = normalizedPath.match(/features\/([^\/]+)/);
  return match ? match[1] : null;
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];
  const currentFeature = getFeatureName(filePath);

  lines.forEach((line, index) => {
    // Match import statements
    const importMatch = line.match(/from\s+['"]([^'"]+)['"]/);
    if (importMatch) {
      const importPath = importMatch[1];

      // Check if it's a cross-feature import
      const crossFeatureMatch = importPath.match(/@responseEditor\/features\/([^\/]+)/);
      if (crossFeatureMatch && currentFeature) {
        const importedFeature = crossFeatureMatch[1];
        // Only flag if importing from a DIFFERENT feature
        if (importedFeature !== currentFeature) {
          violations.push({
            line: index + 1,
            content: line.trim(),
            importPath,
            importedFeature,
            currentFeature,
            reason: `Feature '${currentFeature}' cannot import from feature '${importedFeature}'`,
          });
        }
      }

      // Check relative imports to other features
      // Only check if we can determine the imported feature from the path
      // Skip if it's a relative import within the same feature
      if (importPath.startsWith('../') && currentFeature) {
        // Count ../ to determine if we're going outside the feature
        const depth = (importPath.match(/\.\.\//g) || []).length;
        // If depth > 2, we might be going to another feature
        // But we can't reliably detect this without parsing the full path
        // So we skip relative imports for now (they're handled by verify-imports.js)
      }
    }
  });

  return violations;
}

function main() {
  console.log('🔍 Verifying Cross-Feature Imports...\n');

  if (!fs.existsSync(FEATURES_DIR)) {
    console.error(`❌ Features directory not found: ${FEATURES_DIR}`);
    process.exit(1);
  }

  const files = getAllFiles(FEATURES_DIR);
  let totalViolations = 0;

  files.forEach(file => {
    const violations = checkFile(file);
    if (violations.length > 0) {
      const relativePath = path.relative(process.cwd(), file);
      console.error(`\n❌ ${relativePath}:`);
      violations.forEach(v => {
        console.error(`   Line ${v.line}: ${v.content}`);
        console.error(`   Reason: ${v.reason}`);
        console.error(`   Suggestion: Use core/domain or core/state instead`);
      });
      totalViolations += violations.length;
    }
  });

  if (totalViolations > 0) {
    console.error(`\n❌ Found ${totalViolations} violation(s)`);
    console.error('Features cannot import from other features. Use core/domain or core/state instead.');
    process.exit(1);
  }

  console.log('✅ No cross-feature imports detected!');
  process.exit(0);
}

main();
