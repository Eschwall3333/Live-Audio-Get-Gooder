import React from 'react';
import { useDispatch } from 'react-redux';
import { updateParam } from '../store/mixerSlice';
import { audioEngine } from '../audio/AudioEngine';
import { ChannelSends } from './ChannelSends';


export const ChannelStrip = ({ channel }) => {
  const dispatch = useDispatch();

  const handleFader = (e) => {
    const val = parseFloat(e.target.value);
    // 1. Update Redux UI
    dispatch(updateParam({ channelId: channel.id, key: 'faderLevel', value: val }));
    // 2. Update C++ Audio Node
    audioEngine.setChannelFader(channel.id, val);
  };

  const handlePan = (e) => {
    const val = parseFloat(e.target.value);
    dispatch(updateParam({ channelId: channel.id, key: 'pan', value: val }));
    
    // Safety check in case the pan node hasn't mounted yet
    const engineChannel = audioEngine.getChannel(channel.id);
    if (engineChannel && typeof engineChannel.setPan === 'function') {
      engineChannel.setPan(val);
    }
  };

  return (
    <div className="channel-strip" style={{ minWidth: '110px', padding: '10px', background: '#222', border: '1px solid #333', borderRadius: '4px', display: 'flex', flexDirection: 'column' }}>
      
      {/* 1. SCRIBBLE STRIP */}
      <div className="scribble-strip" style={{ background: '#444', color: '#fff', textAlign: 'center', padding: '5px', borderRadius: '3px', marginBottom: '15px', fontSize: '12px', fontWeight: 'bold' }}>
        {channel.name}
      </div>

      {/* 1. SCRIBBLE STRIP */}
      <div className="scribble-strip" style={{ background: '#444', color: '#fff', textAlign: 'center', padding: '5px', borderRadius: '3px', marginBottom: '15px', fontSize: '12px', fontWeight: 'bold' }}>
        {channel.name}
      </div>
      
      {/* 2. THE SENDS RACK */}
      <ChannelSends channel={channel} />
      
      {/* 3. PAN KNOB */}
      <div style={{ textAlign: 'center', marginBottom: '15px' }}></div>
      
      {/* 2. PAN KNOB */}
      <div style={{ textAlign: 'center', marginBottom: '15px' }}>
        <label htmlFor={`channel-${channel.id}-pan`} style={{ fontSize: '10px', color: '#888', display: 'block', marginBottom: '5px' }}>
          PAN {channel.pan > 0 ? `R${channel.pan}` : channel.pan < 0 ? `L${Math.abs(channel.pan)}` : 'C'}
        </label>
        <input 
          id={`channel-${channel.id}-pan`}
          type="range" min="-100" max="100" step="1" 
          value={channel.pan} 
          onChange={handlePan} 
          style={{ width: '80%' }} 
        />
      </div>

      {/* 3. MAIN FADER */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 'auto', marginBottom: '10px' }}>
        <input 
          id={`channel-${channel.id}-fader`}
          type="range" min="-60" max="10" step="0.5" 
          value={channel.faderLevel} 
          onChange={handleFader} 
          className="long-throw-fader" 
          style={{ height: '250px', width: '30px' }} 
        />
        <label htmlFor={`channel-${channel.id}-fader`} style={{ marginTop: '15px', fontWeight: 'bold', color: '#f39c12', cursor: 'pointer', fontSize: '12px' }}>
          {channel.faderLevel <= -60 ? '-oo' : `${channel.faderLevel} dB`}
        </label>
      </div>
      
    </div>
  );
};