import React, { useMemo, useEffect, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Node } from 'reactflow';
import type { FlowNode } from '../types/flowTypes';

export interface SelectionMenuProps {
  selectedNodeIds: string[];
  selectionMenu: { show: boolean; x: number; y: number };
  nodes: Node<FlowNode>[];
  onCreateTask: () => void;
  onAlign: (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onDistribute: (type: 'horizontal' | 'vertical') => void;
  checkAlignmentOverlap: (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => boolean;
  checkDistributionOverlap: (type: 'horizontal' | 'vertical') => boolean;
  onCancel: () => void;
}

export const SelectionMenu: React.FC<SelectionMenuProps> = ({
  selectedNodeIds,
  selectionMenu,
  nodes,
  onCreateTask,
  onAlign,
  onDistribute,
  checkAlignmentOverlap,
  checkDistributionOverlap,
  onCancel
}) => {
  const [viewportPosition, setViewportPosition] = useState({ x: 0, y: 0 });

  // Get selected nodes
  const selectedNodes = useMemo(() => {
    return nodes.filter(n => selectedNodeIds.includes(n.id));
  }, [nodes, selectedNodeIds]);

  const alignDisabled = {
    left: checkAlignmentOverlap('left'),
    center: checkAlignmentOverlap('center'),
    right: checkAlignmentOverlap('right'),
    top: checkAlignmentOverlap('top'),
    middle: checkAlignmentOverlap('middle'),
    bottom: checkAlignmentOverlap('bottom')
  };

  const distributeDisabled = {
    horizontal: checkDistributionOverlap('horizontal'),
    vertical: checkDistributionOverlap('vertical')
  };

  // Convert canvas coordinates to viewport coordinates
  useEffect(() => {
    if (!selectionMenu.show) return;

    const canvasContainer = document.querySelector('.react-flow') as HTMLElement;
    if (!canvasContainer) {
      setViewportPosition({ x: selectionMenu.x, y: selectionMenu.y });
      return;
    }

    const rect = canvasContainer.getBoundingClientRect();
    const scrollX = canvasContainer.scrollLeft || 0;
    const scrollY = canvasContainer.scrollTop || 0;
    const viewportX = rect.left + selectionMenu.x - scrollX + 8;
    const viewportY = rect.top + selectionMenu.y - scrollY + 8;

    setViewportPosition({ x: viewportX, y: viewportY });
  }, [selectionMenu.show, selectionMenu.x, selectionMenu.y]);

  if (!selectionMenu.show || selectedNodeIds.length < 2) return null;

  const menuItemClass = "px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 focus:bg-slate-100 focus:outline-none cursor-pointer relative flex items-center gap-2";
  const menuItemDisabledClass = "px-3 py-1.5 text-sm text-red-600 opacity-50 cursor-not-allowed relative flex items-center gap-2";
  const separatorClass = "h-px bg-slate-200 my-1";
  const subTriggerClass = "px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 focus:bg-slate-100 focus:outline-none cursor-pointer relative flex items-center gap-1";
  const arrowClass = "text-slate-400 text-[9px] leading-none";

  return (
    <DropdownMenu.Root open={selectionMenu.show} onOpenChange={(open) => {
      if (!open) onCancel();
    }} modal={false}>
      <DropdownMenu.Trigger asChild>
        <div
          style={{
            position: 'fixed',
            left: viewportPosition.x,
            top: viewportPosition.y,
            width: 1,
            height: 1,
            pointerEvents: 'none',
            zIndex: 9999
          }}
        />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="bg-white border border-slate-300 rounded shadow-lg py-1 z-[9999]"
          side="bottom"
          align="start"
          sideOffset={0}
          alignOffset={0}
          onEscapeKeyDown={onCancel}
          onPointerDownOutside={onCancel}
          onInteractOutside={onCancel}
        >
          {/* Crea Task */}
          <DropdownMenu.Item
            className={menuItemClass}
            onSelect={(e) => {
              e.preventDefault();
              onCreateTask();
            }}
          >
            Crea Task
          </DropdownMenu.Item>

          {/* Arrange */}
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className={subTriggerClass}>
              <span>Arrange</span>
              <span className={arrowClass}>▸</span>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                className="bg-white border border-slate-300 rounded shadow-lg py-1 z-[9999]"
                sideOffset={2}
                alignOffset={-5}
              >
                {/* Align submenu */}
                <DropdownMenu.Sub>
                  <DropdownMenu.SubTrigger className={subTriggerClass}>
                    <span>Align</span>
                    <span className={arrowClass}>▸</span>
                  </DropdownMenu.SubTrigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.SubContent
                      className="bg-white border border-slate-300 rounded shadow-lg py-1 z-[9999]"
                      sideOffset={2}
                      alignOffset={-5}
                    >
                      <DropdownMenu.Item
                        className={alignDisabled.left ? menuItemDisabledClass : menuItemClass}
                        disabled={alignDisabled.left}
                        onSelect={(e) => {
                          e.preventDefault();
                          if (!alignDisabled.left) {
                            onAlign('left');
                          }
                        }}
                        title={alignDisabled.left ? 'Would cause node overlap' : 'Align left'}
                      >
                        <span>⬅</span>
                        <span>Left</span>
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className={alignDisabled.center ? menuItemDisabledClass : menuItemClass}
                        disabled={alignDisabled.center}
                        onSelect={(e) => {
                          e.preventDefault();
                          if (!alignDisabled.center) {
                            onAlign('center');
                          }
                        }}
                        title={alignDisabled.center ? 'Would cause node overlap' : 'Align center'}
                      >
                        <span>↔</span>
                        <span>Center</span>
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className={alignDisabled.right ? menuItemDisabledClass : menuItemClass}
                        disabled={alignDisabled.right}
                        onSelect={(e) => {
                          e.preventDefault();
                          if (!alignDisabled.right) {
                            onAlign('right');
                          }
                        }}
                        title={alignDisabled.right ? 'Would cause node overlap' : 'Align right'}
                      >
                        <span>➡</span>
                        <span>Right</span>
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator className={separatorClass} />
                      <DropdownMenu.Item
                        className={alignDisabled.top ? menuItemDisabledClass : menuItemClass}
                        disabled={alignDisabled.top}
                        onSelect={(e) => {
                          e.preventDefault();
                          if (!alignDisabled.top) {
                            onAlign('top');
                          }
                        }}
                        title={alignDisabled.top ? 'Would cause node overlap' : 'Align top'}
                      >
                        <span>⬆</span>
                        <span>Top</span>
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className={alignDisabled.middle ? menuItemDisabledClass : menuItemClass}
                        disabled={alignDisabled.middle}
                        onSelect={(e) => {
                          e.preventDefault();
                          if (!alignDisabled.middle) {
                            onAlign('middle');
                          }
                        }}
                        title={alignDisabled.middle ? 'Would cause node overlap' : 'Align middle'}
                      >
                        <span>↕</span>
                        <span>Middle</span>
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className={alignDisabled.bottom ? menuItemDisabledClass : menuItemClass}
                        disabled={alignDisabled.bottom}
                        onSelect={(e) => {
                          e.preventDefault();
                          if (!alignDisabled.bottom) {
                            onAlign('bottom');
                          }
                        }}
                        title={alignDisabled.bottom ? 'Would cause node overlap' : 'Align bottom'}
                      >
                        <span>⬇</span>
                        <span>Bottom</span>
                      </DropdownMenu.Item>
                    </DropdownMenu.SubContent>
                  </DropdownMenu.Portal>
                </DropdownMenu.Sub>

                <DropdownMenu.Separator className={separatorClass} />

                {/* Distribute submenu */}
                <DropdownMenu.Sub>
                  <DropdownMenu.SubTrigger className={subTriggerClass}>
                    <span>Distribute</span>
                    <span className={arrowClass}>▸</span>
                  </DropdownMenu.SubTrigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.SubContent
                      className="bg-white border border-slate-300 rounded shadow-lg py-1 z-[9999]"
                      sideOffset={2}
                      alignOffset={-5}
                    >
                      <DropdownMenu.Item
                        className={(distributeDisabled.horizontal || selectedNodes.length < 3) ? menuItemDisabledClass : menuItemClass}
                        disabled={distributeDisabled.horizontal || selectedNodes.length < 3}
                        onSelect={(e) => {
                          e.preventDefault();
                          if (!distributeDisabled.horizontal && selectedNodes.length >= 3) {
                            onDistribute('horizontal');
                          }
                        }}
                        title={distributeDisabled.horizontal ? 'Would cause node overlap' : selectedNodes.length < 3 ? 'Need at least 3 nodes' : 'Distribute horizontally'}
                      >
                        <span>↔</span>
                        <span>Horizontal</span>
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className={(distributeDisabled.vertical || selectedNodes.length < 3) ? menuItemDisabledClass : menuItemClass}
                        disabled={distributeDisabled.vertical || selectedNodes.length < 3}
                        onSelect={(e) => {
                          e.preventDefault();
                          if (!distributeDisabled.vertical && selectedNodes.length >= 3) {
                            onDistribute('vertical');
                          }
                        }}
                        title={distributeDisabled.vertical ? 'Would cause node overlap' : selectedNodes.length < 3 ? 'Need at least 3 nodes' : 'Distribute vertically'}
                      >
                        <span>↕</span>
                        <span>Vertical</span>
                      </DropdownMenu.Item>
                    </DropdownMenu.SubContent>
                  </DropdownMenu.Portal>
                </DropdownMenu.Sub>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>

          <DropdownMenu.Separator className={separatorClass} />

          {/* Cancel button */}
          <DropdownMenu.Item
            className="px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 focus:bg-red-50 focus:outline-none cursor-pointer"
            onSelect={(e) => {
              e.preventDefault();
              onCancel();
            }}
          >
            Annulla
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
