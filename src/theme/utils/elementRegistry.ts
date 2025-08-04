import { ThemeElement, ThemeProperties } from '../types/theme';

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

  unregister(id: string): void {
    console.log('🎨 Rimuovendo elemento:', id);
    this.elements.delete(id);
  }

  getElementCount(): number {
    return this.elements.size;
  }

  // ============================================================================
  // AUTO-DETECTION MIGLIORATA
  // ============================================================================

  findElementByTarget(target: HTMLElement): ThemeElement | undefined {
    // Prima cerca per data-theme-element
    const themeElement = target.getAttribute('data-theme-element');
    if (themeElement) {
      const element = this.get(themeElement);
      if (element) {
        console.log('🎨 Elemento trovato per data-theme-element:', themeElement);
        return element;
      }
    }

    // Poi cerca per selector CSS
    return this.getAll().find(element => {
      try {
        return target.matches(element.selector) || target.closest(element.selector);
      } catch (error) {
        console.warn('🎨 Errore nel selector:', element.selector, error);
        return false;
      }
    });
  }

  // ============================================================================
  // RICONOSCIMENTO PROPRIETÀ SPECIFICHE
  // ============================================================================

  findPropertyByTarget(target: HTMLElement): { element: ThemeElement; property: keyof ThemeProperties } | undefined {
    const element = this.findElementByTarget(target);
    if (!element) {
      console.log('🎨 Nessun elemento trovato per target:', target);
      return undefined;
    }

    // Determine which property was clicked based on data-theme-part
    const part = target.getAttribute('data-theme-part');
    if (part) {
      const propertyMap = {
        background: 'background',
        text: 'color',
        border: 'borderColor'
      } as const;

      const property = propertyMap[part as keyof typeof propertyMap];
      if (property) {
        console.log('🎨 Proprietà trovata per data-theme-part:', part, '->', property);
        return { element, property };
      }
    }

    // Auto-detection basata sulla posizione del click
    const rect = target.getBoundingClientRect();
    const clickX = (event as MouseEvent)?.clientX - rect.left || 0;
    const clickY = (event as MouseEvent)?.clientY - rect.top || 0;
    const width = rect.width;
    const height = rect.height;

    let property: keyof ThemeProperties = 'background';

    // Se il click è vicino al bordo, probabilmente vuole modificare il border
    if (clickX < 5 || clickX > width - 5 || clickY < 5 || clickY > height - 5) {
      property = 'borderColor';
    }
    // Se il click è su testo (area centrale), probabilmente vuole modificare il testo
    else if (clickY > height * 0.2 && clickY < height * 0.8) {
      property = 'color';
    }

    console.log('🎨 Auto-detection proprietà:', { clickX, clickY, width, height, property });

    return { element, property };
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
      properties: { 
        background: '#3b82f6', 
        color: '#ffffff', 
        borderColor: '#1d4ed8',
        fontSize: '16px', 
        fontWeight: '600' 
      },
      selector: '.sidebar-header, [data-theme-element="sidebar-header"]',
      editableProperties: ['background', 'color', 'borderColor', 'fontSize', 'fontWeight']
    },
    {
      id: 'accordion-header',
      type: 'header',
      name: 'Header Accordion',
      properties: { 
        background: '#f3f4f6', 
        color: '#374151', 
        borderColor: '#d1d5db',
        fontSize: '14px', 
        fontWeight: '500' 
      },
      selector: '.sidebar-accordion-header, [data-theme-element="accordion-header"]',
      editableProperties: ['background', 'color', 'borderColor', 'fontSize', 'fontWeight']
    },
    {
      id: 'flowchart-node',
      type: 'node',
      name: 'Nodo Flowchart',
      properties: { 
        background: '#ffffff', 
        color: '#000000', 
        borderColor: '#d1d5db', 
        fontSize: '12px', 
        fontWeight: '400' 
      },
      selector: '.flowchart-node, [data-theme-element="flowchart-node"]',
      editableProperties: ['background', 'color', 'borderColor', 'fontSize', 'fontWeight']
    },
    {
      id: 'flowchart-canvas',
      type: 'canvas',
      name: 'Canvas Flowchart',
      properties: { 
        background: '#f9fafb', 
        color: '#000000',
        borderColor: '#e5e7eb',
        fontSize: '12px',
        fontWeight: '400'
      },
      selector: '.flowchart-canvas, [data-theme-element="flowchart-canvas"]',
      editableProperties: ['background', 'borderColor']
    },
    {
      id: 'button-primary',
      type: 'button',
      name: 'Pulsante Primario',
      properties: { 
        background: '#3b82f6', 
        color: '#ffffff', 
        borderColor: '#1d4ed8',
        fontSize: '14px', 
        fontWeight: '500' 
      },
      selector: '.btn-primary, [data-theme-element="button-primary"]',
      editableProperties: ['background', 'color', 'borderColor', 'fontSize', 'fontWeight']
    },
    {
      id: 'text-element',
      type: 'text',
      name: 'Elemento Testo',
      properties: { 
        background: 'transparent',
        color: '#374151', 
        borderColor: 'transparent',
        fontSize: '14px', 
        fontWeight: '400' 
      },
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

// ============================================================================
// HOOK PER REGISTRAZIONE AUTOMATICA
// ============================================================================

export function useThemeElement(
  elementId: string,
  elementName: string,
  editableProperties: (keyof ThemeProperties)[],
  defaultProperties: Partial<ThemeProperties> = {}
): void {
  const element: ThemeElement = {
    id: elementId,
    type: 'component',
    name: elementName,
    properties: {
      background: defaultProperties.background || 'transparent',
      color: defaultProperties.color || '#000000',
      borderColor: defaultProperties.borderColor || 'transparent',
      fontSize: defaultProperties.fontSize || '14px',
      fontWeight: defaultProperties.fontWeight || '400',
    },
    selector: `[data-theme-element="${elementId}"]`,
    editableProperties,
  };

  // Registra l'elemento immediatamente
  elementRegistry.register(element);
} 