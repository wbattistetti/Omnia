import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface AccordionProps {
  title: string;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  icon?: React.ReactNode;
  bgColor?: { header: string; light: string };
  action?: React.ReactNode;
}

export const Accordion: React.FC<AccordionProps> = ({ 
  title, 
  children, 
  isOpen,
  onToggle,
  icon,
  bgColor,
  action
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
    <div className="mb-4" style={isOpen && bgColor ? { background: bgColor.light, borderRadius: 12, padding: 2 } : undefined}>
      <div className="flex items-center justify-between p-3 rounded-lg transition-colors" style={bgColor ? { background: bgColor.header, color: '#fff', borderRadius: 12, width: '100%' } : undefined}>
        <button
          onClick={onToggle}
          className="flex items-center flex-1 text-left group bg-transparent border-none outline-none"
          style={{ background: 'none', boxShadow: 'none', padding: 0 }}
        >
          {icon && <span className="mr-3">{icon}</span>}
          <span className="font-semibold group-hover:font-bold" style={bgColor ? { color: '#fff' } : {}}>{title}</span>
        </button>
        {action && <span className="ml-2">{action}</span>}
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-slate-400 ml-2" />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-400 ml-2" />
        )}
      </div>
      
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