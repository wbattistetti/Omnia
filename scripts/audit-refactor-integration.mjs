#!/usr/bin/env node
/**
 * Audit refactor integration: reports what was factored into packages,
 * what is wired at runtime, and what remains parked or duplicated.
 *
 * Usage: node scripts/audit-refactor-integration.mjs [--json]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const STATUS = {
  INTEGRATED: 'integrated',
  SHIM: 'shim',
  PARKED: 'parked',
  LEGACY_DUPLICATE: 'legacy_duplicate',
  MISSING: 'missing',
};

/** @typedef {{ id: string; name: string; packagePath?: string; status: string; consumers: string[]; evidence: string; blocking?: boolean }} AuditEntry */

/** @type {AuditEntry[]} */
const entries = [];
/** @type {string[]} */
const failures = [];

function rel(p) {
  return path.relative(REPO_ROOT, p).replace(/\\/g, '/');
}

function walkFiles(dir, { ext = ['.ts', '.tsx', '.js', '.jsx'], skipDirs = new Set(['node_modules', 'dist', '.git']) } = {}) {
  /** @type {string[]} */
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (skipDirs.has(name)) continue;
      out.push(...walkFiles(full, { ext, skipDirs }));
    } else if (ext.some((e) => name.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function isShimReExport(content) {
  const trimmed = content.trim();
  return (
    /^\/\*\*[\s\S]*?\*\/\s*export \* from ['"]@omnia\/domain-core/.test(trimmed) ||
    /^\/\*\*[\s\S]*?\*\/\s*export \{[\s\S]*\} from ['"]@omnia\/domain-(core|components)/.test(trimmed)
  );
}

function findImportConsumers(prefixes, searchRoots) {
  /** @type {Map<string, Set<string>>} */
  const map = new Map();
  for (const prefix of prefixes) {
    map.set(prefix, new Set());
  }

  const importFromRe = /from\s+['"]([^'"]+)['"]/g;

  for (const root of searchRoots) {
    for (const file of walkFiles(root)) {
      const content = readText(file);
      let m;
      while ((m = importFromRe.exec(content)) !== null) {
        const spec = m[1];
        for (const prefix of prefixes) {
          if (spec.startsWith(prefix) || spec === prefix.replace(/\/$/, '')) {
            map.get(prefix).add(rel(file));
          }
        }
      }
    }
  }
  return map;
}

function countPropUsage(propName, searchRoots) {
  /** @type {Set<string>} */
  const files = new Set();
  const re = new RegExp(`\\b${propName}\\s*=`, 'g');
  for (const root of searchRoots) {
    for (const file of walkFiles(root)) {
      if (re.test(readText(file))) files.add(rel(file));
    }
  }
  return [...files];
}

function listPackageExports(packageSrcDir) {
  if (!fs.existsSync(packageSrcDir)) return [];
  return walkFiles(packageSrcDir, { ext: ['.ts', '.tsx'] }).filter(
    (f) => !f.includes('__tests__') && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx')
  );
}

function addEntry(entry) {
  entries.push(entry);
  if (entry.blocking) {
    failures.push(`${entry.id}: ${entry.evidence}`);
  }
}

function checkViteAliases() {
  const vitePath = path.join(REPO_ROOT, 'vite.config.ts');
  const portalVitePath = path.join(REPO_ROOT, 'use-case-review-portal/vite.config.ts');
  const vite = readText(vitePath);
  const portalVite = readText(portalVitePath);

  const checks = [
    {
      id: 'alias.domain-core',
      label: 'Vite alias @omnia/domain-core → packages',
      ok: vite.includes('packages/omnia-domain-core/src'),
      file: 'vite.config.ts',
    },
    {
      id: 'alias.domain-components',
      label: 'Vite alias @omnia/domain-components → packages',
      ok: vite.includes('packages/omnia-domain-components/src'),
      file: 'vite.config.ts',
    },
    {
      id: 'alias.domain-bundle',
      label: 'Vite alias @domain/useCaseBundle → domain-core bundle',
      ok: vite.includes('packages/omnia-domain-core/src/usecase/bundle'),
      file: 'vite.config.ts',
    },
    {
      id: 'alias.domain-logic',
      label: 'Vite alias @domain/aiAgentUseCase → domain-core logic',
      ok: vite.includes('packages/omnia-domain-core/src/usecase/logic'),
      file: 'vite.config.ts',
    },
    {
      id: 'alias.portal-components',
      label: 'Portal Vite alias @omnia/domain-components',
      ok: portalVite.includes('packages/omnia-domain-components/src'),
      file: 'use-case-review-portal/vite.config.ts',
    },
  ];

  for (const c of checks) {
    addEntry({
      id: c.id,
      name: c.label,
      status: c.ok ? STATUS.INTEGRATED : STATUS.MISSING,
      consumers: [c.file],
      evidence: c.ok ? `Configured in ${c.file}` : `Missing or wrong path in ${c.file}`,
      blocking: !c.ok,
    });
  }
}

function checkDomainCoreIntegration() {
  const packageDir = path.join(REPO_ROOT, 'packages/omnia-domain-core/src');
  const legacyBundle = path.join(REPO_ROOT, 'src/domain/useCaseBundle');
  const legacyLogic = path.join(REPO_ROOT, 'src/domain/aiAgentUseCase');

  const searchRoots = [
    path.join(REPO_ROOT, 'src'),
    path.join(REPO_ROOT, 'use-case-review-portal/src'),
    path.join(REPO_ROOT, 'packages/omnia-domain-components/src'),
  ];

  const domainImportConsumers = findImportConsumers(
    ['@domain/useCaseBundle/', '@domain/aiAgentUseCase/', '@omnia/domain-core'],
    searchRoots
  );

  const omniaConsumers = [
    ...domainImportConsumers.get('@domain/useCaseBundle/'),
    ...domainImportConsumers.get('@domain/aiAgentUseCase/'),
  ].filter((f) => f.startsWith('src/'));

  addEntry({
    id: 'domain-core.bundle-logic',
    name: '@omnia/domain-core (bundle + logic via @domain alias)',
    packagePath: rel(packageDir),
    status: omniaConsumers.length > 0 ? STATUS.INTEGRATED : STATUS.MISSING,
    consumers: [...new Set(omniaConsumers)].slice(0, 12),
    evidence:
      omniaConsumers.length > 0
        ? `${omniaConsumers.length} Omnia/portal files import via @domain/* (resolved to package by Vite)`
        : 'No @domain/useCaseBundle or @domain/aiAgentUseCase imports found',
    blocking: omniaConsumers.length === 0,
  });

  const legacyBundleFiles = listPackageExports(legacyBundle);
  const legacyLogicFiles = listPackageExports(legacyLogic);
  if (legacyBundleFiles.length > 0 || legacyLogicFiles.length > 0) {
    addEntry({
      id: 'domain-core.legacy-copies',
      name: 'Legacy copies under src/domain (should not be imported directly)',
      status: STATUS.LEGACY_DUPLICATE,
      consumers: [],
      evidence: `${legacyBundleFiles.length} files in src/domain/useCaseBundle, ${legacyLogicFiles.length} in src/domain/aiAgentUseCase — bypassed by Vite alias but should be removed`,
      blocking: false,
    });
  }

  const relativeLegacyImports = [];
  const relativeRe =
    /from\s+['"](?:\.\.?\/)[^'"]*(?:domain\/useCaseBundle|domain\/aiAgentUseCase)/g;
  for (const root of searchRoots) {
    for (const file of walkFiles(root)) {
      const content = readText(file);
      if (!relativeRe.test(content)) continue;
      relativeLegacyImports.push(rel(file));
    }
  }
  addEntry({
    id: 'domain-core.no-relative-legacy',
    name: 'No relative imports to src/domain/useCaseBundle|aiAgentUseCase',
    status: relativeLegacyImports.length === 0 ? STATUS.INTEGRATED : STATUS.MISSING,
    consumers: relativeLegacyImports.slice(0, 10),
    evidence:
      relativeLegacyImports.length === 0
        ? 'All imports use @domain/* alias'
        : `Found ${relativeLegacyImports.length} relative legacy imports`,
    blocking: relativeLegacyImports.length > 0,
  });

  const shims = walkFiles(path.join(REPO_ROOT, 'src')).filter((f) => {
    if (f.includes('node_modules')) return false;
    const c = readText(f);
    return isShimReExport(c);
  });
  addEntry({
    id: 'domain-core.shims',
    name: 'Shim re-exports in src → @omnia/domain-core',
    status: shims.length > 0 ? STATUS.SHIM : STATUS.PARKED,
    consumers: shims.map(rel),
    evidence: `${shims.length} shim file(s) forward to package`,
  });
}

function checkDomainComponentsIntegration() {
  const packageDir = path.join(REPO_ROOT, 'packages/omnia-domain-components/src');
  const searchRoots = [
    path.join(REPO_ROOT, 'src'),
    path.join(REPO_ROOT, 'use-case-review-portal/src'),
  ];

  const consumers = findImportConsumers(
    [
      '@domain/useCaseBundle/',
      '@domain/aiAgentUseCase/',
      '@omnia/domain-components',
      './minimal',
    ],
    searchRoots
  );

  const portalDirect = [...consumers.get('@omnia/domain-components')].filter((f) =>
    f.startsWith('use-case-review-portal/')
  );

  addEntry({
    id: 'domain-components.use-case-review-panel',
    name: 'UseCaseReviewPanel (@omnia/domain-components)',
    packagePath: rel(path.join(packageDir, 'usecase/UseCaseReviewPanel.tsx')),
    status: portalDirect.length > 0 ? STATUS.INTEGRATED : STATUS.MISSING,
    consumers: portalDirect,
    evidence:
      portalDirect.length > 0
        ? 'Portal imports @omnia/domain-components directly'
        : 'Portal does not import domain-components',
    blocking: portalDirect.length === 0,
  });

  const minimalDir = path.join(
    REPO_ROOT,
    'src/components/TaskEditor/EditorHost/editors/aiAgentEditor/minimal'
  );
  const minimalExists = fs.existsSync(minimalDir);
  addEntry({
    id: 'domain-components.no-minimal-shim',
    name: 'No legacy minimal/ shim in Omnia (portal uses package directly)',
    status: !minimalExists ? STATUS.INTEGRATED : STATUS.LEGACY_DUPLICATE,
    consumers: minimalExists ? [rel(minimalDir)] : [],
    evidence: minimalExists
      ? 'Remove src/.../minimal — portale importa @omnia/domain-components'
      : 'minimal/ removed; single source in packages/omnia-domain-components',
    blocking: minimalExists,
  });

  const composerPath = path.join(
    REPO_ROOT,
    'src/components/TaskEditor/EditorHost/editors/aiAgentEditor/AIAgentUseCaseComposer.tsx'
  );
  const composerContent = fs.existsSync(composerPath) ? readText(composerPath) : '';
  const composerUsesReviewPanel =
    composerContent.includes('UseCaseReviewPanel') ||
    composerContent.includes('@omnia/domain-components') ||
    composerContent.includes('./minimal');
  addEntry({
    id: 'domain-components.composer-not-review-panel',
    name: 'Omnia composer full wizard (no review panel shortcut)',
    status: !composerUsesReviewPanel ? STATUS.INTEGRATED : STATUS.MISSING,
    consumers: composerUsesReviewPanel ? [rel(composerPath)] : [],
    evidence: composerUsesReviewPanel
      ? 'Composer still embeds review panel — use @omnia/domain-components only in portal'
      : 'Composer is full wizard; portal alone uses domain-components',
    blocking: composerUsesReviewPanel,
  });
  const structuredConsumers = [];
  for (const root of searchRoots) {
    for (const file of walkFiles(root)) {
      const content = readText(file);
      if (
        /AgentReviewStructuredSectionsBlock|TaskStructuredViewerPanel/.test(content) &&
        !file.includes('AgentReviewStructuredSectionsBlock.tsx') &&
        !file.includes('TaskStructuredViewerPanel.tsx')
      ) {
        structuredConsumers.push(rel(file));
      }
    }
  }
  addEntry({
    id: 'domain-components.task-structured-viewer',
    name: 'Structured sections block (AgentReviewStructuredSectionsBlock)',
    packagePath: rel(path.join(packageDir, 'task/AgentReviewStructuredSectionsBlock.tsx')),
    status: structuredConsumers.length > 0 ? STATUS.INTEGRATED : STATUS.PARKED,
    consumers: structuredConsumers,
    evidence:
      structuredConsumers.length > 0
        ? 'Imported outside package'
        : 'Exported from package but not wired in Omnia or portal yet',
  });
}

function checkPortalDecoupling() {
  const portalSrc = path.join(REPO_ROOT, 'use-case-review-portal/src');
  const forbidden = [
    { pattern: '@components/', label: '@components' },
    { pattern: 'AIAgentUseCaseComposer', label: 'AIAgentUseCaseComposer' },
    { pattern: '@responseEditor/', label: '@responseEditor' },
    { pattern: 'ReviewOmniaProviders', label: 'ReviewOmniaProviders' },
  ];

  /** @type {string[]} */
  const violations = [];
  for (const file of walkFiles(portalSrc)) {
    const content = readText(file);
    for (const f of forbidden) {
      const fromRe = new RegExp(
        `from\\s+['"]${f.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
        'g'
      );
      if (fromRe.test(content)) {
        violations.push(`${rel(file)} imports ${f.label}`);
      }
    }
  }
  const uniqueViolations = [...new Set(violations)];

  addEntry({
    id: 'portal.decoupled',
    name: 'Review portal decoupled from Omnia composer',
    status: uniqueViolations.length === 0 ? STATUS.INTEGRATED : STATUS.MISSING,
    consumers: uniqueViolations.slice(0, 10),
    evidence:
      uniqueViolations.length === 0
        ? 'Portal src does not import composer/ResponseEditor/@components'
        : `${uniqueViolations.length} forbidden import(s) in portal`,
    blocking: uniqueViolations.length > 0,
  });

  const appMain = readText(path.join(portalSrc, 'main.tsx'));
  addEntry({
    id: 'portal.no-review-providers',
    name: 'ReviewOmniaProviders not mounted in portal main',
    status: appMain.includes('ReviewOmniaProviders') ? STATUS.MISSING : STATUS.INTEGRATED,
    consumers: ['use-case-review-portal/src/main.tsx'],
    evidence: appMain.includes('ReviewOmniaProviders')
      ? 'ReviewOmniaProviders still mounted'
      : 'Portal boots without Omnia context providers',
  });
}

function checkPackageInventory() {
  const coreFiles = listPackageExports(path.join(REPO_ROOT, 'packages/omnia-domain-core/src'));
  const componentFiles = listPackageExports(
    path.join(REPO_ROOT, 'packages/omnia-domain-components/src')
  );

  addEntry({
    id: 'inventory.domain-core',
    name: 'Package inventory @omnia/domain-core',
    packagePath: 'packages/omnia-domain-core/src',
    status: coreFiles.length > 0 ? STATUS.INTEGRATED : STATUS.MISSING,
    consumers: [],
    evidence: `${coreFiles.length} source module(s) in package`,
  });

  addEntry({
    id: 'inventory.domain-components',
    name: 'Package inventory @omnia/domain-components',
    packagePath: 'packages/omnia-domain-components/src',
    status: componentFiles.length > 0 ? STATUS.INTEGRATED : STATUS.MISSING,
    consumers: [],
    evidence: `${componentFiles.length} source module(s) in package`,
  });

  const coreTests = walkFiles(path.join(REPO_ROOT, 'packages/omnia-domain-core')).filter((f) =>
    f.includes('__tests__') || f.endsWith('.test.ts')
  );
  const componentTests = walkFiles(path.join(REPO_ROOT, 'packages/omnia-domain-components')).filter(
    (f) => f.includes('__tests__') || f.endsWith('.test.ts') || f.endsWith('.test.tsx')
  );

  addEntry({
    id: 'tests.domain-core',
    name: 'Automated tests for domain-core',
    status: coreTests.length > 0 ? STATUS.INTEGRATED : STATUS.MISSING,
    consumers: coreTests.slice(0, 5).map(rel),
    evidence: `${coreTests.length} test file(s)`,
  });

  addEntry({
    id: 'tests.domain-components',
    name: 'Automated tests for domain-components',
    status: componentTests.length > 0 ? STATUS.INTEGRATED : STATUS.PARKED,
    consumers: componentTests.map(rel),
    evidence:
      componentTests.length > 0
        ? `${componentTests.length} test file(s)`
        : 'Add component tests under packages/omnia-domain-components',
  });
}

function statusLabel(status) {
  switch (status) {
    case STATUS.INTEGRATED:
      return 'INTEGRATED';
    case STATUS.SHIM:
      return 'SHIM';
    case STATUS.PARKED:
      return 'NOT INTEGRATED';
    case STATUS.LEGACY_DUPLICATE:
      return 'LEGACY DUPLICATE';
    case STATUS.MISSING:
      return 'MISSING';
    default:
      return status.toUpperCase();
  }
}

function statusIcon(status) {
  switch (status) {
    case STATUS.INTEGRATED:
      return '[OK]';
    case STATUS.SHIM:
      return '[SHIM]';
    case STATUS.PARKED:
      return '[PARKED]';
    case STATUS.LEGACY_DUPLICATE:
      return '[LEGACY]';
    case STATUS.MISSING:
      return '[FAIL]';
    default:
      return '[?]';
  }
}

function printReport() {
  const grouped = {
    integrated: entries.filter((e) => e.status === STATUS.INTEGRATED),
    shim: entries.filter((e) => e.status === STATUS.SHIM),
    parked: entries.filter((e) => e.status === STATUS.PARKED),
    legacy: entries.filter((e) => e.status === STATUS.LEGACY_DUPLICATE),
    missing: entries.filter((e) => e.status === STATUS.MISSING),
  };

  console.log('\nREFACTOR INTEGRATION REPORT');
  console.log('===========================\n');

  for (const e of entries) {
    console.log(`${statusIcon(e.status)} ${statusLabel(e.status).padEnd(16)} ${e.name}`);
    console.log(`    ${e.evidence}`);
    if (e.consumers.length > 0) {
      console.log(`    consumers: ${e.consumers.slice(0, 5).join(', ')}${e.consumers.length > 5 ? ` (+${e.consumers.length - 5})` : ''}`);
    }
    if (e.packagePath) {
      console.log(`    package: ${e.packagePath}`);
    }
    console.log('');
  }

  console.log('SUMMARY');
  console.log('-------');
  console.log(`Integrated:        ${grouped.integrated.length}`);
  console.log(`Shim (re-export):  ${grouped.shim.length}`);
  console.log(`Not integrated:    ${grouped.parked.length}`);
  console.log(`Legacy duplicate:  ${grouped.legacy.length}`);
  console.log(`Missing / failed:  ${grouped.missing.length}`);
  console.log('');

  if (failures.length > 0) {
    console.log('BLOCKING ISSUES');
    console.log('---------------');
    for (const f of failures) {
      console.log(`  - ${f}`);
    }
    console.log('');
  }
}

function main() {
  const jsonOut = process.argv.includes('--json');

  checkViteAliases();
  checkDomainCoreIntegration();
  checkDomainComponentsIntegration();
  checkPortalDecoupling();
  checkPackageInventory();

  if (jsonOut) {
    console.log(JSON.stringify({ entries, failures, summary: {
      integrated: entries.filter((e) => e.status === STATUS.INTEGRATED).length,
      shim: entries.filter((e) => e.status === STATUS.SHIM).length,
      parked: entries.filter((e) => e.status === STATUS.PARKED).length,
      legacy: entries.filter((e) => e.status === STATUS.LEGACY_DUPLICATE).length,
      missing: entries.filter((e) => e.status === STATUS.MISSING).length,
      blockingFailures: failures.length,
    }}, null, 2));
  } else {
    printReport();
  }

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main();
