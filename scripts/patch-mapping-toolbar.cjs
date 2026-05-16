const fs = require('fs');
const p = 'src/components/FlowMappingPanel/FlowMappingTree.tsx';
let s = fs.readFileSync(p, 'utf8');

s = s.replace(
  '<motion.div className={`relative ${depthLegacyGutter}`}>',
  '<div className={`relative overflow-visible ${depthLegacyGutter}`}>'
);
s = s.replace(
  '<div className={`relative ${depthLegacyGutter}`}>',
  '<div className={`relative overflow-visible ${depthLegacyGutter}`}>'
);

const toolbarOld =
  /          \{variant === 'backend' && node\.entry && !isGroupOnly && \([\s\S]*?          \)\}\n          <div\n            className=\{\`min-w-0 flex-1 flex/;
if (!toolbarOld.test(s)) {
  console.error('toolbar block not found');
  process.exit(1);
}
s = s.replace(toolbarOld, '          <motion.div\n            className={`min-w-0 flex-1 flex');
s = s.replace(
  '          <motion.div\n            className={`min-w-0 flex-1 flex',
  '          <div\n            className={`min-w-0 flex-1 flex'
);

const paramWrapOld = `          <div
            className={\`flex \${rowMinH} min-w-0 shrink-0 items-center gap-0 pl-0\`}
          {...(variant === 'backend' && ephemeralNew ? ({ inert: true } as React.HTMLAttributes<HTMLDivElement>) : {})}
        >
          <MappingRowFields`;

const paramWrapNew = `          <div
            className={\`group/param-box relative flex \${rowMinH} min-w-0 shrink-0 items-center gap-0 overflow-visible pl-0\`}
          {...(variant === 'backend' && ephemeralNew ? ({ inert: true } as React.HTMLAttributes<HTMLDivElement>) : {})}
        >
          <MappingRowFields`;

if (!s.includes(paramWrapOld)) {
  console.error('param wrap not found');
  process.exit(1);
}
s = s.replace(paramWrapOld, paramWrapNew);

const afterFields = `            backendSendParamEnumByWireKey={backendSendParamEnumByWireKey}
          />
        </div>`;

const backendToolbar = `            backendSendParamEnumByWireKey={backendSendParamEnumByWireKey}
          />
          {variant === 'backend' && node.entry && !isGroupOnly ? (
            <MappingParameterRowToolbar>
              <button
                type="button"
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-amber-200"
                title="Modifica nome interno"
                aria-label="Modifica nome interno"
                onClick={() => labelEditRef.current?.startEditing()}
              >
                <Pencil className={iconSm} strokeWidth={2} />
              </button>
              <button
                type="button"
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-red-400"
                title="Rimuovi parametro"
                aria-label="Rimuovi parametro"
                onClick={handleRemove}
              >
                <Trash2 className={iconSm} strokeWidth={2} />
              </button>
              <button
                type="button"
                className={\`rounded p-1 hover:bg-slate-800 \${rowExtra === 'notes' ? 'text-amber-300' : 'text-slate-400 hover:text-amber-200'}\`}
                title="Descrizione campo"
                aria-label="Descrizione campo"
                onClick={() => setRowExtra((x) => (x === 'notes' ? 'none' : 'notes'))}
              >
                <StickyNote className={iconSm} strokeWidth={2} />
              </button>
              <button
                type="button"
                className={\`rounded p-1 hover:bg-slate-800 \${rowExtra === 'values' ? 'text-sky-300' : 'text-slate-400 hover:text-sky-200'}\`}
                title="Dominio valori"
                aria-label="Dominio valori"
                onClick={() => setRowExtra((x) => (x === 'values' ? 'none' : 'values'))}
              >
                <Table2 className={iconSm} strokeWidth={2} />
              </button>
              {backendColumn === 'send' ? (
                <button
                  type="button"
                  className={\`rounded p-1 hover:bg-slate-800 \${rowExtra === 'config' ? 'text-sky-300' : 'text-slate-400 hover:text-sky-200'}\`}
                  title="Parameter constraint"
                  aria-label="Parameter constraint"
                  onClick={() => setRowExtra((x) => (x === 'config' ? 'none' : 'config'))}
                >
                  <Settings2 className={iconSm} strokeWidth={2} />
                </button>
              ) : null}
            </MappingParameterRowToolbar>
          ) : null}
        </div>`;

if (!s.includes(afterFields)) {
  console.error('after fields marker not found');
  process.exit(1);
}
s = s.replace(afterFields, backendToolbar);

const ifaceDelete = `        {node.entry && variant === 'interface' && (
          <button
            type="button"
            className="shrink-0 p-1 rounded text-slate-600 opacity-0 group-hover/row:opacity-100 hover:text-red-400 focus:opacity-100 focus:outline-none"
            aria-label="Rimuovi mapping"
            onClick={handleRemove}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}`;
s = s.replace(ifaceDelete, '');

const ifaceToolbarAnchor = `            {collapsedParamCountSuffix}
          </div>
        </motion.div>

          <div`;
const ifaceToolbarAnchorNew = `            {collapsedParamCountSuffix}
          </div>
          {variant === 'interface' && node.entry && !isGroupOnly ? (
            <MappingParameterRowToolbar>
              <button
                type="button"
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-red-400"
                title="Rimuovi mapping"
                aria-label="Rimuovi mapping"
                onClick={handleRemove}
              >
                <Trash2 className={iconSm} strokeWidth={2} />
              </button>
            </MappingParameterRowToolbar>
          ) : null}
        </motion.div>

          <div`;

// fix - label slot closes with </div> not motion.div
const ifaceToolbarAnchor2 = `            {collapsedParamCountSuffix}
          </div>
        </div>

          <div`;
const ifaceToolbarAnchorNew2 = `            {collapsedParamCountSuffix}
          </div>
          {variant === 'interface' && node.entry && !isGroupOnly ? (
            <MappingParameterRowToolbar>
              <button
                type="button"
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-red-400"
                title="Rimuovi mapping"
                aria-label="Rimuovi mapping"
                onClick={handleRemove}
              >
                <Trash2 className={iconSm} strokeWidth={2} />
              </button>
            </MappingParameterRowToolbar>
          ) : null}
        </div>

          <div`;

if (s.includes(ifaceToolbarAnchor2)) {
  s = s.replace(ifaceToolbarAnchor2, ifaceToolbarAnchorNew2);
} else if (s.includes(ifaceToolbarAnchor)) {
  s = s.replace(ifaceToolbarAnchor, ifaceToolbarAnchorNew.replace(/motion\.div/g, 'motion.div'));
} else {
  console.error('iface anchor not found');
  process.exit(1);
}

if (s.includes('hover:bg-slate-800/35')) {
  s = s.replace(
    'hover:bg-slate-800/35',
    'transition-colors duration-150 hover:bg-sky-500/[0.09] hover:shadow-[inset_0_0_0_1px_rgba(56,189,248,0.22)]'
  );
}

s = s.replace(
  'flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-y-contain [scrollbar-gutter:auto]',
  'flex min-h-0 flex-1 flex-col gap-1 overflow-x-visible overflow-y-auto overscroll-y-contain [scrollbar-gutter:auto] pt-2'
);

if (!s.includes('MappingParameterRowToolbar')) {
  const imp = "import { MappingParameterRowToolbar } from './MappingParameterRowToolbar';\n";
  s = s.replace(
    "import type { BackendSendAdvancementApi } from './backendMappingTreeTypes';",
    "import type { BackendSendAdvancementApi } from './backendMappingTreeTypes';\n" + imp
  );
}

fs.writeFileSync(p, s);
console.log('patched ok');
