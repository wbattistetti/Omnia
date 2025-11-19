import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface VariablesTreeMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  variables: string[];
  editor: any; // Monaco editor instance
  monaco: any; // Monaco namespace
  onClose: () => void;
}

interface TreeNode {
  name: string;
  children: Record<string, TreeNode>;
  full?: string;
}

export const VariablesTreeMenu: React.FC<VariablesTreeMenuProps> = ({
  isOpen,
  position,
  variables,
  editor,
  monaco,
  onClose
}) => {
  // console.log('🔍 [VariablesTreeMenu] Render:', { isOpen, position, variablesCount: variables?.length, hasEditor: !!editor, hasMonaco: !!monaco });

  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // console.log('🔍 [VariablesTreeMenu] isOpen changed:', isOpen);
    // ✅ Reset quando si chiude il menu
    if (!isOpen) {
      setExpanded(new Set());
      setFilter('');
    }
  }, [isOpen]);

  // Build tree structure from variables
  const tree = useMemo(() => {
    // console.log('🔍 [VariablesTreeMenu] Building tree from variables:', variables);
    const root: TreeNode = { name: '', children: {} };
    const keys = Array.from(new Set(variables.filter(Boolean)));
    // console.log('🔍 [VariablesTreeMenu] Filtered keys:', keys);

    keys.forEach(k => {
      const parts = String(k).split('.');
      let current = root;
      parts.forEach((part, index) => {
        if (!current.children[part]) {
          current.children[part] = { name: part, children: {} };
        }
        current = current.children[part];
        if (index === parts.length - 1) {
          current.full = k;
        }
      });
    });

    return root;
  }, [variables]);

  // Insert variable into Monaco editor
  const insertVariable = (key: string) => {
    try {
      const pos = editor.getPosition();
      const text = `vars["${key}"]`;
      editor.executeEdits('omnia-var-insert', [{
        range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
        text
      }]);
      editor.focus();
    } catch (error) {
      console.error('Error inserting variable:', error);
    }
    onClose();
  };

  // Toggle node expansion
  const toggleExpand = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Render tree node recursively
  const renderNode = (node: TreeNode, path: string[], depth: number): React.ReactNode[] => {
    const key = path.join('.');
    const hasFull = !!node.full;
    const hasChildren = Object.keys(node.children).length > 0;
    // ✅ Un nodo è una foglia solo se ha full E non ha children
    const isLeaf = hasFull && !hasChildren;
    const label = node.name;
    const filterLower = filter.toLowerCase();
    const visible = filterLower
      ? (node.full ? node.full.toLowerCase().includes(filterLower) : key.toLowerCase().includes(filterLower))
      : true;

    if (path.length === 0 || !visible) {
      return [];
    }

    const isExpanded = expanded.has(key);
    const shouldShowChildren = hasChildren && (isExpanded || filterLower.length > 0);

    const nodes: React.ReactNode[] = [];

    // Render current node
    nodes.push(
      <div
        key={key}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 8px',
            borderRadius: '6px',
            color: '#111827', // ✅ Testo nero
            cursor: hasFull ? 'pointer' : 'default', // ✅ Cursor pointer solo se selezionabile
            marginLeft: `${depth * 12}px`,
            userSelect: 'none',
            background: 'transparent'
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.10)'; // ✅ Hover blu chiaro
            // ✅ ESPANDI automaticamente quando fai hover (mouse move) se ha children
            if (hasChildren && !isExpanded) {
              console.log('🔍 [VariablesTreeMenu] Hover expand:', key);
              setExpanded(prev => {
                const next = new Set(prev);
                next.add(key);
                return next;
              });
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            // ✅ NON collassare quando esci - mantieni espanso per facilità d'uso
          }}
        onClick={() => {
          // ✅ CLICK = Seleziona e inserisci la variabile (solo se ha full)
          if (hasFull && node.full) {
            console.log('🔍 [VariablesTreeMenu] Click select:', node.full);
            insertVariable(node.full);
          }
        }}
        onDoubleClick={() => {
          // ✅ Double-click = stesso comportamento del click
          if (hasFull && node.full) {
            insertVariable(node.full);
          }
        }}
      >
        <span
          style={{
            width: '12px',
            opacity: hasChildren ? 0.8 : 0, // ✅ Mostra chevron solo se ha children
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
            display: 'inline-block'
          }}
        >
          {hasChildren ? '▶' : ''}
        </span>
        <span>{label}</span>
      </div>
    );

    // ✅ Render children se il nodo ha figli E (è espanso O c'è filtro)
    if (shouldShowChildren) {
      Object.values(node.children).forEach(child => {
        nodes.push(...renderNode(child, path.concat(child.name), depth + 1));
      });
    }

    return nodes;
  };

  // Calculate menu position
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const updatePosition = () => {
      const padding = 8;
      const viewportW = window.innerWidth || document.documentElement.clientWidth || 1280;
      const viewportH = window.innerHeight || document.documentElement.clientHeight || 800;

      // Prepare for measurement
      const tempStyle: React.CSSProperties = {
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        visibility: 'hidden',
        display: 'block'
      };
      setMenuStyle(tempStyle);

      requestAnimationFrame(() => {
        if (!menuRef.current) return;
        const rect = menuRef.current.getBoundingClientRect();
        const spaceAbove = position.y - padding;
        const spaceBelow = viewportH - position.y - padding;

        // Default position: above the click line
        let top = position.y - rect.height - padding;
        let left = position.x;

        // If not enough room above, show below and cap max height
        if (top < padding && spaceBelow > spaceAbove) {
          const maxH = Math.max(160, Math.min(420, Math.floor(spaceBelow)));
          top = Math.min(viewportH - maxH - padding, position.y + padding);
          setMenuStyle(prev => ({
            ...prev,
            maxHeight: `${maxH}px`,
            top: `${top}px`
          }));
        } else {
          setMenuStyle(prev => ({
            ...prev,
            maxHeight: undefined,
            top: `${top}px`
          }));
        }

        // Clamp horizontally
        if (left + rect.width > viewportW - padding) {
          left = Math.max(padding, viewportW - rect.width - padding);
        }
        if (left < padding) left = padding;
        if (top < padding) top = padding;

        setMenuStyle(prev => ({
          ...prev,
          left: `${left}px`,
          top: `${top}px`,
          visibility: 'visible'
        }));
      });
    };

    updatePosition();

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, position]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside, { capture: true });
    return () => document.removeEventListener('mousedown', handleClickOutside, { capture: true });
  }, [isOpen, onClose]);

  if (!isOpen) {
    // console.log('🔍 [VariablesTreeMenu] Not rendering - menu is closed');
    return null;
  }

  // console.log('🔍 [VariablesTreeMenu] Rendering menu with tree:', tree);
  const renderedNodes = Object.values(tree.children).flatMap(child =>
    renderNode(child, [child.name], 0)
  );
  // console.log('🔍 [VariablesTreeMenu] Rendered nodes count:', renderedNodes.length);

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        zIndex: 100000,
        background: '#ffffff', // ✅ Sfondo bianco
        border: '1px solid #e5e7eb', // ✅ Bordo bianco/grigio chiaro
        borderRadius: '8px',
        padding: '6px',
        minWidth: '260px',
        maxHeight: '300px',
        overflowY: 'auto',
        boxShadow: '0 8px 28px rgba(0,0,0,0.15)',
        fontSize: '10px',
        ...menuStyle
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{
        color: '#111827', // ✅ Testo nero
        fontWeight: 700,
        margin: '4px 6px 6px 6px'
      }}>
        Variables
      </div>

      {/* Search box */}
      <div style={{ padding: '0 6px 6px 6px' }}>
        <input
          type="text"
          placeholder="Filter variables (type to search)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            border: '1px solid #d1d5db', // ✅ Bordo grigio chiaro
            borderRadius: '6px',
            background: '#ffffff', // ✅ Sfondo bianco
            color: '#111827', // ✅ Testo nero
            fontSize: '10px',
            outline: 'none'
          }}
          autoFocus
        />
      </div>

      {/* Tree list */}
      <div style={{ padding: '4px 4px 8px 4px' }}>
        {renderedNodes.length > 0 ? (
          renderedNodes
        ) : (
          <div style={{ color: '#6b7280', padding: '6px 8px' }}> {/* ✅ Testo grigio scuro */}
            No variables match the filter
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

