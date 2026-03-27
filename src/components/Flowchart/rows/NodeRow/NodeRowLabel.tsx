import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Check } from 'lucide-react';
import { createPortal } from 'react-dom';
import { NodeRowActionsOverlay } from './NodeRowActionsOverlay';
import { NodeRowData } from '../../types/project';
import SmartTooltip from '../../../SmartTooltip';
import { taskRepository } from '@services/TaskRepository';
import { useGlobalTestPanel } from '@context/GlobalTestPanelContext';
import { useProjectTranslations } from '@context/ProjectTranslationsContext';
import { buildTaskTreeFromRepository } from '@utils/taskUtils';
import type { WorkspaceState } from '@flows/FlowTypes';
import { buildVariableMenuItemsAsync } from '@components/common/variableMenuModel';
import VariableTokenContextMenu, {
  type VariableMenuRowItem,
} from '@components/common/VariableTokenContextMenu';

// Component to render checkbox with dynamic size based on font
const CheckboxButton: React.FC<{
  labelRef: React.RefObject<HTMLSpanElement>;
  included: boolean;
  setIncluded: (val: boolean) => void;
}> = ({ labelRef, included, setIncluded }) => {
  const [checkboxSize, setCheckboxSize] = useState(16);
  const checkIconSize = Math.round(checkboxSize * 0.7);

  useEffect(() => {
    const updateSize = () => {
      if (labelRef.current) {
        const computedStyle = window.getComputedStyle(labelRef.current);
        const fontSize = parseFloat(computedStyle.fontSize) || 12;
        // Checkbox should be about 105.8% of font size (92% * 1.15), with min/max bounds
        const newSize = Math.max(18, Math.min(29, Math.round(fontSize * 1.058)));
        setCheckboxSize(newSize);
      } else {
        setCheckboxSize(16);
      }
    };

    updateSize();

    // Watch for font size changes
    const observer = new MutationObserver(updateSize);
    if (labelRef.current) {
      observer.observe(labelRef.current, {
        attributes: true,
        attributeFilter: ['style', 'class'],
        subtree: false
      });

      window.addEventListener('resize', updateSize);
      return () => {
        observer.disconnect();
        window.removeEventListener('resize', updateSize);
      };
    }
  }, [labelRef]);

  return (
    <SmartTooltip text="Include this row in the flow" tutorId="include_row_help" placement="bottom">
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: checkboxSize,
          height: checkboxSize,
          marginRight: 6,
          borderRadius: 3,
          border: '1px solid rgba(0,0,0,0.6)',
          background: included ? 'transparent' : '#e5e7eb',
        }}
        onClick={(e) => {
          e.stopPropagation();
          setIncluded(!included);
        }}
      >
        {included ? (
          <Check style={{ width: checkIconSize, height: checkIconSize, color: 'rgba(0,0,0,0.9)' }} />
        ) : null}
      </span>
    </SmartTooltip>
  );
};

// Component to render primary icon with dynamic size based on font
const PrimaryIconButton: React.FC<{
  Icon: React.ComponentType<any>;
  iconSize?: number;
  labelRef: React.RefObject<HTMLSpanElement>;
  included: boolean;
  iconColor: string; // Usa iconColor invece di labelTextColor
  onTypeChangeRequest?: (anchor?: DOMRect) => void;
}> = ({ Icon, iconSize, labelRef, included, iconColor, onTypeChangeRequest }) => {
  const [computedSize, setComputedSize] = useState(12);

  useEffect(() => {
    const updateSize = () => {
      if (typeof iconSize === 'number') {
        setComputedSize(iconSize);
        return;
      }
      if (labelRef.current) {
        const computedStyle = window.getComputedStyle(labelRef.current);
        const fontSize = parseFloat(computedStyle.fontSize) || 12;
        // Icon should be about 119% of font size (103.5% * 1.15), with min/max bounds
        const newSize = Math.max(16, Math.min(32, Math.round(fontSize * 1.19)));
        setComputedSize(newSize);
      } else {
        setComputedSize(12);
      }
    };

    updateSize();

    // Watch for font size changes
    const observer = new MutationObserver(updateSize);
    if (labelRef.current) {
      observer.observe(labelRef.current, {
        attributes: true,
        attributeFilter: ['style', 'class'],
        subtree: false
      });

      // Also listen to resize events
      window.addEventListener('resize', updateSize);
      return () => {
        observer.disconnect();
        window.removeEventListener('resize', updateSize);
      };
    }
  }, [iconSize, labelRef]);

  // Icon color applied (no logging to reduce console clutter)
  useEffect(() => {
    // Color is applied via inline style on the Icon component
  }, [iconColor, computedSize, labelRef]);

  return (
    <SmartTooltip text="Change act type" tutorId="change_act_type_help" placement="bottom">
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            onTypeChangeRequest && onTypeChangeRequest(rect);
          } catch (err) { try { console.warn('[TypePicker][labelIcon][err]', err); } catch { } }
        }}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', padding: 0, marginRight: 4, cursor: 'pointer' }}
      >
        <Icon
          className="inline-block"
          style={{
            width: computedSize,
            height: computedSize,
            color: (!included) ? '#9ca3af' : iconColor // Grigio se unchecked, altrimenti usa iconColor
          }}
        />
      </button>
    </SmartTooltip>
  );
};

