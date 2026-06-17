import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateMaster } from '../store/mixerSlice';
import { audioEngine } from '../audio/AudioEngine';

export const MasterStrip = () => {
  const dispatch = useDispatch();
  const faderLevel = useSelector(state => state.mixer.master.faderLevel);

  const handleFader = (e) => {
    const val = parseFloat(e.target.value);
    dispatch(updateMaster(val));
    
    if (typeof audioEngine.setMasterFader === 'function') {
      audioEngine.setMasterFader(val);
    }
  };

  return (
    <div style={{ minWidth: '100px', padding: '10px', background: '#222', border: '1px solid #333', borderRadius: '4px', display: 'flex', flexDirection: 'column' }}>
      
      <div style={{ background: '#c0392b', color: '#fff', textAlign: 'center', padding: '5px', borderRadius: '3px', marginBottom: '10px', fontSize: '12px', fontWeight: 'bold' }}>
        MAIN LR
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 'auto', marginBottom: '10px' }}>
        
        <input 
          id="master-fader" // <--- ADDED ID
          type="range" min="-60" max="10" step="0.5" 
          value={faderLevel} 
          onChange={handleFader} 
          style={{ 
            height: '250px', 
            width: '30px',
            writingMode: 'vertical-lr', 
            direction: 'rtl',
            cursor: 'grab'
          }} 
        />
        
        <label htmlFor="master-fader" style={{ marginTop: '15px', fontWeight: 'bold', color: '#f39c12', cursor: 'pointer', fontSize: '12px' }}>
          {faderLevel <= -60 ? '-oo' : `${faderLevel} dB`}
        </label>
        
      </div>
    </div>
  );
};