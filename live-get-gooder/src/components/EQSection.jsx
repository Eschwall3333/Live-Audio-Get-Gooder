import React from 'react';
import { useDispatch } from 'react-redux';
import { updateParam } from '../store/mixerSlice';
import { audioEngine } from '../audio/AudioEngine';
import { EQVisualizer } from './EQVisualizer';

export const EQSection = ({ channel }) => {
  const dispatch = useDispatch();

  const handleEqChange = (band, key, value) => {
    const val = parseFloat(value);
    const newEq = { ...channel.eq, [band]: { ...channel.eq[band], [key]: val } };
    dispatch(updateParam({ channelId: channel.id, key: 'eq', value: newEq }));
    
    const b = newEq[band];
    audioEngine.getChannel(channel.id).setEqBand(band, b.gain, b.freq, b.q);
  };

  // --- UPDATED: Added defaultVal and onDoubleClick ---
  const EqKnob = ({ label, band, param, min, max, step, defaultVal }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '5px' }}>
      <label htmlFor={`eq-${channel.id}-${band}-${param}`} style={{ fontSize: '0.7rem', color: '#888', marginBottom: '5px' }}>
        {label}
      </label>
      <input 
        id={`eq-${channel.id}-${band}-${param}`} 
        name={`eq-${channel.id}-${band}-${param}`} 
        type="range" min={min} max={max} step={step}
        value={channel.eq[band][param]} 
        onChange={(e) => handleEqChange(band, param, e.target.value)}
        onDoubleClick={() => handleEqChange(band, param, defaultVal)} /* <-- ATTACHED HERE */
        style={{ width: '60px' }}
      />
      <span style={{ fontSize: '0.7rem', color: '#fff', marginTop: '5px' }}>
        {channel.eq[band][param]} {param === 'freq' ? 'Hz' : param === 'gain' ? 'dB' : ''}
      </span>
    </div>
  );

  return (
    <div className="module-section" style={{ padding: '10px', background: '#252529', border: '1px solid #444', marginBottom: '10px' }}>
      <div className="module-header" style={{ marginBottom: '10px', color: '#f0ad4e', fontWeight: 'bold' }}>
        EQUALIZER
      </div>
      
      <EQVisualizer channel={channel} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        
        {/* PASSED FACTORY DEFAULTS TO EVERY KNOB */}
        <div style={{ display: 'flex', justifyContent: 'space-between', background: '#1c1c1f', padding: '5px', borderRadius: '4px' }}>
          <EqKnob label="HI GAIN" band="High" param="gain" min="-15" max="15" step="0.5" defaultVal="0" />
          <EqKnob label="FREQ" band="High" param="freq" min="2000" max="20000" step="10" defaultVal="10000" />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', background: '#1c1c1f', padding: '5px', borderRadius: '4px' }}>
          <EqKnob label="HM GAIN" band="HighMid" param="gain" min="-15" max="15" step="0.5" defaultVal="0" />
          <EqKnob label="FREQ" band="HighMid" param="freq" min="400" max="10000" step="10" defaultVal="2000" />
          <EqKnob label="Q" band="HighMid" param="q" min="0.1" max="10" step="0.1" defaultVal="1.0" />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', background: '#1c1c1f', padding: '5px', borderRadius: '4px' }}>
          <EqKnob label="LM GAIN" band="LowMid" param="gain" min="-15" max="15" step="0.5" defaultVal="0" />
          <EqKnob label="FREQ" band="LowMid" param="freq" min="100" max="2000" step="10" defaultVal="400" />
          <EqKnob label="Q" band="LowMid" param="q" min="0.1" max="10" step="0.1" defaultVal="1.0" />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', background: '#1c1c1f', padding: '5px', borderRadius: '4px' }}>
          <EqKnob label="LO GAIN" band="Low" param="gain" min="-15" max="15" step="0.5" defaultVal="0" />
          <EqKnob label="FREQ" band="Low" param="freq" min="20" max="500" step="1" defaultVal="100" />
        </div>

      </div>
    </div>
  );
};