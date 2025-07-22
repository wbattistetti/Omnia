import React, { useImperativeHandle, useRef, forwardRef } from 'react';
import { DockviewReact, IDockviewPanelProps } from 'dockview';
import 'dockview/dist/styles/dockview.css';
import ActEditor from './ActEditor';
import ResponseEditor from './ActEditor/ResponseEditor';

export type DockablePanelsHandle = {
  openPanel: (panel: { id: string, title: string, ddt: any, translations: any, lang: string }) => void;
};

const DockablePanels = forwardRef<DockablePanelsHandle>((props, ref) => {
  const apiRef = useRef<any>(null);

  React.useEffect(() => {
    return () => {
    };
  }, [props]);

  useImperativeHandle(ref, () => ({
    openPanel: ({ id, title, ddt, translations, lang }) => {
      if (apiRef.current) {
        apiRef.current.addPanel({
          id,
          title,
          component: 'ddtEditor',
          params: { ddt, translations, lang }
        });
      }
    }
  }), []);

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'auto', // PATCH: ora Dockview riceve gli eventi
      zIndex: 100
    }}>
      <DockviewReact
        className="dockview-theme-light"
        components={{
          ddtEditor: (props: IDockviewPanelProps<{ ddt: any, translations: any, lang: string }>) => {
            return (
              <div style={{
                pointerEvents: 'auto',
                background: '#ffe4b2', // DEBUG: arancione chiaro
                minWidth: 300,
                minHeight: 200,
                boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
                borderRadius: 8,
                border: '2px solid #ff6600' // DEBUG: bordo arancione
              }}>
                <ResponseEditor ddt={props.params.ddt} translations={props.params.translations} lang={props.params.lang} />
              </div>
            );
          }
        }}
        onReady={event => {
          apiRef.current = event.api;
        }}
      />
    </div>
  );
});

export default DockablePanels; 