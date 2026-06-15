import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateParam } from '../store/mixerSlice';
import { audioEngine } from '../audio/AudioEngine';

export const Fader = ({ channelId, activeBus }) => {
  const dispatch = useDispatch();
  const channel = useSelector(state => state.mixer.channels.find(c => c.id === channelId));
  
  const isSendMode = activeBus !== null;
  const currentLevel = isSendMode ? channel.sends[activeBus] : channel.faderLevel;
  
  const [val, setVal] = useState(currentLevel);

  useEffect(() => {
    setVal(currentLevel);
  }, [currentLevel, activeBus]);

  const handleChange = (e) => {
    const numericVal = parseFloat(e.target.value);
    setVal(numericVal);
    
    if (isSendMode) audioEngine.setChannelSendLevel(channelId, activeBus, numericVal);
    else audioEngine.setChannelFader(channelId, numericVal);
  };

  const handleRelease = () => {
    if (isSendMode) {
      const newSends = [...channel.sends];
      newSends[activeBus] = val;
      dispatch(updateParam({ channelId, key: 'sends', value: newSends }));
    } else {
      dispatch(updateParam({ channelId, key: 'faderLevel', value: val }));
    }
  };

  // --- NEW: DOUBLE CLICK TO UNITY (0dB) ---
  const handleDoubleClick = () => {
    const unityGain = 0; 
    setVal(unityGain);
    
    if (isSendMode) {
      audioEngine.setChannelSendLevel(channelId, activeBus, unityGain);
      const newSends = [...channel.sends];
      newSends[activeBus] = unityGain;
      dispatch(updateParam({ channelId, key: 'sends', value: newSends }));
    } else {
      audioEngine.setChannelFader(channelId, unityGain);
      dispatch(updateParam({ channelId, key: 'faderLevel', value: unityGain }));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '300px' }}>
      
      {isSendMode ? (
        <div style={{ background: '#00ffff', color: '#000', fontSize: '0.7rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '2px', marginBottom: '10px' }}>
          SND {activeBus + 1}
        </div>
      ) : (
        <div style={{ height: '20px', marginBottom: '10px' }} />
      )}

      <label htmlFor={`fader-ch-${channelId}`} className="sr-only">Channel {channelId} Volume</label>
      <input 
        id={`fader-ch-${channelId}`}
        name={`fader-ch-${channelId}`}
        type="range" min="-60" max="10" step="0.5" 
        value={val} 
        onChange={handleChange} 
        onMouseUp={handleRelease} 
        onTouchEnd={handleRelease}
        onDoubleClick={handleDoubleClick} /* <-- ATTACHED HERE */
        className="long-throw-fader" 
      />
      
      <span style={{ marginTop: '110px', fontWeight: 'bold', color: isSendMode ? '#00ffff' : '#fff' }}>
        {val <= -60 ? '-oo' : `${val} dB`}
      </span>
    </div>
  );
};