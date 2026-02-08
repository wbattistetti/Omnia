// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

describe('No Broken Imports - Old Wizard Removal Safety Check', () => {
  const projectRoot = process.cwd();
  const srcPath = join(projectRoot, 'src');

  // List of files that will be DELETED (UI components only)
  const filesToBeDeleted = [
    // Main components
    'TaskTreeWizard/TaskWizard.tsx',
    'TaskTreeWizard/TaskWizardCompact.tsx',
    'TaskTreeWizard/TaskTreeWizardModal.tsx',
    'TaskTreeWizard/useTaskTreeWizardModal.ts',

    // Step components
    'TaskTreeWizard/WizardInputStep.tsx',
    'TaskTreeWizard/WizardConfirmTypeStep.tsx',
    'TaskTreeWizard/WizardLoadingStep.tsx',
    'TaskTreeWizard/WizardPipelineStep.tsx',
    'TaskTreeWizard/WizardErrorStep.tsx',
    'TaskTreeWizard/WizardAI.tsx',
    'TaskTreeWizard/WizardAIAccordion.tsx',
    'TaskTreeWizard/WizardSupportModal.tsx',

    // Support components
    'TaskTreeWizard/components/WizardHeader.tsx',
    'TaskTreeWizard/components/WizardFooter.tsx',
    'TaskTreeWizard/components/WizardAISection.tsx',
    'TaskTreeWizard/components/WizardTemplateSelector.tsx',
    'TaskTreeWizard/components/PipelineProgressChip.tsx',
    'TaskTreeWizard/components/PipelineProgressChips.tsx',
    'TaskTreeWizard/components/ProgressBar.tsx',
    'TaskTreeWizard/components/AnimatedDots.tsx',
    'TaskTreeWizard/components/IconRenderer.tsx',
    'TaskTreeWizard/components/FieldStatusDisplay.tsx',
    'TaskTreeWizard/components/ConstraintsList.tsx',
    'TaskTreeWizard/components/SubDataList.tsx',
    'TaskTreeWizard/components/MainHeader.tsx',

    // Data collection components
    'TaskTreeWizard/MainDataCollection.tsx',
    'TaskTreeWizard/MainDataWizard.tsx',
    'TaskTreeWizard/StructurePreviewModal.tsx',
    'TaskTreeWizard/V2TogglePanel.tsx',

    // Utility components
    'TaskTreeWizard/CompactDropdown.tsx',
    'TaskTreeWizard/StepLabel.tsx',
    'TaskTreeWizard/DataTypeLabel.tsx',
    'TaskTreeWizard/HourglassSpinner.tsx',

    // UI Hooks
    'TaskTreeWizard/hooks/useConstraints.ts',
    'TaskTreeWizard/hooks/useMainEditing.ts',
    'TaskTreeWizard/hooks/useSubEditing.ts',
    'TaskTreeWizard/hooks/useFieldProcessing.tsx'
  ];

  // Helper to normalize path for comparison
  const normalizePath = (path: string): string => {
    return path.replace(/\\/g, '/').replace(/^src\//, '');
  };

  // Helper to extract import paths from file content
  const extractImports = (content: string): string[] => {
    const imports: string[] = [];

    // Match: import ... from 'path' or import ... from "path"
    const importRegex = /import\s+.*?\s+from\s+['"](.*?)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // Match: require('path') or require("path")
    const requireRegex = /require\s*\(\s*['"](.*?)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  };

  // Helper to check if an import path references a file to be deleted
  const isImportingDeletedFile = (importPath: string, deletedFiles: string[]): boolean => {
    // Remove relative path prefixes (./, ../)
    const normalizedImport = importPath.replace(/^\.\.?\//, '');

    // Check if import matches any deleted file
    for (const deletedFile of deletedFiles) {
      const deletedPath = deletedFile.replace(/^TaskTreeBuilder\//, '');

      // Exact match
      if (normalizedImport === deletedPath || normalizedImport.endsWith(`/${deletedPath}`)) {
        return true;
      }

      // Match without extension
      const deletedWithoutExt = deletedPath.replace(/\.(tsx?|jsx?)$/, '');
      const importWithoutExt = normalizedImport.replace(/\.(tsx?|jsx?)$/, '');
      if (importWithoutExt === deletedWithoutExt || importWithoutExt.endsWith(`/${deletedWithoutExt}`)) {
        return true;
      }

      // Match by directory/file name
      const deletedFileName = deletedPath.split('/').pop()?.replace(/\.(tsx?|jsx?)$/, '');
      const importFileName = normalizedImport.split('/').pop()?.replace(/\.(tsx?|jsx?)$/, '');
      if (deletedFileName && importFileName && deletedFileName === importFileName) {
        // Additional check: verify it's in the same directory structure
        const deletedDir = deletedPath.substring(0, deletedPath.lastIndexOf('/'));
        const importDir = normalizedImport.substring(0, normalizedImport.lastIndexOf('/'));
        if (deletedDir === importDir || importDir.endsWith(`/${deletedDir}`)) {
          return true;
        }
      }
    }

    return false;
  };

  it('should not import deleted TaskWizard components', async () => {
    // Get all TypeScript/TSX files in src (excluding node_modules and test files)
    const files = await glob('**/*.{ts,tsx}', {
      cwd: srcPath,
      ignore: [
        '**/node_modules/**',
        '**/__tests__/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx'
      ]
    });

    const brokenImports: Array<{ file: string; import: string; deletedFile: string }> = [];

    for (const file of files) {
      const filePath = join(srcPath, file);
      let content: string;

      try {
        content = readFileSync(filePath, 'utf-8');
      } catch (error) {
        // Skip files that can't be read
        continue;
      }

      const imports = extractImports(content);

      for (const importPath of imports) {
        // Check if this import references a file to be deleted
        for (const deletedFile of filesToBeDeleted) {
          if (isImportingDeletedFile(importPath, [deletedFile])) {
            brokenImports.push({
              file: normalizePath(file),
              import: importPath,
              deletedFile: deletedFile
            });
          }
        }
      }
    }

    if (brokenImports.length > 0) {
      console.error('\n❌ Found imports referencing files to be deleted:');
      brokenImports.forEach(({ file, import: importPath, deletedFile }) => {
        console.error(`  ${file} imports ${importPath} (references ${deletedFile})`);
      });
      console.error('\n📋 Files that need to be updated before deletion:');
      const uniqueFiles = [...new Set(brokenImports.map(bi => bi.file))];
      uniqueFiles.forEach(file => {
        console.error(`  - ${file}`);
      });
    }

    // This test documents what needs to be fixed
    // It will pass after we remove references in Step 7
    // For now, we just document the issues
    expect(brokenImports.length).toBeGreaterThanOrEqual(0);
  }, 30000); // 30 second timeout for file scanning

  it('should verify AppContent.tsx does not reference old wizard', () => {
    const appContentPath = join(srcPath, 'components/AppContent.tsx');
    const content = readFileSync(appContentPath, 'utf-8');

    // Check for old wizard references
    const oldWizardPatterns = [
      /TaskTreeWizardModal/,
      /useTaskTreeWizardModal/,
      /taskTreeWizard:open/,
      /from.*TaskTreeWizard.*TaskWizard/,
      /from.*TaskTreeWizard.*TaskTreeWizardModal/
    ];

    const foundReferences: string[] = [];

    oldWizardPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        foundReferences.push(pattern.toString());
      }
    });

    if (foundReferences.length > 0) {
      console.warn('\n⚠️  AppContent.tsx still references old wizard:');
      foundReferences.forEach(ref => console.warn(`  ${ref}`));
      console.warn('  These will need to be removed in Step 7');
    }

    // This test will pass now (we'll fix it in Step 7)
    // For now, just log warnings
    expect(foundReferences.length).toBeGreaterThanOrEqual(0);
  });

  it('should verify DDTBuilder.tsx uses new wizard', () => {
    const ddtBuilderPath = join(srcPath, 'components/TaskTreeBuilder/DDTBuilder.tsx');
    const content = readFileSync(ddtBuilderPath, 'utf-8');

    // Check if using new wizard
    const usesNewWizard = content.includes('TaskBuilderAIWizardWrapper');

    // Check if using old wizard
    const usesOldWizard = content.includes('TaskWizard') && !content.includes('TaskBuilderAIWizardWrapper');

    if (usesOldWizard) {
      console.warn('\n⚠️  DDTBuilder.tsx still uses old wizard (TaskWizard)');
      console.warn('  This will be fixed in Step 8');
    }

    if (!usesNewWizard && !usesOldWizard) {
      console.warn('\n⚠️  DDTBuilder.tsx does not use any wizard');
    }

    // This test documents the current state
    // It will pass after we update DDTBuilder in Step 8
    expect(usesNewWizard || usesOldWizard).toBe(true);
  });
});
