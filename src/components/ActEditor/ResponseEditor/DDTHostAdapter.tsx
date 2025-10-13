import React from 'react';
import type { EditorProps } from '../EditorHost/types';
import ResponseEditor from './index';

export default function DDTHostAdapter({ act, onClose }: EditorProps){
  const placeholder = React.useMemo(() => ({
    id: `temp_ddt_${act.id}`,
    label: act.label || 'Data',
    mainData: []
  }), [act.id, act.label]);
  return (
    <ResponseEditor ddt={placeholder} onClose={onClose} act={act} />
  );
}


