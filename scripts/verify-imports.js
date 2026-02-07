#!/usr/bin/env node

/**
 * Verify Import Paths
 *
 * This script verifies that:
 * - No relative imports exceed ../.. (2 levels)
 * - All imports use aliases when possible
 *
 * Usage: node scripts/verify-imports.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESPONSE_EDITOR_DIR = path.join(__dirname, '../src/components/TaskEditor/ResponseEditor');
const MAX_RELATIVE_DEPTH = 2; // ../.. is max

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules, dist, and test directories
      if (!file.startsWith('.') && file !== 'node_modules' && file !== 'dist') {
        getAllFiles(filePath, fileList);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function checkRelativeImport(importPath, filePath) {
  // Skip non-relative imports
  if (!importPath.startsWith('.')) {
    return null;
  }

  // Count ../ in the import path
  const depth = (importPath.match(/\.\.\//g) || []).length;

  if (depth > MAX_RELATIVE_DEPTH) {
    return {
      importPath,
      depth,
      suggestion: 'Consider using an alias instead (e.g., @responseEditor/...)',
    };
  }

  return null;
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];

  lines.forEach((line, index) => {
    // Match import statements
    const importMatch = line.match(/from\s+['"]([^'"]+)['"]/);
    if (importMatch) {
      const importPath = importMatch[1];
      const violation = checkRelativeImport(importPath, filePath);
      if (violation) {
        violations.push({
          line: index + 1,
          content: line.trim(),
          importPath,
          depth: violation.depth,
          suggestion: violation.suggestion,
        });
      }
    }
  });

  return violations;
}

function main() {
  console.log('🔍 Verifying Import Paths...\n');

  if (!fs.existsSync(RESPONSE_EDITOR_DIR)) {
    console.error(`❌ ResponseEditor directory not found: ${RESPONSE_EDITOR_DIR}`);
    process.exit(1);
  }

  const files = getAllFiles(RESPONSE_EDITOR_DIR);
  let totalViolations = 0;

  files.forEach(file => {
    const violations = checkFile(file);
    if (violations.length > 0) {
      const relativePath = path.relative(process.cwd(), file);
      console.error(`\n❌ ${relativePath}:`);
      violations.forEach(v => {
        console.error(`   Line ${v.line}: ${v.content}`);
        console.error(`   Depth: ${v.depth} levels (max: ${MAX_RELATIVE_DEPTH})`);
        console.error(`   Suggestion: ${v.suggestion}`);
      });
      totalViolations += violations.length;
    }
  });

  if (totalViolations > 0) {
    console.error(`\n❌ Found ${totalViolations} violation(s)`);
    console.error(`Relative imports should not exceed ${MAX_RELATIVE_DEPTH} levels (../..)`);
    process.exit(1);
  }

  console.log('✅ All imports are within allowed depth!');
  process.exit(0);
}

main();
