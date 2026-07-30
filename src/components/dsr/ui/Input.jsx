import React from 'react';

export default function Input({ label, type = "number", value, onChange, required, readOnly, placeholder, error }) {
  return (
    <div className="mb-3 w-full" data-error={error ? "true" : undefined}>
      <label className="block text-sm font-medium text-slate-300 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        readOnly={readOnly}
        placeholder={placeholder}
        className={`w-full p-2 rounded-lg bg-slate-900 border transition outline-none focus:ring-2 
          ${error 
            ? 'border-red-500 ring-1 ring-red-500 text-slate-100 placeholder-red-400/50' 
            : readOnly 
              ? 'border-slate-700 text-slate-500 focus:ring-transparent cursor-not-allowed' 
              : 'border-slate-600 text-slate-100 focus:ring-blue-500'
          }`}
      />
      {error && <span className="text-red-500 text-xs mt-1 block font-semibold animate-pulse">{error}</span>}
    </div>
  );
}