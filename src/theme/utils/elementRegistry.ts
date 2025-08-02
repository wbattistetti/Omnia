import { ThemeElement, ThemeProperties } from '../types';
import { useEffect } from 'react';

// ============================================================================
// REGISTRO ELEMENTI EDITABILI
// ============================================================================

class ElementRegistry {
  private elements = new Map<string, ThemeElement>();

  // ============================================================================
  // METODI PRINCIPALI
  // ============================================================================

  register(element: ThemeElement): void {
    console.log('🎨 Registrando elemento:', element.id);
    this.elements.set(element.id, element);
  }

  get(id: string): ThemeElement | undefined {
    return this.elements.get(id);
  }

  getAll(): ThemeElement[] {
    return Array.from(this.elements.values());
  }

  findElementByTarget(target: HTMLElement): ThemeElement | undefined {
    return this.getAll().find(element => 
      target.matches(element.selector) || target.closest(element.selector)
    );
  }

  // ============================================================================
  // RICONOSCIMENTO PROPRIETÀ SPECIFICHE
  // ============================================================================

  findPropertyByTarget(target: HTMLElement): { element: ThemeElement; property: keyof ThemeProperties } | undefined {
    const element = this.findElementByTarget(target);
    if (!element) return undefined;

    // Determine which property was clicked based on data-theme-part
    const part = target.getAttribute('data-theme-part');
    if (!part) return undefined;

    const propertyMap = {
      background: 'background',
      text: 'color',
      border: 'borderColor'
    } as const;

    const property = propertyMap[part as keyof typeof propertyMap];
    if (!property) return undefined;

    return { element, property };
  }

  unregister(id: string): void {
    console.log('🎨 Rimuovendo elemento:', id);
    this.elements.delete(id);
  }

  getElementCount(): number {
    return this.elements.size;
  }

  logAllElements(): void {
    console.log('🎨 Elementi registrati:', this.getAll().map(el => el.id));
  }
}

// ============================================================================
// ISTANZA GLOBALE
// ============================================================================

export const elementRegistry = new ElementRegistry();

// ============================================================================
// ELEMENTI PREDEFINITI
// ============================================================================

export function registerDefaultElements(): void {
  const defaultElements: ThemeElement[] = [
    {
      id: 'sidebar-header',
      type: 'header',
      name: 'Header Sidebar',
      properties: { background: '#3b82f6', color: '#ffffff', fontSize: '16px', fontWeight: '600' },
      selector: '.sidebar-header, [data-theme-element="sidebar-header"]',
      editableProperties: ['background', 'color', 'fontSize', 'fontWeight']
    },
    {
      id: 'accordion-header',
      type: 'header',
      name: 'Header Accordion',
      properties: { background: '#f3f4f6', color: '#374151', fontSize: '14px', fontWeight: '500' },
      selector: '.sidebar-accordion-header, [data-theme-element="accordion-header"]',
      editableProperties: ['background', 'color', 'fontSize', 'fontWeight']
    },
    {
      id: 'flowchart-node',
      type: 'node',
      name: 'Nodo Flowchart',
      properties: { background: '#ffffff', color: '#000000', borderColor: '#d1d5db', fontSize: '12px', fontWeight: '400' },
      selector: '.flowchart-node, [data-theme-element="flowchart-node"]',
      editableProperties: ['background', 'color', 'borderColor', 'fontSize', 'fontWeight']
    },
    {
      id: 'flowchart-canvas',
      type: 'canvas',
      name: 'Canvas Flowchart',
      properties: { background: '#f9fafb', borderColor: '#e5e7eb' },
      selector: '.flowchart-canvas, [data-theme-element="flowchart-canvas"]',
      editableProperties: ['background', 'borderColor']
    },
    {
      id: 'button-primary',
      type: 'button',
      name: 'Pulsante Primario',
      properties: { background: '#3b82f6', color: '#ffffff', fontSize: '14px', fontWeight: '500' },
      selector: '.btn-primary, [data-theme-element="button-primary"]',
      editableProperties: ['background', 'color', 'fontSize', 'fontWeight']
    },
    {
      id: 'text-element',
      type: 'text',
      name: 'Elemento Testo',
      properties: { color: '#374151', fontSize: '14px', fontWeight: '400' },
      selector: '.text-element, [data-theme-element="text-element"]',
      editableProperties: ['color', 'fontSize', 'fontWeight']
    }
  ];

  // Registra tutti gli elementi predefiniti
  defaultElements.forEach(element => {
    elementRegistry.register(element);
  });

  console.log('🎨 Elementi predefiniti registrati:', defaultElements.length);
} 

export function useThemeElement(
  elementId: string,
  elementName: string,
  editableProperties: (keyof ThemeProperties)[],
  defaultProperties: ThemeProperties = {}
): void {
  useEffect(() => {
    const element: ThemeElement = {
      id: elementId,
      type: 'component',
      name: elementName,
      properties: defaultProperties,
      selector: `[data-theme-element="${elementId}"]`,
      editableProperties,
    };

    elementRegistry.register(element);

    return () => {
      elementRegistry.unregister(elementId);
    };
  }, [elementId, elementName, editableProperties, defaultProperties]);
} 