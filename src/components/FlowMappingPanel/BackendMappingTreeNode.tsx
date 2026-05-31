/**
 * Renderer riga singola per react-arborist: freccia SEND/RECEIVE, label, editor, DnD parametri.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeRendererProps } from 'react-arborist';
import {
  ChevronDown,
  ChevronRight,
  Trash2,
  Pencil,
  StickyNote,
  Table2,
  X,
  AlertTriangle,
  Settings2,
} from 'lucide-react';
import type { BackendArboristNodeData } from './backendMappingArboristData';
import { useBackendMappingTreeContext } from './backendMappingTreeContext';
import { LabelWithPencilEdit, type LabelWithPencilEditHandle } from './LabelWithPencilEdit';
import { MappingRowFields } from './MappingRowFields';
import { MappingParameterToolbarActions } from './MappingParameterToolbarActions';
import { MappingTreeNodeRow } from './MappingTreeNodeRow';
import { setMappingDragLabelGhost } from './mappingDragGhost';
import { writeAgentBackendParamDragData } from '@domain/agentInterface/agentInterfaceDragTypes';
import {
  DND_NEW_BACKEND_PARAM,
  isEphemeralNewSegment,
} from './backendParamInsert';
import { DND_FLOWROW_VAR } from './flowInterfaceDragTypes';
import {
  BackendReceiveArrowIcon,
  BackendSendArrowIcon,
  resolveSendArrowKind,
  sendArrowTitle,
  type SendArrowGlyphKind,
} from './BackendSendArrowIcon';
import { unwrapSessionTreeWireKey } from './bookFromAgendaSessionTree';
import { BackendMappingDominioValoriPanel } from './backendMappingDominioValori';
import { BACKEND_TREE_INDENT_PX, backendDominioValoriCleanTreeInsetPx } from './backendMappingTreeLayout';
import { DropPreviewLine, placementFromY } from './backendMappingTreeDnD';
import type { MappingEntry } from './mappingTypes';
import { renameLeafSegment } from './mappingTreeUtils';
import { buildMappingParamTooltip } from './buildMappingParamTooltip';

const ICON = 'w-3 h-3';
import { MAPPING_ROW_TEXT_CLASS } from './mappingPanelTypography';

const ROW_TEXT = MAPPING_ROW_TEXT_CLASS;

function hasNewParamDrag(e: React.DragEvent): boolean {
  return [...e.dataTransfer.types].includes(DND_NEW_BACKEND_PARAM);
}

function hasFlowRowVarDrag(e: React.DragEvent): boolean {
  const types = e.dataTransfer?.types ? [...e.dataTransfer.types] : [];
  if (types.includes(DND_FLOWROW_VAR)) return true;
  const lower = DND_FLOWROW_VAR.toLowerCase();
  return types.some((t) => t.toLowerCase() === lower);
}

function updateEntry(entries: MappingEntry[], id: string, patch: Partial<MappingEntry>): MappingEntry[] {
  return entries.map((e) => {
    if (e.id !== id) return e;
    const next: MappingEntry = { ...e, ...patch };
    if (Object.prototype.hasOwnProperty.call(patch, 'literalConstant') && patch.literalConstant === undefined) {
      delete (next as MappingEntry & { literalConstant?: string }).literalConstant;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'variableRefId') && patch.variableRefId === undefined) {
      delete (next as MappingEntry & { variableRefId?: string }).variableRefId;
    }
    return next;
  });
}

function removeEntry(entries: MappingEntry[], id: string): MappingEntry[] {
  return entries.filter((e) => e.id !== id);
}

function countDescendantMappingEntries(entries: MappingEntry[], pathKey: string): number {
  const base = pathKey.trim();
  if (!base) return 0;
  const prefix = `${base}.`;
  let n = 0;
  for (const e of entries) {
    const w = e.wireKey.trim();
    if (w.startsWith(prefix)) n += 1;
  }
  return n;
}

export function BackendMappingTreeNode({
  node,
  style,
}: NodeRendererProps<BackendArboristNodeData>) {
  const ctx = useBackendMappingTreeContext();
  const treeNode = node.data.treeNode;
  const rowRef = useRef<HTMLDivElement>(null);
  const labelEditRef = useRef<LabelWithPencilEditHandle>(null);
  const [rowExtra, setRowExtra] = useState<'none' | 'notes' | 'values' | 'config'>('none');

  const {
    entries,
    onEntriesChange,
    listIdPrefix,
    showApiFields,
    enableBackendParamDrop,
    dropIndicator,
    onBackendParamDragOver,
    onInsertBackendParam,
    onBackendFlowVariableDrop,
    pendingLabelEditId,
    onConsumeLabelEditIntent,
    onAbandonEphemeralEntry,
    backendColumn,
    variableOptions,
    onCreateOutputVariable,
    onOutputVariableCreated,
    backendKnownVariableIds,
    backendSendParamKindByWireKey,
    backendSendParamEnumByWireKey,
    backendSendAdvancement,
    embeddedSignatureSubToolbarOpen,
    agentParamDragSource,
    dropLineIndentPx,
    dropLineTone,
    onParameterAnalysisInfo,
  } = ctx;

  useEffect(() => {
    if (embeddedSignatureSubToolbarOpen !== false) return;
    setRowExtra((x) => (x === 'config' ? 'none' : x));
  }, [embeddedSignatureSubToolbarOpen]);

  useEffect(() => {
    setRowExtra('none');
  }, [treeNode.pathKey]);

  const hasChildren = treeNode.children.length > 0;
  const hasEntry = Boolean(treeNode.entry);
  const isSchemaOutline = Boolean(treeNode.entry?.schemaOutlineOnly);
  const isGroupOnly = hasChildren && !hasEntry;
  const isReadOnlyRow = isGroupOnly || isSchemaOutline;
  const canRenameLabel = Boolean(treeNode.entry && !hasChildren && !isSchemaOutline);
  const leafLabelEditable = canRenameLabel;
  const level = node.level;
  const pathKey = treeNode.pathKey;

  const descendantParamCount = useMemo(
    () => countDescendantMappingEntries(entries, pathKey),
    [entries, pathKey]
  );

  const paramTooltip = buildMappingParamTooltip(treeNode.entry);

  const patchEntry = useCallback(
    (patch: Partial<MappingEntry>) => {
      if (!treeNode.entry) return;
      onEntriesChange(updateEntry(entries, treeNode.entry.id, patch));
    },
    [entries, treeNode.entry, onEntriesChange]
  );

  const handleRenameSegment = useCallback(
    (newSegment: string) => {
      if (!treeNode.entry) return;
      const nextPath = renameLeafSegment(pathKey, newSegment);
      onEntriesChange(
        entries.map((e) => {
          if (e.id !== treeNode.entry!.id) return e;
          return { ...e, wireKey: nextPath };
        })
      );
    },
    [entries, treeNode.entry, pathKey, onEntriesChange]
  );

  const handleRemove = useCallback(() => {
    if (!treeNode.entry) return;
    onEntriesChange(removeEntry(entries, treeNode.entry.id));
  }, [entries, treeNode.entry, onEntriesChange]);

  const handleAbandonEphemeral = useCallback(() => {
    if (treeNode.entry) onAbandonEphemeralEntry(treeNode.entry.id);
  }, [treeNode.entry, onAbandonEphemeralEntry]);

  const onRowDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!enableBackendParamDrop) return;
      if (hasFlowRowVarDrag(e)) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        const el = rowRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        onBackendParamDragOver(pathKey, placementFromY(e.clientY, rect, hasChildren));
        return;
      }
      if (!hasNewParamDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      const el = rowRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      onBackendParamDragOver(pathKey, placementFromY(e.clientY, rect, hasChildren));
    },
    [enableBackendParamDrop, hasChildren, pathKey, onBackendParamDragOver]
  );

  const onRowDrop = useCallback(
    (e: React.DragEvent) => {
      if (!enableBackendParamDrop) return;
      if (hasFlowRowVarDrag(e) && onBackendFlowVariableDrop) {
        const el = rowRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const placement = placementFromY(e.clientY, rect, hasChildren);
        onBackendFlowVariableDrop(e, { targetPathKey: pathKey, placement });
        return;
      }
      if (!hasNewParamDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      const el = rowRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      onInsertBackendParam({ targetPathKey: pathKey, placement: placementFromY(e.clientY, rect, hasChildren) });
    },
    [enableBackendParamDrop, hasChildren, pathKey, onInsertBackendParam, onBackendFlowVariableDrop]
  );

  const showBefore =
    enableBackendParamDrop && dropIndicator?.targetPathKey === pathKey && dropIndicator.placement === 'before';
  const showAfter =
    enableBackendParamDrop && dropIndicator?.targetPathKey === pathKey && dropIndicator.placement === 'after';
  const showChildLine =
    enableBackendParamDrop &&
    hasChildren &&
    node.isOpen &&
    dropIndicator?.targetPathKey === pathKey &&
    dropIndicator.placement === 'child';

  const ephemeralNew = Boolean(treeNode.entry && isEphemeralNewSegment(treeNode.segment));

  const canAgentParamDrag = Boolean(
    treeNode.entry && !isReadOnlyRow && agentParamDragSource && !ephemeralNew
  );

  const handleAgentParamDragStart = useCallback(
    (e: React.DragEvent) => {
      if (!canAgentParamDrag || !treeNode.entry || !agentParamDragSource) return;
      const t = e.target as HTMLElement;
      if (t.closest('button, input, textarea, select, [role="combobox"]')) {
        e.preventDefault();
        return;
      }
      e.stopPropagation();
      const side = backendColumn === 'receive' ? 'receive' : 'send';
      writeAgentBackendParamDragData(e.dataTransfer, {
        wireKey: treeNode.entry.wireKey,
        backendTaskId: agentParamDragSource.backendTaskId,
        side,
        ...(agentParamDragSource.backendLabel
          ? { backendLabel: agentParamDragSource.backendLabel }
          : {}),
      });
      setMappingDragLabelGhost(e, treeNode.segment);
    },
    [agentParamDragSource, backendColumn, canAgentParamDrag, treeNode.entry, treeNode.segment]
  );

  const descTitle = paramTooltip;

  const receiveOptional =
    backendColumn === 'receive' && treeNode.entry && !isReadOnlyRow
      ? Boolean(treeNode.entry.sendBindingOptional)
      : false;

  const sendOptionalLabelClass =
    backendColumn === 'send' && treeNode.entry?.sendBindingOptional
      ? 'italic text-slate-400/95 underline decoration-dotted decoration-slate-500/75 underline-offset-[3px]'
      : undefined;

  const receiveOptionalLabelClass =
    backendColumn === 'receive' && treeNode.entry && receiveOptional
      ? 'italic text-slate-400/95 underline decoration-dotted decoration-slate-500/75 underline-offset-[3px]'
      : undefined;

  const segmentToneClass = sendOptionalLabelClass ?? receiveOptionalLabelClass;

  const sendGlyphKind: SendArrowGlyphKind =
    backendColumn === 'send' && treeNode.entry && !isReadOnlyRow
      ? resolveSendArrowKind(treeNode.entry.apiField, treeNode.entry)
      : isSchemaOutline
        ? 'outlineSolid'
        : 'filledSolid';

  const wireKey = treeNode.entry?.wireKey?.trim() ?? '';
  const advancementWireKey = unwrapSessionTreeWireKey(wireKey);
  const showAdvancementUi =
    backendColumn === 'send' &&
    Boolean(treeNode.entry) &&
    !isReadOnlyRow &&
    Boolean(backendSendAdvancement) &&
    !ephemeralNew;

  const dominioValoriAlignPx =
    treeNode.entry && !isReadOnlyRow
      ? backendDominioValoriCleanTreeInsetPx({
          depth: level,
          showAdvancementUi,
          hasOpenApiDrift: Boolean(treeNode.entry.openapiDescriptionDrift),
        })
      : 0;

  const datalistApi = `${listIdPrefix}-api`;
  const datalistVar = `${listIdPrefix}-var`;

  const chevronControl = hasChildren ? (
    <button
      type="button"
      className="rounded p-px text-slate-400 hover:text-slate-200"
      aria-expanded={node.isOpen}
      onClick={(e) => {
        e.stopPropagation();
        node.toggle();
      }}
    >
      {node.isOpen ? <ChevronDown className={ICON} /> : <ChevronRight className={ICON} />}
    </button>
  ) : null;

  const labelIndentPx = level * BACKEND_TREE_INDENT_PX;

  const arrowTitle = isReadOnlyRow
    ? isSchemaOutline
      ? 'Proprietà da schema OpenAPI (solo firma, non mappata sul task)'
      : undefined
    : backendColumn === 'send'
      ? sendArrowTitle(sendGlyphKind)
      : backendColumn === 'receive'
        ? receiveOptional
          ? 'Parametro in ingresso (da API). Opzionale.'
          : 'Parametro in ingresso (da API). Obbligatorio.'
        : 'Parametro';

  const paramArrow = !isGroupOnly ? (
    isSchemaOutline ? null : (
      <span title={arrowTitle}>
        {backendColumn === 'send' ? (
          <BackendSendArrowIcon kind={sendGlyphKind} title={sendArrowTitle(sendGlyphKind)} compact />
        ) : backendColumn === 'receive' ? (
          <BackendReceiveArrowIcon optional={receiveOptional} compact />
        ) : null}
      </span>
    )
  ) : null;

  const advancementCheckbox = showAdvancementUi ? (
    <input
      type="checkbox"
      className="h-3 w-3 cursor-pointer rounded border-slate-500 bg-slate-900 text-teal-500 focus:ring-teal-500/40"
      checked={backendSendAdvancement!.isEnabled(advancementWireKey)}
      onChange={(e) => backendSendAdvancement!.onToggle(advancementWireKey, e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      title="Avanzamento tra batch"
      aria-label="Avanzamento parametro"
    />
  ) : null;

  const labelNode = (
    <>
      {treeNode.entry?.openapiDescriptionDrift ? (
        <span
          className="shrink-0 text-amber-400"
          title={
            treeNode.entry.openapiDescriptionHint
              ? `Descrizione salvata diversa da OpenAPI.\nOpenAPI: ${treeNode.entry.openapiDescriptionHint}`
              : 'Descrizione salvata diversa da OpenAPI'
          }
        >
          <AlertTriangle className={ICON} strokeWidth={2} aria-hidden />
        </span>
      ) : null}
      <LabelWithPencilEdit
        ref={labelEditRef}
        segment={treeNode.segment}
        editable={leafLabelEditable}
        onCommit={handleRenameSegment}
        editIntent={Boolean(treeNode.entry && pendingLabelEditId === treeNode.entry.id)}
        onConsumeEditIntent={onConsumeLabelEditIntent}
        ephemeralNew={ephemeralNew}
        onAbandonEphemeral={ephemeralNew ? handleAbandonEphemeral : undefined}
        inlinePencil={false}
        viewTitle={descTitle}
        segmentClassName={segmentToneClass}
        readOnlyPreferWrap={false}
        textSizeClass={ROW_TEXT}
        hoverHighlight={Boolean(treeNode.entry && !isReadOnlyRow)}
      />
      {hasChildren && descendantParamCount > 0 ? (
        <span
          className={`shrink-0 whitespace-nowrap tabular-nums text-slate-500 ${ROW_TEXT}`}
          aria-label={`${descendantParamCount} proprietà annidate`}
        >
          ({descendantParamCount})
        </span>
      ) : null}
    </>
  );

  const valueEditorNode = (
    <div {...(ephemeralNew ? ({ inert: true } as React.HTMLAttributes<HTMLDivElement>) : {})}>
      <MappingRowFields
        variant="backend"
        entry={treeNode.entry}
        groupOnlyBackend={isGroupOnly}
        schemaOutlineOnly={isSchemaOutline}
        showApiFields={false}
        hideApiFieldColumn
        secondaryFieldsLocked={ephemeralNew}
        suppressFieldTabFocus={Boolean(
          treeNode.entry && (pendingLabelEditId === treeNode.entry.id || ephemeralNew)
        )}
        datalistApiId={datalistApi}
        datalistVarId={datalistVar}
        onPatch={patchEntry}
        backendColumn={backendColumn}
        variableOptions={variableOptions}
        onCreateOutputVariable={onCreateOutputVariable}
        onOutputVariableCreated={onOutputVariableCreated}
        backendKnownVariableIds={backendKnownVariableIds}
        backendSendParamKindByWireKey={backendSendParamKindByWireKey}
        backendSendParamEnumByWireKey={backendSendParamEnumByWireKey}
        compactTypography
      />
    </div>
  );

  return (
    <div style={{ ...style, paddingLeft: 0, overflow: 'visible' }}>
      {showBefore ? <DropPreviewLine indentPx={dropLineIndentPx(level)} tone={dropLineTone} /> : null}
      <div className="relative overflow-visible" style={{ height: style.height }}>
        <MappingTreeNodeRow
          rowRef={rowRef}
          rowClassName="h-full"
          depthIndentPx={labelIndentPx}
          fixedTreeSlots
          isGroup={isGroupOnly}
          chevron={chevronControl}
          arrow={paramArrow}
          labelLeading={advancementCheckbox}
          label={labelNode}
          valueEditor={isGroupOnly || isSchemaOutline ? null : valueEditorNode}
          afterEditor={
            showAdvancementUi && backendSendAdvancement!.isEnabled(advancementWireKey)
              ? backendSendAdvancement.renderEditor(advancementWireKey)
              : null
          }
          toolbar={
            treeNode.entry && !isReadOnlyRow ? (
              <MappingParameterToolbarActions
                onEditName={() => labelEditRef.current?.startEditing()}
                onRemove={handleRemove}
                rowExtra={rowExtra}
                onToggleNotes={() => setRowExtra((x) => (x === 'notes' ? 'none' : 'notes'))}
                onToggleValues={() => setRowExtra((x) => (x === 'values' ? 'none' : 'values'))}
                showConstraint={backendColumn === 'send'}
                onToggleConstraint={() => setRowExtra((x) => (x === 'config' ? 'none' : 'config'))}
                onOpenParameterAnalysis={
                  onParameterAnalysisInfo && treeNode.entry
                    ? () =>
                        onParameterAnalysisInfo(
                          unwrapSessionTreeWireKey(treeNode.entry!.wireKey)
                        )
                    : undefined
                }
              />
            ) : null
          }
          draggable={canAgentParamDrag}
          onDragStart={canAgentParamDrag ? handleAgentParamDragStart : undefined}
          onDragOver={onRowDragOver}
          onDragOverCapture={onRowDragOver}
          onDrop={onRowDrop}
          rowProps={{
            'data-backend-map-row': pathKey,
            'data-backend-map-has-children': hasChildren ? '1' : '0',
          }}
        />

        {treeNode.entry && rowExtra === 'notes' ? (
          <div
            className="absolute left-0 z-40 mt-0.5 w-[min(24rem,calc(100vw-2rem))] rounded-md border border-amber-600/35 bg-slate-950/95 px-2 py-1.5 shadow-lg"
            style={{ marginLeft: dominioValoriAlignPx }}
          >
            {treeNode.entry.openapiDescriptionDrift && treeNode.entry.openapiDescriptionHint ? (
              <div className="mb-2 rounded border border-amber-700/45 bg-amber-950/40 px-2 py-1.5 text-xs text-amber-100/95">
                <div className="font-semibold text-amber-200/95">Riferimento OpenAPI</div>
                <p className="mt-1 whitespace-pre-wrap text-amber-50/90">{treeNode.entry.openapiDescriptionHint}</p>
              </div>
            ) : null}
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className={`${ROW_TEXT} font-medium text-amber-200/90`}>Descrizione (locale)</span>
              <button
                type="button"
                className="shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-amber-200"
                aria-label="Chiudi"
                onClick={() => setRowExtra('none')}
              >
                <X className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            </div>
            <textarea
              className={`w-full min-h-[4rem] rounded-md border border-amber-600/40 bg-slate-950/90 px-2 py-1.5 ${ROW_TEXT} text-amber-50/95 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50`}
              placeholder="Descrizione del campo"
              value={treeNode.entry.fieldDescription ?? ''}
              onChange={(e) => patchEntry({ fieldDescription: e.target.value })}
            />
          </div>
        ) : null}

        {treeNode.entry && rowExtra === 'values' ? (
          <BackendMappingDominioValoriPanel
            values={treeNode.entry.sampleValues ?? []}
            onChange={(sampleValues) => patchEntry({ sampleValues })}
            entryId={treeNode.entry.id}
            onClose={() => setRowExtra('none')}
            alignInsetPx={dominioValoriAlignPx}
          />
        ) : null}

        {backendColumn === 'send' && treeNode.entry && rowExtra === 'config' ? (
          <div
            className="absolute z-40 mt-0.5 max-w-md rounded-md border border-sky-500/45 bg-slate-900/95 shadow-lg ring-1 ring-slate-700/30"
            style={{ marginLeft: dominioValoriAlignPx, width: `min(20rem, calc(100% - ${dominioValoriAlignPx}px))` }}
            role="dialog"
          >
            <div className="flex items-start justify-between gap-2 border-b border-sky-600/35 bg-sky-950/35 px-2 py-1.5">
              <h2 className={`${ROW_TEXT} font-semibold text-slate-100`}>Parameter constraint</h2>
              <button
                type="button"
                className="rounded p-0.5 text-slate-400 hover:bg-slate-800"
                aria-label="Close"
                onClick={() => setRowExtra('none')}
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
            <div className="flex flex-col gap-0.5 px-2 py-1.5">
              {(
                [
                  {
                    id: 'design',
                    label: 'Mandatory (design-time)',
                    active:
                      !treeNode.entry.sendBindingOptional &&
                      treeNode.entry.sendBindingBindingPhase !== 'runtime',
                    patch: {
                      sendBindingOptional: false,
                      sendBindingBindingPhase: 'design' as const,
                      sendBindingDesignTimeRequired: true,
                    },
                  },
                  {
                    id: 'runtime',
                    label: 'Mandatory (runtime)',
                    active:
                      !treeNode.entry.sendBindingOptional &&
                      treeNode.entry.sendBindingBindingPhase === 'runtime',
                    patch: {
                      sendBindingOptional: false,
                      sendBindingBindingPhase: 'runtime' as const,
                      sendBindingDesignTimeRequired: false,
                    },
                  },
                  {
                    id: 'optional',
                    label: 'Optional',
                    active: Boolean(treeNode.entry.sendBindingOptional),
                    patch: {
                      sendBindingOptional: true,
                      sendBindingBindingPhase: 'design' as const,
                      sendBindingDesignTimeRequired: false,
                    },
                  },
                ] as const
              ).map(({ id, label, active, patch }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => patchEntry(patch)}
                  className={`flex w-full items-center gap-2 rounded-sm py-1 pl-1 pr-1.5 text-left ${ROW_TEXT} ${
                    active ? 'border-l-2 border-sky-400 bg-sky-950/15 font-semibold text-sky-50' : 'text-slate-300 hover:bg-slate-800/35'
                  }`}
                >
                  <span
                    className={`h-3 w-3 shrink-0 rounded-full border-2 ${
                      active ? 'border-sky-400 bg-sky-500' : 'border-slate-500'
                    }`}
                    aria-hidden
                  />
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {showChildLine ? <DropPreviewLine indentPx={dropLineIndentPx(level + 1)} tone={dropLineTone} /> : null}
      </div>
      {showAfter ? <DropPreviewLine indentPx={dropLineIndentPx(level)} tone={dropLineTone} /> : null}
    </div>
  );
}
