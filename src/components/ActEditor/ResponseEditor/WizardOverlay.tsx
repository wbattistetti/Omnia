import React from 'react';
import { createPortal } from 'react-dom';

interface WizardOverlayProps {
  visible: boolean;
  onClose?: () => void;
  children: React.ReactNode;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(12, 16, 26, 0.92)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  overflow: 'auto',
  paddingTop: 64
};

export const WizardOverlay: React.FC<WizardOverlayProps> = ({ visible, onClose, children }) => {
  const [mount, setMount] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => {
    setMount(document.body);
    return () => setMount(null);
  }, []);
  if (!visible || !mount) return null;
  return createPortal(
    <div style={overlayStyle} data-ddt-section>
      <div style={{ minWidth: 720, maxWidth: 1040, width: '90%', ['--ddt-accent' as any]: '#a21caf' }}>
        {children}
      </div>
    </div>,
    mount
  );
};

export default WizardOverlay;


