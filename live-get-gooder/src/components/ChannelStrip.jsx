import React, { useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateParam, selectChannel } from '../store/mixerSlice';
import { audioEngine } from '../audio/AudioEngine';
import { ChannelSends } from './ChannelSends';
import { MiniEQDisplay } from './MiniEQDisplay';

// ==========================================================
// 1. THE EMBEDDED LED METER ENGINE
// ==========================================================
const IntegratedMeter = ({ channelId }) => {
  const canvasRef = useRef(null);
  const requestRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const drawMeter = () => {
      let db = -80; 

      if (audioEngine.ctx) {
        try {
          const engineChannel = audioEngine.getChannel(channelId);
          if (engineChannel) db = engineChannel.getLevel();
        } catch (err) { /* Fail silently if engine booting */ }
      }

      let percent = (db + 60) / 70; 
      if (percent < 0.01) percent = 0.01; // Tiny green dot so you know it's powered on
      if (percent > 1) percent = 1;

      const meterHeight = percent * height;

      // Draw dark background
      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(0, 0, width, height);

      // Draw glowing gradient
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, '#2ecc71');   
      gradient.addColorStop(0.7, '#f1c40f'); 
      gradient.addColorStop(0.9, '#e74c3c'); 

      ctx.fillStyle = gradient;
      ctx.fillRect(0, height - meterHeight, width, meterHeight);

      requestRef.current = requestAnimationFrame(drawMeter);
    };

    requestRef.current = requestAnimationFrame(drawMeter);
    return () => cancelAnimationFrame(requestRef.current);
  }, [channelId]);

  return (
    <div style={{ background: '#000', padding: '2px', borderRadius: '3px', border: '1px solid #222' }}>
      <canvas ref={canvasRef} width="10" height="250" style={{ display: 'block', borderRadius: '2px' }} />
    </div>
  );
};

// ==========================================================
// 2. THE MAIN CHANNEL STRIP
// ==========================================================
export const ChannelStrip = ({ channel }) => {
  const dispatch = useDispatch();
  const selectedChannelId = useSelector(state => state.mixer.selectedChannelId);
  const isSelected = selectedChannelId === channel.id;

  const handleFader = (e) => {
    const val = parseFloat(e.target.value);
    dispatch(updateParam({ channelId: channel.id, key: 'faderLevel', value: val }));
    audioEngine.setChannelFader(channel.id, val);
  };

  const handlePan = (e) => {
    const val = parseFloat(e.target.value);
    dispatch(updateParam({ channelId: channel.id, key: 'pan', value: val }));
    const engineChannel = audioEngine.getChannel(channel.id);
    if (engineChannel && typeof engineChannel.setPan === 'function') {
      engineChannel.setPan(val);
    }
  };

  return (
    <div className="channel-strip" style={{ 
      minWidth: '110px', flexShrink: 0, padding: '10px', 
      background: isSelected ? '#2a2a2c' : '#222', 
      border: isSelected ? '1px solid #17a2b8' : '1px solid #333', 
      borderRadius: '4px', display: 'flex', flexDirection: 'column' 
    }}>
      
      <div className="scribble-strip" style={{ background: '#444', color: '#fff', textAlign: 'center', padding: '5px', borderRadius: '3px', marginBottom: '10px', fontSize: '12px', fontWeight: 'bold' }}>
        {channel.name}
      </div>

      <MiniEQDisplay eq={channel.eq} />

      <button 
        onClick={() => dispatch(selectChannel(channel.id))}
        style={{
          background: isSelected ? '#17a2b8' : '#333',
          color: isSelected ? '#000' : '#888',
          border: 'none', padding: '5px', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '15px'
        }}
      >
        SELECT
      </button>
      
      <ChannelSends channel={channel} />

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

      {/* 6. METER & MAIN FADER */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 'auto', marginBottom: '10px' }}>
        
        <div style={{ display: 'flex', flexDirection: 'row', gap: '15px', alignItems: 'flex-end', height: '250px' }}>
          
          <IntegratedMeter channelId={channel.id} />

          {/* FIX #2: Inline modern CSS to guarantee sliding faders */}
          <input 
            id={`channel-${channel.id}-fader`}
            type="range" min="-60" max="10" step="0.5" 
            value={channel.faderLevel} 
            onChange={handleFader} 
            style={{ 
              height: '250px', 
              width: '30px',
              writingMode: 'vertical-lr', 
              direction: 'rtl',
              cursor: 'grab'
            }} 
          />
        </div>

        <label htmlFor={`channel-${channel.id}-fader`} style={{ marginTop: '15px', fontWeight: 'bold', color: '#f39c12', cursor: 'pointer', fontSize: '12px' }}>
          {channel.faderLevel <= -60 ? '-oo' : `${channel.faderLevel} dB`}
        </label>
      </div>
      
    </div>
  );
};