// Invisible overlay for empty space between end of text and node right edge
const EmptySpaceOverlay: React.FC<{
  labelRef: React.RefObject<HTMLSpanElement>;
  iconPos: { top: number; left: number };
  onHoverEnter: () => void;
  onHoverLeave: () => void;
}> = ({ labelRef, iconPos, onHoverEnter, onHoverLeave }) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!labelRef.current || !overlayRef.current) {
      if (overlayRef.current) {
        overlayRef.current.style.display = 'none';
      }
      return;
    }

    const updateOverlay = () => {
      if (!labelRef.current || !overlayRef.current) {
        if (overlayRef.current) {
          overlayRef.current.style.display = 'none';
        }
        return;
      }

      const labelRect = labelRef.current.getBoundingClientRect();
      const nodeEl = labelRef.current.closest('.react-flow__node') as HTMLElement | null;
      if (!nodeEl) {
        overlayRef.current.style.display = 'none';
        return;
      }

      const nodeRect = nodeEl.getBoundingClientRect();

      // Calculate empty space: from end of label text to right edge of node
      const labelEnd = labelRect.right;
      const nodeRight = nodeRect.right;
      const emptyWidth = nodeRight - labelEnd;

      if (emptyWidth > 0) {
        overlayRef.current.style.position = 'fixed';
        overlayRef.current.style.left = `${labelEnd}px`;
        overlayRef.current.style.top = `${labelRect.top}px`;
        overlayRef.current.style.width = `${emptyWidth}px`;
        overlayRef.current.style.height = `${labelRect.height}px`;
        overlayRef.current.style.pointerEvents = 'auto';
        overlayRef.current.style.zIndex = '998';
        overlayRef.current.style.display = 'block';
      } else {
        overlayRef.current.style.display = 'none';
      }
    };

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(updateOverlay);
    window.addEventListener('resize', updateOverlay);
    window.addEventListener('scroll', updateOverlay, true);

    return () => {
      window.removeEventListener('resize', updateOverlay);
      window.removeEventListener('scroll', updateOverlay, true);
    };
  }, [labelRef, iconPos]);

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        background: 'transparent',
        border: 'none', // Transparent - no visible border
        borderRadius: '4px',
        pointerEvents: 'auto',
        zIndex: 998,
      }}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
    />
  );
};

