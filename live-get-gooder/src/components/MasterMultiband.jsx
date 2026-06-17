import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateMasterMultiband } from '../store/mixerSlice';

export const MasterMultiband = () => {
  const dispatch = useDispatch();
  const multiband = useSelector(state => state.mixer.master.multiband);

  const handleToggle = () => {
    dispatch(updateMasterMultiband({ band: 'active', param: null, value: !multiband.active }));
  };

  const handleParam = (band, param, val) => {
    dispatch(updateMasterMultiband({ band, param, value: parseFloat(val) }));
  };

  const renderBand = (bandName, label, color) => {
    const bandData = multiband[bandName];
    
    return (
      <div style={{ flex: 1, padding: '10px', background: '#222', borderRadius: '4px', borderTop: `3px solid ${color}`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold', marginBottom: '15px' }}>{label}</div>

        {/* THRESHOLD */}
        <label htmlFor={`mb-${bandName}-thresh`} style={{ fontSize: '10px', color: '#888', marginBottom: '5px' }}>
          THRESH: {bandData.thresh}dB
        </label>
        <input 
          id={`mb-${bandName}-thresh`} // <--- LINKED
          type="range" min="-60" max="0" step="1" 
          value={bandData.thresh} 
          onChange={(e) => handleParam(bandName, 'thresh', e.target.value)} 
          style={{ width: '100%', marginBottom: '15px' }} 
        />

        {/* RATIO */}
        <label htmlFor={`mb-${bandName}-ratio`} style={{ fontSize: '10px', color: '#888', marginBottom: '5px' }}>
          RATIO: {bandData.ratio}:1
        </label>
        <input 
          id={`mb-${bandName}-ratio`} // <--- LINKED
          type="range" min="1" max="20" step="0.5" 
          value={bandData.ratio} 
          onChange={(e) => handleParam(bandName, 'ratio', e.target.value)} 
          style={{ width: '100%', marginBottom: '20px' }} 
        />

        {/* MAKEUP GAIN */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 'auto' }}>
          <input
            id={`mb-${bandName}-gain`} // <--- LINKED
            type="range" min="-15" max="15" step="0.5"
            value={bandData.gain}
            onChange={(e) => handleParam(bandName, 'gain', e.target.value)}
            style={{ height: '120px', width: '24px', writingMode: 'vertical-lr', direction: 'rtl', cursor: 'grab' }}
          />
          
          <label htmlFor={`mb-${bandName}-gain`} style={{ marginTop: '10px', fontSize: '11px', fontWeight: 'bold', color: '#f39c12' }}>
            {bandData.gain > 0 ? `+${bandData.gain}` : bandData.gain} dB
          </label>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '15px', background: '#1c1c1f', border: '1px solid #444', borderRadius: '6px', marginBottom: '15px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0, color: '#17a2b8', fontSize: '14px', letterSpacing: '1px' }}>MASTER COMP</h3>
        <button onClick={handleToggle} style={{ background: multiband.active ? '#2ecc71' : '#333', color: multiband.active ? '#000' : '#888', border: 'none', padding: '6px 12px', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold', fontSize: '10px' }}>
          {multiband.active ? 'ON' : 'OFF'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        {renderBand('low', 'LOW', '#2ecc71')}
        {renderBand('mid', 'MID', '#f1c40f')}
        {renderBand('high', 'HIGH', '#17a2b8')}
      </div>
    </div>
  );
};