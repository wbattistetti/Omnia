import React, { useState, useEffect } from 'react';
import ProgressBar from '../../Common/ProgressBar';
import { calculateTotalSteps, getStepDescription } from '../utils/stepCalculator';

interface DataNode {
  name: string;
  subData?: string[];
}

interface ProgressBarExampleProps {
  dataNode: DataNode;
  onComplete?: () => void;
}

const ProgressBarExample: React.FC<ProgressBarExampleProps> = ({ dataNode, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(0);
  const [currentDescription, setCurrentDescription] = useState('');

  useEffect(() => {
    // Calcola il numero totale di step quando il componente si monta
    const total = calculateTotalSteps(dataNode);
    setTotalSteps(total);
    setCurrentDescription(getStepDescription(1, dataNode));
  }, [dataNode]);

  useEffect(() => {
    // Simula il progresso degli step
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        const next = prev + 1;
        if (next <= totalSteps) {
          setCurrentDescription(getStepDescription(next, dataNode));
          return next;
        } else {
          clearInterval(interval);
          onComplete?.();
          return prev;
        }
      });
    }, 2000); // Cambia step ogni 2 secondi

    return () => clearInterval(interval);
  }, [totalSteps, dataNode, onComplete]);

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h3 style={{ color: '#fff', marginBottom: '20px' }}>
        Building Dialogue Template for: {dataNode.name}
      </h3>
      
      <ProgressBar 
        currentStep={currentStep}
        totalSteps={totalSteps}
        label="Building your dialogue template"
      />
      
      <div style={{ 
        marginTop: '16px', 
        padding: '12px', 
        backgroundColor: 'rgba(255,255,255,0.1)', 
        borderRadius: '6px',
        color: '#e5e7eb'
      }}>
        <strong>Current step:</strong> {currentDescription}
      </div>
      
      {dataNode.subData && dataNode.subData.length > 0 && (
        <div style={{ 
          marginTop: '16px', 
          padding: '12px', 
          backgroundColor: 'rgba(162,28,175,0.1)', 
          borderRadius: '6px',
          border: '1px solid rgba(162,28,175,0.3)',
          color: '#e5e7eb'
        }}>
          <strong>Structure:</strong> ({dataNode.subData.join(', ')})
        </div>
      )}
    </div>
  );
};

export default ProgressBarExample; 