/**
 * True while the browser tab/window is visible (Page Visibility API).
 * Use to pause background polling when the designer is not looking at Omnia.
 */

import * as React from 'react';

export function useDocumentVisible(): boolean {
  const [visible, setVisible] = React.useState(
    () => typeof document === 'undefined' || document.visibilityState === 'visible'
  );

  React.useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  return visible;
}
