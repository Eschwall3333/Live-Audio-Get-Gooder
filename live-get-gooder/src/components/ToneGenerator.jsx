import React, { useState, useEffect } from 'react';
import { audioEngine } from '../audio/AudioEngine';

export const ToneGenerator = () => {
  const [isOn, setIsOn] = useState(false);
  const [freq, setFreq] = useState(1000); // Standard 1kHz test tone
  const [level, setLevel] = useState(-60); // Starts muted for safety
  const [destination, setDestination] = useState('MAIN-0'); // Format: TYPE-ID

  // Handle Audio Engine Start/Stop
  useEffect(() => {
    if (isOn) {
      audioEngine.playTone(freq, 'sine');
      audioEngine.setToneLevel(level);
    } else {
      audioEngine.stopTone();
    }
    // Cleanup if component unmounts
    return () => audioEngine.stopTone();
  }, [isOn]);

  // Handle Frequency Sweeps (Only updates engine if actively playing)
  const handleFreqChange = (e) => {
    const newFreq = parseFloat(e.target.value);
    setFreq(newFreq);
    if (isOn && audioEngine.toneOsc) {
      audioEngine.toneOsc.frequency.setTargetAtTime(newFreq, audioEngine.ctx.currentTime, 0.01);
    }
  };

  // Handle Volume Adjustments
  const handleLevelChange = (e) => {
    const newLevel = parseFloat(e.target.value);
    setLevel(newLevel);
    audioEngine.setToneLevel(newLevel);
  };

  // Handle Physical Patching
  const handleRoutingChange = (e) => {
    const val = e.target.value;
    setDestination(val);
    
    const [destType, destId] = val.split('-');
    audioEngine.setToneRouting(destType, parseInt(destId));
  };

  return (
    <div className="module-section" style={{ background: '#1c1c1f', border: '1px solid #444', borderRadius: '4px', padding: '15px', display: 'flex', alignItems: 'center', gap: '20px' }}>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <div className="module-header" style={{ margin: 0, textAlign: 'left', color: '#00ffff' }}>OSCILLATOR</div>
        
        {/* ROUTING DROPDOWN */}
        <label htmlFor="osc-routing" className="sr-only">Oscillator Destination</label>
        <select 
          id="osc-routing"
          value={destination} 
          onChange={handleRoutingChange}
          style={{ background: '#111', color: '#fff', padding: '5px', border: '1px solid #555', borderRadius: '3px', fontWeight: 'bold' }}
        >
          <optgroup label="Main Output">
            <option value="MAIN-0">MAIN LR</option>
          </optgroup>
          <optgroup label="Input Channels">
            {Array.from({ length: 32 }, (_, i) => (
              <option key={`ch-${i+1}`} value={`CH-${i+1}`}>CH {i+1}</option>
            ))}
          </optgroup>
          <optgroup label="Mix Buses">
            {Array.from({ length: 16 }, (_, i) => (
              <option key={`bus-${i+1}`} value={`BUS-${i+1}`}>MIX BUS {i+1}</option>
            ))}
          </optgroup>
        </select>
      </div>

      <div style={{ width: '1px', background: '#333', height: '40px' }} />

      {/* FREQUENCY KNOB */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <label htmlFor="osc-freq" style={{ fontSize: '0.65rem', color: '#888', marginBottom: '5px', letterSpacing: '1px' }}>FREQ</label>
        <input 
          id="osc-freq" type="range" min="20" max="20000" step="10" 
          value={freq} onChange={handleFreqChange} 
          style={{ width: '60px' }}
        />
        <span style={{ fontSize: '0.7rem', color: '#fff', marginTop: '5px' }}>{freq} Hz</span>
      </div>

      {/* LEVEL KNOB */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <label htmlFor="osc-level" style={{ fontSize: '0.65rem', color: '#888', marginBottom: '5px', letterSpacing: '1px' }}>LEVEL</label>
        <input 
          id="osc-level" type="range" min="-60" max="0" step="0.5" 
          value={level} onChange={handleLevelChange} 
          onDoubleClick={() => { setLevel(-60); audioEngine.setToneLevel(-60); }}
          style={{ width: '60px' }}
        />
        <span style={{ fontSize: '0.7rem', color: isOn ? '#d9534f' : '#fff', marginTop: '5px' }}>
          {level <= -60 ? '-oo' : `${level} dB`}
        </span>
      </div>

      {/* ACTIVATE BUTTON */}
      <button 
        onClick={() => setIsOn(!isOn)}
        style={{ 
          padding: '10px 20px', 
          background: isOn ? '#d9534f' : '#333', 
          color: isOn ? '#fff' : '#888', 
          border: isOn ? '1px solid #ff0000' : '1px solid #555', 
          borderRadius: '4px', 
          fontWeight: 'bold', 
          cursor: 'pointer',
          boxShadow: isOn ? '0 0 10px rgba(217, 83, 79, 0.5)' : 'none',
          transition: 'all 0.1s'
        }}
      >
        {isOn ? 'ENGAGED' : 'OFF'}
      </button>

    </div>
  );
};