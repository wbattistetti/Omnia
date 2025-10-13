import React from 'react';

export function LatencyMeter({ lat }: { lat: { a: number; b: number; total: number } }){
  return (
    <div className="text-xs text-gray-600 mt-2">
      Latency: {lat.total}ms (a {lat.a}ms; b {lat.b}ms)
    </div>
  );
}


