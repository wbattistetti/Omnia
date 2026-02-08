const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');

let processedFilesCount = 0;
let fixedImportsCount = 0;

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            walkDir(filePath);
        } else if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js'))) {
            processFile(filePath);
        }
    }
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    let fileFixedCount = 0;

    // Calculate relative path from src to utils/Logger
    const relativePath = path.relative(path.dirname(filePath), path.join(srcDir, 'utils', 'Logger'));
    const normalizedPath = relativePath.replace(/\\/g, '/'); // Normalize Windows paths

    // Replace @/utils/Logger with relative path
    const oldImport = /import\s*{\s*([^}]+)\s*}\s*from\s*['"]@\/utils\/Logger['"];?/g;
    const newImport = `import { $1 } from '${normalizedPath}';`;

    content = content.replace(oldImport, (match, imports) => {
        fileFixedCount++;
        fixedImportsCount++;
        return `import { ${imports} } from '${normalizedPath}';`;
    });

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        processedFilesCount++;
        console.log(`✅ Fixed: ${path.relative(rootDir, filePath)} (${fileFixedCount} imports)`);
    }
}

console.log('🚀 Starting Logger import fix...');
walkDir(srcDir);
console.log(`\n🎉 Import fix complete! Processed ${processedFilesCount} files, fixed ${fixedImportsCount} imports.`);
