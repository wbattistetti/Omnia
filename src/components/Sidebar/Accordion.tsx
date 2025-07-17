import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface AccordionProps {
  title: string;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  icon?: React.ReactNode;
}

export const Accordion: React.FC<AccordionProps> = ({ 
  title, 
  children, 
  isOpen,
  onToggle,
  icon 
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef<number>(0);

  useEffect(() => {
    if (contentRef.current) {
      if (isOpen) {
        // Restore scroll position when opening
        contentRef.current.scrollTop = lastScrollTop.current;
      } else {
        // Save scroll position when closing
        lastScrollTop.current = contentRef.current.scrollTop;
      }
    }
  }, [isOpen]);

  return (
    <div className="mb-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-left"
      >
        <div className="flex items-center">
          {icon && <span className="mr-3">{icon}</span>}
          <span className="font-semibold text-white">{title}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-400" />
        )}
      </button>
      
      <div 
        ref={contentRef}
        className="mt-2 pl-2 transition-all duration-200 overflow-y-auto"
        style={{
          maxHeight: isOpen ? '300px' : '0px'
        }}
      >
        <div className="pb-2">
          {children}
        </div>
      </div>
    </div>
  );
};