// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { getAllFunctionNames, getBuiltinFunction } from '../compiler/builtinFunctions';

interface InsertMenuProps {
  variables?: Record<string, any>;
  variablesTree?: any[];
  onInsert: (text: string) => void;
  onClose?: () => void;
}

export function InsertMenu({ variables, variablesTree, onInsert, onClose }: InsertMenuProps) {
  const [activeTab, setActiveTab] = useState<'variables' | 'functions' | 'constants'>('variables');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleInsert = (text: string) => {
    onInsert(text);
    onClose?.();
  };

  const toggleNode = (path: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedNodes(newExpanded);
  };

  const renderVariables = () => {
    if (variablesTree && Array.isArray(variablesTree)) {
      return variablesTree.map((act: any, actIdx: number) => (
        <div key={actIdx} className="mb-2">
          {act.mains && Array.isArray(act.mains) && act.mains.map((main: any, mainIdx: number) => {
            const mainPath = `${actIdx}-${mainIdx}`;
            const isExpanded = expandedNodes.has(mainPath);
            const hasSubs = main.subs && Array.isArray(main.subs) && main.subs.length > 0;

            return (
              <div key={mainIdx} className="mb-1">
                <div
                  className="flex items-center gap-1 px-2 py-1 hover:bg-gray-700 cursor-pointer rounded"
                  onClick={() => {
                    if (hasSubs) {
                      toggleNode(mainPath);
                    } else {
                      handleInsert(`[${main.label}]`);
                    }
                  }}
                >
                  {hasSubs && (
                    isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                  )}
                  <span className="text-sm text-blue-300">[{main.label}]</span>
                </div>
                {hasSubs && isExpanded && (
                  <div className="ml-4">
                    {main.subs.map((sub: any, subIdx: number) => (
                      <div
                        key={subIdx}
                        className="px-2 py-1 hover:bg-gray-700 cursor-pointer rounded text-sm text-blue-200"
                        onClick={() => handleInsert(`[${main.label}.${sub.label}]`)}
                      >
                        [{main.label}.{sub.label}]
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ));
    }

    // Fallback: flat variables
    if (variables) {
      return Object.keys(variables).map((varName) => (
        <div
          key={varName}
          className="px-2 py-1 hover:bg-gray-700 cursor-pointer rounded text-sm text-blue-300"
          onClick={() => handleInsert(`[${varName}]`)}
        >
          [{varName}]
        </div>
      ));
    }

    return <div className="text-sm text-gray-400 px-2">No variables available</div>;
  };

  const renderFunctions = () => {
    const functionNames = getAllFunctionNames();
    return functionNames.map((fnName) => {
      const fnDef = getBuiltinFunction(fnName);
      return (
        <div
          key={fnName}
          className="px-2 py-1 hover:bg-gray-700 cursor-pointer rounded"
          onClick={() => handleInsert(`${fnName}()`)}
        >
          <div className="text-sm text-yellow-300 font-mono">{fnName}()</div>
          {fnDef && (
            <div className="text-xs text-gray-400 mt-1">{fnDef.description}</div>
          )}
        </div>
      );
    });
  };

  const renderConstants = () => {
    return (
      <>
        <div
          className="px-2 py-1 hover:bg-gray-700 cursor-pointer rounded text-sm text-green-300"
          onClick={() => handleInsert('TRUE')}
        >
          TRUE
        </div>
        <div
          className="px-2 py-1 hover:bg-gray-700 cursor-pointer rounded text-sm text-green-300"
          onClick={() => handleInsert('FALSE')}
        >
          FALSE
        </div>
      </>
    );
  };

  return (
    <div
      ref={menuRef}
      className="absolute top-10 right-0 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 w-64 max-h-96 overflow-auto"
      style={{ minWidth: '256px' }}
    >
      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        <button
          className={`flex-1 px-3 py-2 text-sm font-medium ${
            activeTab === 'variables'
              ? 'bg-gray-700 text-blue-300'
              : 'text-gray-400 hover:text-gray-200'
          }`}
          onClick={() => setActiveTab('variables')}
        >
          Variables
        </button>
        <button
          className={`flex-1 px-3 py-2 text-sm font-medium ${
            activeTab === 'functions'
              ? 'bg-gray-700 text-yellow-300'
              : 'text-gray-400 hover:text-gray-200'
          }`}
          onClick={() => setActiveTab('functions')}
        >
          Functions
        </button>
        <button
          className={`flex-1 px-3 py-2 text-sm font-medium ${
            activeTab === 'constants'
              ? 'bg-gray-700 text-green-300'
              : 'text-gray-400 hover:text-gray-200'
          }`}
          onClick={() => setActiveTab('constants')}
        >
          Constants
        </button>
      </div>

      {/* Content */}
      <div className="p-2">
        {activeTab === 'variables' && renderVariables()}
        {activeTab === 'functions' && renderFunctions()}
        {activeTab === 'constants' && renderConstants()}
      </div>
    </div>
  );
}
