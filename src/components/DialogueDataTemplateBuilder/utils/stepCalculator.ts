interface DataNode {
  name: string;
  subData?: string[];
}

export const calculateTotalSteps = (dataNode: DataNode): number => {
  // Formula semplice: 5 × (data + numero di subData)
  const dataCount = 1; // Sempre 1 data
  const subDataCount = dataNode.subData ? dataNode.subData.length : 0;
  
  return 5 * (dataCount + subDataCount);
};

export const getStepDescription = (currentStep: number, dataNode: DataNode): string => {
  const totalSteps = calculateTotalSteps(dataNode);
  
  if (currentStep <= 0 || currentStep > totalSteps) {
    return 'Processing...';
  }
  
  // Calcola a quale elemento appartiene lo step corrente
  const stepPerElement = 5;
  const elementIndex = Math.floor((currentStep - 1) / stepPerElement);
  const stepInElement = ((currentStep - 1) % stepPerElement) + 1;
  
  // Determina se è data o subData
  if (elementIndex === 0) {
    // data
    const stepNames = [
      'Detecting data type',
      'Suggesting structure and constraints', 
      'Generating start prompt',
      'Generating no match prompts',
      'Generating success prompts'
    ];
    return `${stepNames[stepInElement - 1]} for ${dataNode.name}`;
  } else {
    // SubData
    const subDataIndex = elementIndex - 1;
    if (dataNode.subData && dataNode.subData[subDataIndex]) {
      const subDataName = dataNode.subData[subDataIndex];
      const stepNames = [
        'Generating start prompt',
        'Generating no match prompts',
        'Generating no input prompts',
        'Generating confirmation prompts', 
        'Generating success prompts'
      ];
      return `${stepNames[stepInElement - 1]} for ${subDataName}`;
    }
  }
  
  return 'Processing...';
}; 