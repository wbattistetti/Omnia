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

const Accordion = (props: AccordionProps) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef<number>(0);

  useEffect(() => {
    if (contentRef.current) {
      if (props.isOpen) {
        // Restore scroll position when opening
        contentRef.current.scrollTop = lastScrollTop.current;
      } else {
        // Save scroll position when closing
        lastScrollTop.current = contentRef.current.scrollTop;
      }
    }
  }, [props.isOpen]);

  return (
    <div className="mb-4" style={props.isOpen && props.bgColor ? { background: props.bgColor.light, borderRadius: 12, padding: 2 } : undefined}>
      <div className="flex items-center justify-between p-3 rounded-lg transition-colors" style={props.bgColor ? { background: props.bgColor.header, color: '#fff', borderRadius: 12, width: '100%' } : undefined}>
        <button
          onClick={props.onToggle}
          className="flex items-center flex-1 text-left group bg-transparent border-none outline-none"
          style={{ background: 'none', boxShadow: 'none', padding: 0 }}
        >
          {props.icon && <span className="mr-3">{props.icon}</span>}
          <span className="font-semibold group-hover:font-bold" style={props.bgColor ? { color: '#fff' } : {}}>{props.title}</span>
        </button>
        {props.action && <span className="ml-2">{props.action}</span>}
        {props.isOpen ? (
          <ChevronDown className="w-5 h-5 text-slate-400 ml-2" onClick={props.onToggle} style={{ cursor: 'pointer' }} />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-400 ml-2" onClick={props.onToggle} style={{ cursor: 'pointer' }} />
        )}
      </div>
      
      <div 
        ref={contentRef}
        className="mt-2 pl-2 transition-all duration-200 overflow-y-auto"
        style={{
          maxHeight: props.isOpen ? '300px' : '0px'
        }}
      >
        <div className="pb-2">
          {props.children}
        </div>
      </div>
    </div>
  );
};

export default React.memo(Accordion);