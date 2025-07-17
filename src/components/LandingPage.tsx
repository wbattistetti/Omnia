import React from 'react';

interface LandingPageProps {
  onStartClick: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStartClick }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-emerald-300 rounded-full blur-3xl"></div>
      </div>
      
      {/* Main content */}
      <div className="relative z-10 text-center">
        {/* OMNIA title with glow effect */}
        <h1 className="text-8xl md:text-9xl font-bold text-white mb-8 tracking-wider">
          <span className="omnia-glow-letter" style={{ animationDelay: '0s' }}>O</span>
          <span className="omnia-glow-letter" style={{ animationDelay: '0.2s' }}>M</span>
          <span className="omnia-glow-letter" style={{ animationDelay: '0.4s' }}>N</span>
          <span className="omnia-glow-letter" style={{ animationDelay: '0.6s' }}>I</span>
          <span className="omnia-glow-letter" style={{ animationDelay: '0.8s' }}>A</span>
        </h1>
        
        {/* Payoff */}
        <p className="text-3xl md:text-4xl text-emerald-100 mb-12 font-light tracking-normal max-w-xl mx-auto">
          La nuova era del customer care.
        </p>
        
        {/* Start button */}
        <button
          onClick={onStartClick}
          className="bg-white text-emerald-800 px-12 py-4 rounded-full text-xl font-semibold hover:bg-emerald-50 hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-white/20"
        >
          Inizia
        </button>
      </div>
      
      {/* Subtle animation elements */}
      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2">
        <div className="w-1 h-8 bg-white/30 rounded-full animate-pulse"></div>
      </div>
    </div>
  );
};