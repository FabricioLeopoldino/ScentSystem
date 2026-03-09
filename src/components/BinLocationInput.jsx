// BinLocationInput.jsx - Reusable component for bin location
// Use in: Products, Stock Management, Machine Inventory

import { useState, useEffect } from 'react';

export default function BinLocationInput({ category, value, onChange, disabled = false }) {
  const [inputMode, setInputMode] = useState('helper'); // 'helper' or 'manual'

  // Parse existing location
  const parseLocation = (loc) => {
    if (!loc) return { aisle: '', bay: '', position: '' };
    const match = loc.match(/Aisle:?\s*(\d+),?\s*Bay:?\s*([A-Z]+|Floor),?\s*Position:?\s*(\d+)/i);
    if (match) {
      return { aisle: match[1], bay: match[2].toUpperCase(), position: match[3] };
    }
    return { aisle: '', bay: '', position: '' };
  };

  const parsed = parseLocation(value);
  const [aisle, setAisle] = useState(parsed.aisle);
  const [bay, setBay] = useState(parsed.bay);
  const [position, setPosition] = useState(parsed.position);
  const [manualText, setManualText] = useState(value || '');

  // FIX: useEffect propagates onChange whenever aisle/bay/position change
  // Avoids stale closure bug where old state values were captured in handleUpdate
  useEffect(() => {
    if (inputMode !== 'helper') return;
    if (aisle && bay && position) {
      onChange(`Aisle: ${aisle}, Bay: ${bay}, Position: ${position}`);
    }
  }, [aisle, bay, position, inputMode]);

  // Build location string (for display only)
  const buildLocation = () => {
    if (inputMode === 'manual') return manualText;
    if (aisle && bay && position) {
      return `Aisle: ${aisle}, Bay: ${bay}, Position: ${position}`;
    }
    return '';
  };

  // OILS get structured helper
  if (category === 'OILS') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className={`btn ${inputMode === 'helper' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setInputMode('helper')}
            style={{ fontSize: '12px', padding: '6px 12px' }}
            disabled={disabled}
          >
            🗺️ Cold Room Helper
          </button>
          <button
            type="button"
            className={`btn ${inputMode === 'manual' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setInputMode('manual')}
            style={{ fontSize: '12px', padding: '6px 12px' }}
            disabled={disabled}
          >
            ✍️ Manual Input
          </button>
        </div>

        {inputMode === 'helper' ? (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label style={{ fontSize: '12px' }}>Aisle</label>
              <select
                className="input"
                value={aisle}
                onChange={(e) => {
                  const newAisle = e.target.value;
                  setAisle(newAisle);
                  // Auto-set bay based on aisle
                  const bayMap = { '1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'FLOOR' };
                  setBay(bayMap[newAisle] || '');
                  setPosition('');
                }}
                disabled={disabled}
              >
                <option value="">Select...</option>
                <option value="1">1 (Bay A - Bottom)</option>
                <option value="2">2 (Bay B - Middle-Bottom)</option>
                <option value="3">3 (Bay C - Middle-Top)</option>
                <option value="4">4 (Bay D - Top)</option>
                <option value="5">5 (Floor - Left)</option>
              </select>
            </div>

            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label style={{ fontSize: '12px' }}>Bay</label>
              <select
                className="input"
                value={bay}
                onChange={(e) => setBay(e.target.value)}
                disabled={disabled}
              >
                <option value="">Select...</option>
                {aisle === '1' && <option value="A">A</option>}
                {aisle === '2' && <option value="B">B</option>}
                {aisle === '3' && <option value="C">C</option>}
                {aisle === '4' && <option value="D">D</option>}
                {aisle === '5' && <option value="FLOOR">Floor</option>}
              </select>
            </div>

            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label style={{ fontSize: '12px' }}>Position</label>
              <input
                type="number"
                className="input"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder={aisle === '4' ? '1-19' : '1-16'}
                min="1"
                max={aisle === '4' ? 19 : 16}
                disabled={disabled}
              />
            </div>
          </div>
        ) : (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '12px' }}>Location (Manual)</label>
            <input
              type="text"
              className="input"
              value={manualText}
              onChange={(e) => {
                setManualText(e.target.value);
                onChange(e.target.value);
              }}
              placeholder="e.g., Aisle: 1, Bay: A, Position: 3"
              disabled={disabled}
            />
          </div>
        )}

        {buildLocation() && (
          <div style={{ 
            padding: '8px 12px', 
            background: '#ecfdf5', 
            borderRadius: '6px',
            fontSize: '12px',
            color: '#047857',
            border: '1px solid #10b981'
          }}>
            📍 Location: <strong>{buildLocation()}</strong>
          </div>
        )}
      </div>
    );
  }

  // Others get simple text input
  return (
    <div className="form-group">
      <label>
        Bin Location
        <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '8px' }}>
          (e.g., Shelf D-5, Production Floor, etc.)
        </span>
      </label>
      <input
        type="text"
        className="input"
        value={manualText}
        onChange={(e) => { setManualText(e.target.value); onChange(e.target.value); }}
        placeholder="Enter physical location..."
        disabled={disabled}
      />
    </div>
  );
}
