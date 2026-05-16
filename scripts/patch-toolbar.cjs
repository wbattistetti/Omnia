// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/TaskEditor/EditorHost/editors/BackendCallEditor.tsx');
let c = fs.readFileSync(filePath, 'utf8');

// ── Marker: start of old block ──
const START = "    const base: ToolbarButton[] = [\n      {\n        label: mockExecMode";
const END = "        active: advancementEditorWireKey === BACKEND_RECALC_WIRE_KEY,\n      },\n    ];";

const si = c.indexOf(START);
const ei = c.indexOf(END, si);
if (si === -1 || ei === -1) {
  console.error('Markers not found. si=' + si + ' ei=' + ei);
  process.exit(1);
}

const REPLACEMENT = `    const setEmulationMode = () =>
      setConfig((prev) => ({ ...prev, mockTableDefaultExecutionMode: BackendExecutionMode.MOCK }));
    const setRealMode = () =>
      setConfig((prev) => ({ ...prev, mockTableDefaultExecutionMode: BackendExecutionMode.REAL }));

    const base: ToolbarButton[] = [
      // Group 1: Mode pills
      {
        buttonId: 'mode-emulation',
        icon: <Table2 size={14} />,
        label: 'Emulation',
        onClick: setEmulationMode,
        title: 'Simulate backend with test values',
        active: mockExecMode === BackendExecutionMode.MOCK,
        visible: operationalUrlNonEmpty,
      },
      {
        buttonId: 'mode-real',
        icon: <Server size={14} />,
        label: 'Real Call',
        onClick: setRealMode,
        title: 'Execute a real backend call',
        active: mockExecMode === BackendExecutionMode.REAL,
        visible: operationalUrlNonEmpty,
      },
      // Group 2: Actions
      {
        buttonId: 'show-api-column',
        icon: showApiColumn ? <EyeOff size={16} /> : <Eye size={16} />,
        label: showApiColumn ? 'Hide Backend Names' : 'Show Backend Names',
        onClick: () => setShowApiColumn((prev) => !prev),
        title: 'Display the real backend parameter names',
        active: showApiColumn,
      },
      {
        buttonId: 'show-table',
        icon: <Table2 size={16} />,
        label: showTableView ? 'Hide Emulation Table' : 'Emulation Table',
        onClick: () => setShowTableView((prev) => !prev),
        title: showTableView ? 'Hide simulation table' : 'Show simulation table',
        active: showTableView,
      },
      {
        buttonId: 'read-api',
        icon: <BookOpen size={16} />,
        label: readApiBusy ? 'Checking\u2026' : 'Check Update',
        onClick: () => void handleReadApi(),
        title: 'Verify if parameters are up-to-date with backend',
        disabled: readApiBusy,
        visible: readApiToolbarVisible,
      },
      {
        buttonId: 'test-backend',
        icon: <FlaskConical size={16} />,
        label: bulkApiTestBusy ? 'Testing\u2026' : 'Test Backend',
        onClick: () => void handleTestApi(),
        title: 'Execute a real backend call to validate send/return values',
        disabled: bulkApiTestBusy,
        successHighlight: testApiReadiness === 'ready' && !bulkApiTestBusy,
        visible: operationalUrlNonEmpty && mockExecMode === BackendExecutionMode.REAL,
      },
      // Utility
      {
        buttonId: 'hide-receive',
        icon: <Columns2 size={16} />,
        label: receiveMappingPanelVisible ? 'Hide Receive' : 'Show Receive',
        onClick: () => setReceiveMappingPanelVisible((v) => !v),
        title: receiveMappingPanelVisible
          ? 'Nascondi il pannello RECEIVE: tutta la larghezza \u00e8 per SEND.'
          : 'Mostra di nuovo il pannello RECEIVE affiancato a SEND.',
        active: receiveMappingPanelVisible,
        visible: true,
      },
      {
        buttonId: 'ricalcolo',
        icon: <Calculator size={16} />,
        label: 'Ricalcolo backend',
        onClick: () =>
          setAdvancementEditorWireKey((k) =>
            k === BACKEND_RECALC_WIRE_KEY ? null : BACKEND_RECALC_WIRE_KEY
          ),
        title:
          'Mostra o nascondi lo script di ricalcolo su tutti i parametri SEND (area come SEND+RECEIVE). Clic di nuovo per chiudere.',
        visible: operationalUrlNonEmpty && !showTableView,
        active: advancementEditorWireKey === BACKEND_RECALC_WIRE_KEY,
      },
    ];`;

c = c.substring(0, si) + REPLACEMENT + c.substring(ei + END.length);
fs.writeFileSync(filePath, c, 'utf8');
console.log('Toolbar buttons replaced OK. File length:', c.length);
