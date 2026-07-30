import React from 'react';

export default function RadioGroup({ label, value, onChange, error }) {
  return (
    <div className="mb-4 mt-2">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium text-slate-700">
          {label} <span className="text-red-600">*</span>
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
                className="w-4 h-4 text-accent-600 bg-white border-slate-300 focus:ring-accent-500 focus:ring-2 cursor-pointer"
              />
              <span className="text-sm text-slate-800">{opt}</span>
            </label>
          ))}
        </div>
      </div>
      {error && <span className="text-red-600 text-xs mt-1 block font-semibold animate-pulse">{error}</span>}
    </div>
  );
}