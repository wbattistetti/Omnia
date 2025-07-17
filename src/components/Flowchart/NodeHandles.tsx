import React from 'react';
import { Handle, Position } from 'reactflow';

interface NodeHandlesProps {
  isConnectable: boolean;
}

export const NodeHandles: React.FC<NodeHandlesProps> = ({ isConnectable }) => {
  return (
    <>
      {/* Top handles */}
      <Handle 
        type="source" 
        position={Position.Top} 
        id="top"
        isConnectable={isConnectable}
        isConnectableStart={true}
        isConnectableEnd={false}
      />
      <Handle 
        type="target" 
        position={Position.Top} 
        id="top-target"
        isConnectable={isConnectable}
        isConnectableStart={false}
        isConnectableEnd={true}
      />
      
      {/* Left handles */}
      <Handle 
        type="source" 
        position={Position.Left} 
        id="left"
        isConnectable={isConnectable}
        isConnectableStart={true}
        isConnectableEnd={false}
      />
      <Handle 
        type="target" 
        position={Position.Left} 
        id="left-target"
        isConnectable={isConnectable}
        isConnectableStart={false}
        isConnectableEnd={true}
      />
      
      {/* Right handles */}
      <Handle 
        type="source" 
        position={Position.Right} 
        id="right"
        isConnectable={isConnectable}
        isConnectableStart={true}
        isConnectableEnd={false}
      />
      <Handle 
        type="target" 
        position={Position.Right} 
        id="right-target"
        isConnectable={isConnectable}
        isConnectableStart={false}
        isConnectableEnd={true}
      />
      
      {/* Bottom handles */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="bottom"
        isConnectable={isConnectable}
        isConnectableStart={true}
        isConnectableEnd={false}
      />
      <Handle 
        type="target" 
        position={Position.Bottom} 
        id="bottom-target"
        isConnectable={isConnectable}
        isConnectableStart={false}
        isConnectableEnd={true}
      />
    </>
  );
};