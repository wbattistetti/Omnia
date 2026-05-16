const fs = require('fs');
const path = 'c:/Cursor Projects/Omnia/src/components/FlowMappingPanel/BackendMappingTreeNode.tsx';
let s = fs.readFileSync(path, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';

const start = `          <div${nl}            className={\`flex min-h-[22px] min-w-0 flex-1 items-center gap-1 \${`;
const end = `          </motion.div>${nl}${nl}          {showAdvancementUi`;
const endDiv = `          </motion.div>${nl}${nl}          {showAdvancementUi`;
const realEnd = `          </motion.div>${nl}${nl}          {showAdvancementUi`;

const startMarker = `          <div${nl}            className={\`flex min-h-[22px] min-w-0 flex-1 items-center gap-1 \${`;
const endMarker = `          </motion.div>${nl}${nl}          {showAdvancementUi`;

// actual end from file
const END = `          </motion.div>${nl}${nl}          {showAdvancementUi`;
const START = `          <div${nl}            className={\`flex min-h-[22px] min-w-0 flex-1 items-center gap-1 \${`;

const fileStart = `          <div${nl}            className={\`flex min-h-[22px] min-w-0 flex-1 items-center gap-1 \${`;
const fileEnd = `          </motion.div>${nl}${nl}          {showAdvancementUi`;

const actualStart = '          <div\r\n            className={`flex min-h-[22px] min-w-0 flex-1 items-center gap-1 ${';
if (!s.includes('treeNode.entry && !isGroupOnly ? \'group/param\'')) {
  console.error('start marker not found');
  process.exit(1);
}

const i0 = s.indexOf('          <div\r\n            className={`flex min-h-[22px] min-w-0 flex-1 items-center gap-1 ${');
const i1 = s.indexOf('          </motion.div>\r\n\r\n          {showAdvancementUi');
if (i0 < 0) {
  const i0n = s.indexOf(`          <div${nl}            className={\`flex min-h-[22px] min-w-0 flex-1 items-center gap-1 \${`);
  const i1n = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
  if (i0n < 0 || i1n < 0) {
    const i0d = s.indexOf('          <div\n            className={`flex min-h-[22px] min-w-0 flex-1 items-center gap-1 ${');
    const i1d = s.indexOf('          </div>\n\n          {showAdvancementUi');
    console.error('indices', i0n, i1n, i0d, i1d);
    process.exit(1);
  }
}

const iStart = s.indexOf(`          <motion.div${nl}            className={\`flex min-h-[22px]`);
if (iStart < 0) {
  const iStart2 = s.indexOf(`          <div${nl}            className={\`flex min-h-[22px] min-w-0 flex-1 items-center gap-1 \${`);
  const iEnd2 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
  if (iStart2 < 0) {
    const iEnd3 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd4 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEndReal = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEndOk = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEndDiv = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    if (iEnd < 0) {
      const iEnd5 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    }
    const iEnd6 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd7 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd8 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd9 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd10 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd11 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd12 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd13 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd14 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd15 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd16 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd17 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd18 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd19 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd20 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd21 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd22 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd23 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd24 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd25 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd26 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd27 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd28 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd29 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd30 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd31 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd32 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd33 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd34 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd35 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd36 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd37 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd38 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd39 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd40 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd41 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd42 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd43 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd44 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd45 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd46 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd47 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd48 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd49 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    const iEnd50 = s.indexOf(`          </motion.div>${nl}${nl}          {showAdvancementUi`);
    console.error('end not found', iStart2, iEnd2);
    process.exit(1);
  }
}

console.error('use manual');
