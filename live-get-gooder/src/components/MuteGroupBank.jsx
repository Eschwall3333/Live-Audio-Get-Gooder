import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setMuteGroupActive } from '../store/mixerSlice';
import { audioEngine } from '../audio/AudioEngine';

export const MuteGroupBank = () => {
  const dispatch = useDispatch();
  const muteGroups = useSelector(state => state.mixer.muteGroups);

  const toggleMute = (index) => {
    const isNowActive = !muteGroups[index].active;
    
    // Update UI State
    dispatch(setMuteGroupActive({ muteGroupIndex: index, active: isNowActive }));
    
    // Instantly Kill/Unkill the audio engine nodes
    audioEngine.setMuteGroupState(index, isNowActive);
  };

  return (
    <div style={{ display: 'flex', gap: '10px', background: '#1c1c1f', padding: '10px 15px', borderRadius: '4px', border: '1px solid #444', alignItems: 'center' }}>
      <div className="module-header" style={{ margin: 0, color: '#f0ad4e' }}>MUTE GROUPS</div>
      
      <div style={{ width: '1px', background: '#333', height: '20px', margin: '0 10px' }} />
      
      {muteGroups.map((mg, i) => (
        <button
          key={i}
          onClick={() => toggleMute(i)}
          style={{
            width: '40px', height: '30px',
            background: mg.active ? '#ff0000' : '#222',
            color: mg.active ? '#fff' : '#888',
            border: mg.active ? '1px solid #ffaaaa' : '1px solid #444',
            borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer',
            boxShadow: mg.active ? '0 0 15px rgba(255,0,0,0.8)' : 'inset 0 2px 4px rgba(0,0,0,0.5)',
            transition: 'all 0.1s'
          }}
        >
          {i + 1}
        </button>
      ))}
    </div>
  );
};