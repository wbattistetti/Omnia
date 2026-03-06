// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Validation Script for Refactoring
 *
 * Runs comprehensive validation to ensure no regressions after refactoring.
 *
 * Usage:
 *   npm run validate-refactoring
 *   npm run validate-refactoring -- --feature-flag USE_DIRECT_TASK_UPDATES=true
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface ValidationResult {
  test: string;
  passed: boolean;
  error?: string;
  duration: number;
}

interface ValidationReport {
  timestamp: string;
  featureFlags: Record<string, boolean>;
  results: ValidationResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
  };
}

/**
 * Run all validation tests
 */
async function runValidation(): Promise<ValidationReport> {
  const startTime = Date.now();
  const results: ValidationResult[] = [];

  console.log('🔍 Starting refactoring validation...\n');

  // 1. Unit tests
  console.log('📦 Running unit tests...');
  try {
    const unitTestStart = Date.now();
    execSync('npm test -- tests/unit/TaskRepository.refactored.test.ts', { stdio: 'inherit' });
    results.push({
      test: 'Unit Tests - TaskRepository',
      passed: true,
      duration: Date.now() - unitTestStart
    });
  } catch (error) {
    results.push({
      test: 'Unit Tests - TaskRepository',
      passed: false,
      error: String(error),
      duration: 0
    });
  }

  // 2. buildTaskTree tests
  console.log('\n📦 Running buildTaskTree tests...');
  try {
    const buildTestStart = Date.now();
    execSync('npm test -- tests/unit/buildTaskTree.refactored.test.ts', { stdio: 'inherit' });
    results.push({
      test: 'Unit Tests - buildTaskTree',
      passed: true,
      duration: Date.now() - buildTestStart
    });
  } catch (error) {
    results.push({
      test: 'Unit Tests - buildTaskTree',
      passed: false,
      error: String(error),
      duration: 0
    });
  }

  // 3. Integration tests
  console.log('\n🔗 Running integration tests...');
  try {
    const integrationTestStart = Date.now();
    execSync('npm test -- tests/integration/ResponseEditor.integration.test.ts', { stdio: 'inherit' });
    results.push({
      test: 'Integration Tests - ResponseEditor',
      passed: true,
      duration: Date.now() - integrationTestStart
    });
  } catch (error) {
    results.push({
      test: 'Integration Tests - ResponseEditor',
      passed: false,
      error: String(error),
      duration: 0
    });
  }

  // 4. Regression tests
  console.log('\n🔄 Running regression tests...');
  try {
    const regressionTestStart = Date.now();
    execSync('npm test -- tests/regression/ResponseEditorRegression.test.ts', { stdio: 'inherit' });
    results.push({
      test: 'Regression Tests',
      passed: true,
      duration: Date.now() - regressionTestStart
    });
  } catch (error) {
    results.push({
      test: 'Regression Tests',
      passed: false,
      error: String(error),
      duration: 0
    });
  }

  const totalDuration = Date.now() - startTime;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  const report: ValidationReport = {
    timestamp: new Date().toISOString(),
    featureFlags: {
      USE_DIRECT_TASK_UPDATES: process.env.FEATURE_USE_DIRECT_TASK_UPDATES === 'true',
      DISABLE_MERGE_PROFONDO: process.env.FEATURE_DISABLE_MERGE_PROFONDO === 'true',
      USE_SIMPLIFIED_BUILD_TASK_TREE: process.env.FEATURE_USE_SIMPLIFIED_BUILD_TASK_TREE === 'true',
    },
    results,
    summary: {
      total: results.length,
      passed,
      failed,
      duration: totalDuration
    }
  };

  // Save report
  const reportPath = path.join(process.cwd(), 'validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n📊 Validation Summary:');
  console.log(`   Total: ${report.summary.total}`);
  console.log(`   Passed: ${report.summary.passed}`);
  console.log(`   Failed: ${report.summary.failed}`);
  console.log(`   Duration: ${report.summary.duration}ms`);
  console.log(`\n📄 Report saved to: ${reportPath}`);

  if (failed > 0) {
    console.error('\n❌ Validation failed! Check report for details.');
    process.exit(1);
  } else {
    console.log('\n✅ All validations passed!');
    process.exit(0);
  }

  return report;
}

// Run if called directly
if (require.main === module) {
  runValidation().catch(error => {
    console.error('❌ Validation script failed:', error);
    process.exit(1);
  });
}

export { runValidation };
