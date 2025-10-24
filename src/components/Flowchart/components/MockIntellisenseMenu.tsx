import React, { useState, useEffect } from 'react';
import { Bot, User, Database, GitBranch, CheckSquare, Layers } from 'lucide-react';

interface MockIntellisenseMenuProps {
  position: { x: number; y: number };
  onSelect: (text: string) => void;
  onClose: () => void;
}

const mockSuggestions = [
  { 
    id: '1', 
    category: 'Agent Acts', 
    name: 'Welcome Message', 
    description: 'Greet the customer and introduce yourself',
    icon: <Bot className="w-4 h-4 text-purple-400" />,
    color: 'text-purple-400'
  },
  { 
    id: '2', 
    category: 'Agent Acts', 
    name: 'Verify Identity', 
    description: 'Ask for customer identification details',
    icon: <Bot className="w-4 h-4 text-purple-400" />,
    color: 'text-purple-400'
  },
  { 
    id: '3', 
    category: 'User Acts', 
    name: 'Provide Tax Code', 
    description: 'Customer provides their tax identification',
    icon: <User className="w-4 h-4 text-green-400" />,
    color: 'text-green-400'
  },
  { 
    id: '4', 
    category: 'User Acts', 
    name: 'Accept Offer', 
    description: 'Customer agrees to the proposed offer',
    icon: <User className="w-4 h-4 text-green-400" />,
    color: 'text-green-400'
  },
  { 
    id: '5', 
    category: 'Backend Actions', 
    name: 'Verify Account', 
    description: 'Check customer account in the system',
    icon: <Database className="w-4 h-4 text-blue-400" />,
    color: 'text-blue-400'
  },
  { 
    id: '6', 
    category: 'Backend Actions', 
    name: 'Create Contract', 
    description: 'Generate new contract in the system',
    icon: <Database className="w-4 h-4 text-blue-400" />,
    color: 'text-blue-400'
  },
  { 
    id: '7', 
    category: 'Conditions', 
    name: 'Valid Tax Code', 
    description: 'Check if the provided tax code is valid',
    icon: <GitBranch className="w-4 h-4 text-yellow-400" />,
    color: 'text-yellow-400'
  },
  { 
    id: '8', 
    category: 'Tasks', 
    name: 'Customer Onboarding', 
    description: 'Complete customer registration process',
    icon: <CheckSquare className="w-4 h-4 text-orange-400" />,
    color: 'text-orange-400'
  },
  { 
    id: '9', 
    category: 'Macrotasks', 
    name: 'Contract Activation', 
    description: 'Full contract activation workflow',
    icon: <Layers className="w-4 h-4 text-red-400" />,
    color: 'text-red-400'
  },
  { 
    id: '10', 
    category: 'Conditions', 
    name: 'No Condition', 
    description: 'Proceed without any condition check',
    icon: <GitBranch className="w-4 h-4 text-gray-400" />,
    color: 'text-gray-400'
  }
];

export const MockIntellisenseMenu: React.FC<MockIntellisenseMenuProps> = ({
  position,
  onSelect,
  onClose
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % mockSuggestions.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + mockSuggestions.length) % mockSuggestions.length);
          break;
        case 'Enter':
          e.preventDefault();
          onSelect(mockSuggestions[selectedIndex].name);
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, onSelect, onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('.intellisense-menu')) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Group suggestions by category
  const groupedSuggestions = mockSuggestions.reduce((acc, suggestion) => {
    if (!acc[suggestion.category]) {
      acc[suggestion.category] = [];
    }
    acc[suggestion.category].push(suggestion);
    return acc;
  }, {} as Record<string, typeof mockSuggestions>);

  return (
    <div
      className="intellisense-menu fixed bg-white border border-gray-300 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto"
      style={{
        left: position.x,
        top: position.y,
        width: '320px'
      }}
    >
      <div className="p-2">
        <div className="text-xs text-gray-500 mb-2 px-2">
          Use ↑↓ to navigate, Enter to select, Esc to close
        </div>
        
        {Object.entries(groupedSuggestions).map(([category, suggestions]) => (
          <div key={category} className="mb-3">
            <div className="text-xs font-semibold text-gray-600 px-2 py-1 bg-gray-50 rounded">
              {category}
            </div>
            {suggestions.map((suggestion, globalIndex) => {
              const actualIndex = mockSuggestions.findIndex(s => s.id === suggestion.id);
              return (
                <div
                  key={suggestion.id}
                  className={`flex items-start p-2 cursor-pointer rounded transition-colors ${
                    selectedIndex === actualIndex
                      ? 'bg-purple-100 border-l-2 border-purple-500'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => onSelect(suggestion.name)}
                >
                  <div className="mr-3 mt-0.5">
                    {suggestion.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium text-sm ${suggestion.color}`}>
                      {suggestion.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {suggestion.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};