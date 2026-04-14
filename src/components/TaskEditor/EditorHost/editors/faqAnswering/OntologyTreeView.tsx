/**
 * Root-level ontology list e aggiunta radice (senza righe ···).
 */

import React, { useState } from 'react';
import type { OntologyNode } from '@types/faqOntology';
import { findParentId } from '@domain/faqOntology/treeUtils';
import { useFaqOntology } from './FaqOntologyContext';
import OntologyTreeNode from './OntologyTreeNode';
import OntologyInlineEditor from './OntologyInlineEditor';

export { ONTOLOGY_ROOT_SENTINEL } from './ontologyUiConstants';

export default function OntologyTreeView() {
  const {
    displayNodes,
    nodes,
    addNode,
    checkSiblingName,
    selectedNodeId,
    editMode,
    setSelectedNodeId,
  } = useFaqOntology();

  const [addingRoot, setAddingRoot] = useState(false);

  const selectedIsRoot =
    selectedNodeId != null && findParentId(nodes, selectedNodeId) === null;

  const isEmpty = nodes.length === 0;
  const showRootAdd = editMode && (isEmpty || selectedIsRoot || addingRoot);

  return (
    <div className="min-h-0 flex-1 overflow-auto py-2 pl-2 pr-1">
      {isEmpty && editMode ? (
        <div className="mb-3 rounded-lg border border-dashed border-slate-600 bg-slate-950/50 px-3 py-3">
          <p className="mb-2 text-xs text-slate-400">
            Inizia dall’unica radice: assegna un nome al primo concetto (puoi aggiungere figli e rami dopo).
          </p>
          <OntologyInlineEditor
            placeholder="Nome del primo nodo radice…"
            validate={(v) => {
              if (!v.trim()) return 'Nome obbligatorio';
              if (!checkSiblingName(null, v)) return 'Nome già usato';
              return null;
            }}
            onConfirm={(v) => {
              addNode(null, v);
            }}
            onCancel={() => {}}
          />
        </div>
      ) : isEmpty && !editMode ? (
        <p className="mb-3 px-1 text-xs text-slate-500">
          Attiva <span className="text-slate-300">Modifica</span> in alto per creare il primo nodo radice.
        </p>
      ) : null}

      {displayNodes.map((n: OntologyNode) => (
        <OntologyTreeNode key={n.id} node={n} depth={0} />
      ))}

      {editMode && !isEmpty && showRootAdd ? (
        <div className="mt-1 pl-1">
          {addingRoot ? (
            <div className="min-w-0 max-w-md">
              <OntologyInlineEditor
                placeholder="Nuovo nodo radice"
                validate={(v) => {
                  if (!v.trim()) return 'Nome obbligatorio';
                  if (!checkSiblingName(null, v)) return 'Nome già usato';
                  return null;
                }}
                onConfirm={(v) => {
                  addNode(null, v);
                  setAddingRoot(false);
                }}
                onCancel={() => setAddingRoot(false)}
              />
            </div>
          ) : (
            <button
              type="button"
              className="text-xs text-amber-500/90 hover:text-amber-400 hover:underline"
              title="Aggiungi un altro nodo radice"
              onClick={() => {
                setAddingRoot(true);
                setSelectedNodeId(null);
              }}
            >
              + Aggiungi nodo radice
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
