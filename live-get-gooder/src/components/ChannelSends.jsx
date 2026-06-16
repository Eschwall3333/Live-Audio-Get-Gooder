import React from 'react';
import { useDispatch } from 'react-redux';
import { updateChannelSend } from '../store/mixerSlice';
import { audioEngine } from '../audio/AudioEngine';

export const ChannelSends = ({ channel }) => {
  const dispatch = useDispatch();

  const handleSendChange = (busIndex, value) => {
    const val = parseFloat(value);
    
    // 1. Update Redux
    dispatch(updateChannelSend({ channelId: channel.id, busIndex, value: val }));
    
    // 2. Update C++ Audio Engine
    audioEngine.setChannelSendLevel(channel.id, busIndex, val);
  };

  const handleDoubleClick = (busIndex) => {
    handleSendChange(busIndex, 0); // Double-click returns to unity gain
  };

  // SAFETY NET: If Redux hasn't built the sends array yet, default to an array of -60dB
  const sendsArray = channel?.sends || Array(16).fill(-60);

  return (
    <div style={{ background: '#1a1a1c', padding: '10px', borderRadius: '4px', border: '1px solid #333', marginBottom: '15px' }}>
      <h4 style={{ margin: '0 0 10px 0', fontSize: '10px', color: '#17a2b8', textAlign: 'center', letterSpacing: '1px' }}>
        MIX BUS SENDS
      </h4>
      
      {/* 2-COLUMN GRID FOR 16 SENDS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {sendsArray.map((sendLevel, index) => (
          <div key={index} style={{ display: 'flex', flexDirection: 'column' }}>
            <label 
              htmlFor={`ch-${channel.id}-send-${index}`} 
              style={{ fontSize: '9px', color: sendLevel > -60 ? '#f39c12' : '#666', marginBottom: '2px', display: 'flex', justifyContent: 'space-between' }}
            >
              <span>B{index + 1}</span>
              <span>{sendLevel <= -60 ? '-oo' : `${sendLevel}`}</span>
            </label>
            <input 
              id={`ch-${channel.id}-send-${index}`}
              type="range" min="-60" max="10" step="0.5"
              value={sendLevel}
              onChange={(e) => handleSendChange(index, e.target.value)}
              onDoubleClick={() => handleDoubleClick(index)}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};