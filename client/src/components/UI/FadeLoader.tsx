import React from 'react';

export const FadeLoader: React.FC<{ size?: number; className?: string }> = ({ size = 40, className = '' }) => {
  const barStyle: React.CSSProperties = {
    width: Math.max(2, Math.round(size / 8)),
    height: Math.max(6, Math.round(size / 6)),
  };

  return (
    <div className={`flex items-center justify-center space-x-2 ${className}`} aria-hidden>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={barStyle}
          className={`bg-sky-500 dark:bg-sky-400 rounded-sm opacity-75 animate-fade-${i}`}
        />
      ))}
      <style>{`
        @keyframes fade0 { 0%{opacity:0.2; transform: translateY(0);} 50%{opacity:1; transform: translateY(-6px);} 100%{opacity:0.2; transform: translateY(0);} }
        @keyframes fade1 { 0%{opacity:0.2; transform: translateY(0);} 50%{opacity:1; transform: translateY(-6px);} 100%{opacity:0.2; transform: translateY(0);} }
        @keyframes fade2 { 0%{opacity:0.2; transform: translateY(0);} 50%{opacity:1; transform: translateY(-6px);} 100%{opacity:0.2; transform: translateY(0);} }
        .animate-fade-0 { animation: fade0 1s ease-in-out infinite; animation-delay: 0s; }
        .animate-fade-1 { animation: fade1 1s ease-in-out infinite; animation-delay: 0.15s; }
        .animate-fade-2 { animation: fade2 1s ease-in-out infinite; animation-delay: 0.3s; }
      `}</style>
    </div>
  );
};

export default FadeLoader;
