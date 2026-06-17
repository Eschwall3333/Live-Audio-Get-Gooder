import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateFxReturnFader } from '../store/mixerSlice';
import { audioEngine } from '../audio/AudioEngine';

export const FxReturnStrip = () => {
  const dispatch = useDispatch();
  const fxReturn = useSelector(state => state.mixer.fxReturns[0]);

  const handleFader = (e) => {
    const val = parseFloat(e.target.value);
    dispatch(updateFxReturnFader({ id: fxReturn.id, value: val }));
    
    // Push volume command to DSP Engine
    if (audioEngine.ctx && typeof audioEngine.setFxReturnFader === 'function') {
      audioEngine.setFxReturnFader(fxReturn.id, val);
    }
  };

  return (
    <div style={{ minWidth: '100px', padding: '10px', background: '#222', border: '1px solid #333', borderRadius: '4px', display: 'flex', flexDirection: 'column' }}>
      
      <div style={{ background: '#8e44ad', color: '#fff', textAlign: 'center', padding: '5px', borderRadius: '3px', marginBottom: '10px', fontSize: '12px', fontWeight: 'bold' }}>
        {fxReturn.name}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 'auto', marginBottom: '10px' }}>
        
        {/* FIX: Added proper ID and modern sliding CSS */}
        <input 
          id={`fx-return-fader-${fxReturn.id}`} 
          type="range" min="-60" max="10" step="0.5" 
          value={fxReturn.faderLevel} 
          onChange={handleFader} 
          style={{ 
            height: '250px', 
            width: '30px',
            writingMode: 'vertical-lr', 
            direction: 'rtl',
            cursor: 'grab'
          }} 
        />
        
        {/* FIX: Connected htmlFor directly to the ID above */}
        <label htmlFor={`fx-return-fader-${fxReturn.id}`} style={{ marginTop: '15px', fontWeight: 'bold', color: '#f39c12', cursor: 'pointer', fontSize: '12px' }}>
          {fxReturn.faderLevel <= -60 ? '-oo' : `${fxReturn.faderLevel} dB`}
        </label>
        
      </div>
    </div>
  );
};