interface NodeRowLabelProps {
  row: NodeRowData;
  included: boolean;
  setIncluded: (val: boolean) => void;
  labelRef: React.RefObject<HTMLSpanElement>;
  Icon: React.ComponentType<any> | null;
  showIcons: boolean;
  iconPos: { top: number; left: number } | null;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDrag: (e: React.MouseEvent) => void;
  onLabelDragStart?: (e: React.MouseEvent) => void;
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  bgColor: string;
  labelTextColor: string;
  iconColor?: string; // Colore dell'icona (grigio se no TaskTree, colore del tipo se ha TaskTree)
  iconSize?: number;
  hasTaskTree?: boolean;
  gearColor?: string;
  onOpenTaskTree?: () => void;
  onDoubleClick: () => void;
  onIconsHoverChange?: (v: boolean) => void;
  onLabelHoverChange?: (v: boolean) => void;
  onTypeChangeRequest?: (anchor?: DOMRect) => void; // NEW: request to open type picker with anchor rect
  onRequestClosePicker?: () => void; // NEW: ask parent to close type picker
  buttonCloseTimeoutRef?: React.MutableRefObject<NodeJS.Timeout | null>;
  overlayRef?: React.RefObject<HTMLDivElement>;
  getProjectId?: () => string | undefined; // Project ID getter for testing
  // ✅ Compilation errors props
  rowErrors?: import('../../hooks/useRowErrors').RowErrorsResult;
  onErrorClick?: (e: React.MouseEvent) => void;
  errorIconRef?: React.RefObject<HTMLButtonElement>;
  showErrorPopover?: boolean;
  onCloseErrorPopover?: () => void;
  onErrorFix?: (error: import('../../../../FlowCompiler/types').CompilationError) => void;
  onOpenSemanticValuesEditor?: () => void;
  hasSemanticValues?: boolean;
  semanticValuesAnchorRef?: React.RefObject<HTMLButtonElement | null>;
  /** Nodo nascosto: non montare overlay/toolbar nel body (evita icone flottanti). */
  suppressFloatingChrome?: boolean;
  /** Flow canvas id + workspace flows (Subflow interface toolbar). */
  activeFlowId?: string;
  flows?: WorkspaceState['flows'];
  nodeId?: string;
  /** null = not a Subflow row */
  subflowInterfaceToolbar?: {
    hasOutputs: boolean;
    childFlowId: string;
    /** True while resolving outputs from API when child flow is not in workspace snapshot. */
    loading?: boolean;
  } | null;
}

