import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateMasterMultiband } from '../store/mixerSlice';
import { audioEngine } from '../audio/AudioEngine';

export const MasterMultiband = () => {
  const dispatch = useDispatch();
  const mbc = useSelector((state) => state.mixer.master.multiband);

  const handleChange = (band, key, value) => {
    const val = parseFloat(value);
    dispatch(updateMasterMultiband({ band, key, value: val }));
    const newState = { ...mbc, [band]: { ...mbc[band], [key]: val } };
    audioEngine.setMasterMultiband(newState.active, newState.low, newState.mid, newState.high);
  };

  const toggleActive = () => {
    const newActive = !mbc.active;
    dispatch(updateMasterMultiband({ band: 'active', value: newActive }));
    audioEngine.setMasterMultiband(newActive, mbc.low, mbc.mid, mbc.high);
  };

  const BandControl = ({ bandName, label, data }) => (
    <div style={{ flex: 1, padding: '10px', border: '1px solid #333', borderRadius: '4px', textAlign: 'center', background: '#222' }}>
      <h4 style={{ margin: '0 0 15px 0', color: '#f39c12', fontSize: '12px' }}>{label}</h4>
      
      <div style={{ marginBottom: '15px' }}>
        <label htmlFor={`mbc-${bandName}-thresh`} style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '5px' }}>
          THRESH ({data.thresh}dB)
        </label>
        <input 
          id={`mbc-${bandName}-thresh`}
          type="range" min="-60" max="0" step="1" value={data.thresh} 
          onChange={(e) => handleChange(bandName, 'thresh', e.target.value)} 
          style={{ width: '100%' }} 
        />
      </div>
      
      <div style={{ marginBottom: '15px' }}>
        <label htmlFor={`mbc-${bandName}-ratio`} style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '5px' }}>
          RATIO ({data.ratio}:1)
        </label>
        <input 
          id={`mbc-${bandName}-ratio`}
          type="range" min="1" max="20" step="0.5" value={data.ratio} 
          onChange={(e) => handleChange(bandName, 'ratio', e.target.value)} 
          style={{ width: '100%' }} 
        />
      </div>
      
      <div>
        <label htmlFor={`mbc-${bandName}-gain`} style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '5px' }}>
          GAIN ({data.gain}dB)
        </label>
        <input 
          id={`mbc-${bandName}-gain`}
          type="range" min="0" max="24" step="0.5" value={data.gain} 
          onChange={(e) => handleChange(bandName, 'gain', e.target.value)} 
          style={{ width: '100%' }} 
        />
      </div>
    </div>
  );

  return (
    <div style={{ padding: '15px', background: '#1c1c1f', border: '1px solid #444', borderRadius: '6px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0, color: '#f39c12', fontSize: '14px', letterSpacing: '1px' }}>MASTER MULTIBAND COMP</h3>
        <button 
          onClick={toggleActive}
          style={{
            background: mbc.active ? '#f39c12' : '#333', color: mbc.active ? '#000' : '#888',
            border: 'none', padding: '6px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px'
          }}
        >
          {mbc.active ? 'ACTIVE' : 'BYPASSED'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <BandControl bandName="low" label="LOW (0 - 250Hz)" data={mbc.low} />
        <BandControl bandName="mid" label="MID (250Hz - 2.5kHz)" data={mbc.mid} />
        <BandControl bandName="high" label="HIGH (2.5kHz+)" data={mbc.high} />
      </div>
    </div>
  );
};