import React, { useState, useEffect } from 'react';

const AnimatedDots: React.FC = () => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return <span className="text-blue-600 font-mono">{dots}</span>;
};

export default AnimatedDots;

