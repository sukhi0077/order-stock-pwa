import React from 'react';

export default function RadioGroup({ label, value, onChange, error }) {
  return (
    <div className="mb-4 mt-2">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium text-slate-300">
          {label} <span className="text-red-500">*</span>
        </span>
        <div className="flex gap-4">
          {['Yes', 'No'].map(opt => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                name={label} 
                value={opt} 
                checked={value === opt} 
                onChange={(e) => onChange(e.target.value)}
                className="w-4 h-4 text-blue-500 bg-slate-900 border-slate-600 focus:ring-blue-500 focus:ring-2 cursor-pointer"
              />
              <span className="text-sm text-slate-200">{opt}</span>
            </label>
          ))}
        </div>
      </div>
      {error && <span className="text-red-500 text-xs mt-1 block font-semibold animate-pulse">{error}</span>}
    </div>
  );
}