export const NodeRowLabel: React.FC<NodeRowLabelProps> = ({
  row,
  included,
  setIncluded,
  labelRef,
  Icon,
  showIcons,
  iconPos,
  canDelete,
  onEdit,
  onDelete,
  onDrag,
  onLabelDragStart,
  isEditing,
  setIsEditing,
  bgColor,
  labelTextColor,
  iconColor,
  iconSize,
  hasTaskTree,
  gearColor,
  onOpenTaskTree,
  onDoubleClick,
  onIconsHoverChange,
  onLabelHoverChange,
  onTypeChangeRequest,
  onRequestClosePicker,
  buttonCloseTimeoutRef,
  overlayRef,
  getProjectId,
  rowErrors,
  onErrorClick,
  errorIconRef,
  showErrorPopover,
  onCloseErrorPopover,
  onErrorFix,
  onOpenSemanticValuesEditor,
  hasSemanticValues,
  semanticValuesAnchorRef,
  suppressFloatingChrome = false,
  activeFlowId,
  flows,
  nodeId,
  subflowInterfaceToolbar,
}) => {
  // ✅ ARCHITECTURAL: Use GlobalTestPanel context for testing
  const { openWithTask } = useGlobalTestPanel();
  const { translations } = useProjectTranslations();

  // ✅ Check if task instance exists for this row
  const taskInstance = React.useMemo(() => {
    if (!row?.id) return null;
    return taskRepository.getTask(row.id);
  }, [row?.id]);

  // ✅ Handle test task - opens GlobalTestPanel with task instance
  const [subflowIfaceMenu, setSubflowIfaceMenu] = useState<{
    x: number;
    y: number;
    items: VariableMenuRowItem[];
  } | null>(null);

  const openSubflowInterfaceMenu = useCallback(
    async (anchor: DOMRect) => {
      const pid = getProjectId?.();
      if (!pid?.trim() || !activeFlowId?.trim() || !flows) return;
      try {
        const all = await buildVariableMenuItemsAsync(pid, activeFlowId, flows);
        const filtered = all.filter((i) => i.subflowTaskId === row.id);
        const items: VariableMenuRowItem[] = filtered.map((i) => ({
          varId: i.varId,
          varLabel: i.varLabel,
          tokenLabel: i.tokenLabel,
          ownerFlowId: i.ownerFlowId,
          ownerFlowTitle: i.ownerFlowTitle,
          isExposed: i.isExposed,
          isFromActiveFlow: i.isFromActiveFlow,
          sourceTaskRowLabel: i.sourceTaskRowLabel,
          subflowTaskId: i.subflowTaskId,
          isInterfaceUnbound: i.isInterfaceUnbound,
          missingChildVariableRef: i.missingChildVariableRef,
        }));
        setSubflowIfaceMenu({ x: anchor.left, y: anchor.bottom, items });
      } catch (e) {
        console.error('[NodeRowLabel] Subflow interface menu', e);
      }
    },
    [getProjectId, activeFlowId, flows, row.id]
  );

  const handleTestTask = useCallback(async () => {
    if (!taskInstance) {
      console.warn('[NodeRowLabel] Cannot test: task instance not found for row', row?.id);
      return;
    }

    const projectId = getProjectId?.();
    if (!projectId) {
      console.error('[NodeRowLabel] Cannot test: projectId is required');
      return;
    }

    try {
      // ✅ CRITICAL: Build TaskTree from repository (same routine as Response Editor)
      // buildTaskTreeFromRepository garantisce istanza fresca dal repository (inclusi flag _disabled)
      const result = await buildTaskTreeFromRepository(row.id, projectId);
      if (!result) {
        console.error('[NodeRowLabel] Failed to build TaskTree for task instance', row.id);
        return;
      }
      const { taskTree, instance: freshTaskInstance } = result;

      // ✅ Open GlobalTestPanel with task context (use fresh instance from repository)
      openWithTask(freshTaskInstance, taskTree, projectId, translations);
    } catch (error) {
      console.error('[NodeRowLabel] Error opening test panel:', error);
    }
  }, [taskInstance, getProjectId, openWithTask, translations, row?.id]);

  return (
  <>
    <span
      ref={labelRef}
      className="block cursor-pointer transition-colors flex items-center relative nodrag"
      style={{
        background: included ? 'transparent' : '#f3f4f6',
        color: (() => {
          // Se la row è undefined, usa sempre grigio per il testo
          const isUndefined = (row as any)?.isUndefined === true;
          if (isUndefined) return '#94a3b8';
          return included ? labelTextColor : '#9ca3af';
        })(),
        borderRadius: 4,
        paddingLeft: row.categoryType && Icon ? 4 : 0,
        paddingRight: 8,
        minHeight: '1.5em',
        lineHeight: 1.1,
        marginTop: 0,
        marginBottom: 0,
        whiteSpace: 'nowrap',
        userSelect: 'none',
        cursor: 'grab'
      }}
      onDoubleClick={onDoubleClick}
      onMouseDown={(e) => {
        // consenti drag diretto sulla label quando non si è in editing
        if (!isEditing && typeof onLabelDragStart === 'function') {
          // ✅ IMPORTANTE: stopPropagation PRIMA di chiamare onLabelDragStart
          // per impedire che React Flow intercetti l'evento
          e.stopPropagation();
          onLabelDragStart(e);
        }
      }}
      onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onMouseEnter={() => onLabelHoverChange && onLabelHoverChange(true)}
      onMouseLeave={() => onLabelHoverChange && onLabelHoverChange(false)}
    >
      {Icon && (() => {
        // Se la row è undefined, usa sempre grigio per l'icona
        const isUndefined = (row as any)?.isUndefined === true;
        const finalIconColor = isUndefined ? '#94a3b8' : (iconColor || labelTextColor);
        return (
          <PrimaryIconButton
            Icon={Icon}
            iconSize={iconSize}
            labelRef={labelRef}
            included={included}
            iconColor={finalIconColor}
            onTypeChangeRequest={onTypeChangeRequest}
          />
        );
      })()}
      {/* Gear icon intentionally omitted next to label; shown only in the external actions strip */}
      {row.text}
      {!suppressFloatingChrome &&
        createPortal(
          <EmptySpaceOverlay
            labelRef={labelRef}
            iconPos={iconPos || { top: 0, left: 0 }}
            onHoverEnter={() => onLabelHoverChange && onLabelHoverChange(true)}
            onHoverLeave={() => onLabelHoverChange && onLabelHoverChange(false)}
          />,
          document.body
        )}
      {!suppressFloatingChrome && showIcons && iconPos && createPortal(
        <NodeRowActionsOverlay
          iconPos={iconPos}
          showIcons={showIcons}
          canDelete={canDelete}
          onEdit={onEdit}
          onDelete={onDelete}
          onDrag={onDrag}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          labelRef={labelRef}
          onHoverChange={(v) => { onIconsHoverChange && onIconsHoverChange(v); }}
          iconSize={iconSize}
          hasTaskTree={hasTaskTree}
          gearColor={gearColor || labelTextColor}
          onOpenTaskTree={onOpenTaskTree}
          isCondition={String((row as any)?.categoryType || '').toLowerCase() === 'conditions'}
          rowErrors={rowErrors}
          onErrorClick={onErrorClick}
          errorIconRef={errorIconRef}
          showErrorPopover={showErrorPopover}
          onCloseErrorPopover={onCloseErrorPopover}
          onErrorFix={onErrorFix}
          onWrenchClick={async () => {
            try {
              const variables = (window as any).__omniaVars || {};
              // Get node element for scrolling - try multiple selectors
              let nodeElement: HTMLElement | null = null;
              let nodeId: string | null = null;

              // Try to find the ReactFlow node element
              if (labelRef.current) {
                // First try: look for ReactFlow node (has data-id attribute)
                nodeElement = labelRef.current.closest('.react-flow__node') as HTMLElement | null;

                if (nodeElement) {
                  // ReactFlow nodes have data-id attribute
                  nodeId = nodeElement.getAttribute('data-id');
                }

                // If not found, try to find by data-row-id and then find parent node
                if (!nodeElement || !nodeId) {
                  const rowElement = labelRef.current.closest('[data-row-id]') as HTMLElement | null;
                  if (rowElement) {
                    nodeElement = rowElement.closest('.react-flow__node') as HTMLElement | null;
                    if (nodeElement) {
                      nodeId = nodeElement.getAttribute('data-id');
                    }
                  }
                }

                // If still not found, try data-node-id
                if (!nodeElement || !nodeId) {
                  nodeElement = labelRef.current.closest('[data-node-id]') as HTMLElement | null;
                  if (nodeElement) {
                    nodeId = nodeElement.getAttribute('data-node-id') || nodeElement.getAttribute('data-id');
                  }
                }
              }

              console.log('[NodeRowLabel] Opening condition editor', {
                hasNodeElement: !!nodeElement,
                nodeId,
                nodeElementTag: nodeElement?.tagName,
                nodeElementClasses: nodeElement?.className
              });

              (await import('../../../../ui/events')).emitConditionEditorOpen({
                variables,
                nodeId: nodeId || undefined,
                nodeElement: nodeElement || undefined
              });
            } catch (err) {
              console.warn('[NodeRowLabel] Error opening condition editor:', err);
            }
          }}
          TaskIcon={Icon}
          taskColor={iconColor || labelTextColor}
          onTypeChangeRequest={onTypeChangeRequest}
          onRequestClosePicker={onRequestClosePicker}
          buttonCloseTimeoutRef={buttonCloseTimeoutRef}
          outerRef={overlayRef}
          included={included}
          setIncluded={setIncluded}
          onTestTask={taskInstance ? handleTestTask : undefined}
          rowErrors={rowErrors}
          onErrorClick={onErrorClick}
          errorIconRef={errorIconRef}
          showErrorPopover={showErrorPopover}
          onCloseErrorPopover={onCloseErrorPopover}
          onErrorFix={onErrorFix}
          onOpenSemanticValuesEditor={onOpenSemanticValuesEditor}
          hasSemanticValues={hasSemanticValues}
          semanticValuesAnchorRef={semanticValuesAnchorRef}
          subflowInterface={
            subflowInterfaceToolbar != null
              ? {
                  show: true,
                  hasOutputs: subflowInterfaceToolbar.hasOutputs,
                  loading: Boolean(subflowInterfaceToolbar.loading),
                  onOpenMenu: openSubflowInterfaceMenu,
                }
              : undefined
          }
        />,
        document.body
      )}
    </span>
    {!suppressFloatingChrome &&
      subflowIfaceMenu &&
      typeof document !== 'undefined' &&
      createPortal(
        <VariableTokenContextMenu
          isOpen
          x={subflowIfaceMenu.x}
          y={subflowIfaceMenu.y}
          variables={[]}
          variableItems={subflowIfaceMenu.items}
          onSelect={() => {}}
          onClose={() => setSubflowIfaceMenu(null)}
          dragFlowRowPayload={{ nodeId: String(nodeId || '') }}
        />,
        document.body
      )}
  </>
  );
};