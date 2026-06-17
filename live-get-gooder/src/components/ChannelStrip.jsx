import React, { useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateParam, selectChannel } from '../store/mixerSlice';
import { audioEngine } from '../audio/AudioEngine';
import { MiniEQDisplay } from './MiniEQDisplay';

const IntegratedMeter = ({ channelId }) => {
  const canvasRef = useRef(null); const requestRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); const width = canvas.width; const height = canvas.height;

    const drawMeter = () => {
      let db = -80; 
      if (audioEngine.ctx) { try { const engineChannel = audioEngine.getChannel(channelId); if (engineChannel) db = engineChannel.getLevel(); } catch (err) { } }
      let percent = (db + 60) / 70; 
      if (percent < 0.01) percent = 0.01; if (percent > 1) percent = 1;
      const meterHeight = percent * height;

      ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, width, height);
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, '#2ecc71'); gradient.addColorStop(0.7, '#f1c40f'); gradient.addColorStop(0.9, '#e74c3c'); 
      ctx.fillStyle = gradient; ctx.fillRect(0, height - meterHeight, width, meterHeight);

      ctx.fillStyle = '#000';
      for(let i = 0; i < height; i += 4) ctx.fillRect(0, i, width, 1);
      requestRef.current = requestAnimationFrame(drawMeter);
    };
    requestRef.current = requestAnimationFrame(drawMeter);
    return () => cancelAnimationFrame(requestRef.current);
  }, [channelId]);

  return (
    <div style={{ background: '#000', padding: '1px', border: '1px solid #111' }}>
      <canvas ref={canvasRef} width="8" height="200" style={{ display: 'block' }} />
    </div>
  );
};

export const ChannelStrip = ({ channel, activeTab }) => {
  const dispatch = useDispatch();
  const selectedChannelId = useSelector(state => state.mixer.selectedChannelId);
  const isSelected = selectedChannelId === channel.id;

  const handleFader = (e) => {
    const val = parseFloat(e.target.value);
    dispatch(updateParam({ channelId: channel.id, key: 'faderLevel', value: val }));
    if (audioEngine.ctx) { try { audioEngine.setChannelFader(channel.id, val); } catch(e) {} }
  };

  const handlePan = (e) => {
    const val = parseFloat(e.target.value);
    dispatch(updateParam({ channelId: channel.id, key: 'pan', value: val }));
    if (audioEngine.ctx) { try { const engineChannel = audioEngine.getChannel(channel.id); if (engineChannel && typeof engineChannel.setPan === 'function') engineChannel.setPan(val); } catch(e) {} }
  };

  const handleTrim = (e) => {
    const val = parseFloat(e.target.value) || 0;
    dispatch(updateParam({ channelId: channel.id, key: 'trim', value: val }));
  };

  const showFullGrid = activeTab === 'Mixer';

  return (
    <div style={{ width: '85px', minWidth: '85px', flexShrink: 0, background: isSelected ? '#2a2a2c' : '#141414', border: isSelected ? '1px solid #0984e3' : '1px solid #000', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', height: showFullGrid ? '100%' : 'auto' }}>
      
      {showFullGrid && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* FIX: Interactive Trim Input */}
          <div style={{ height: '30px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <input type="number" value={channel.trim || 0} onChange={handleTrim} onDoubleClick={() => handleTrim({target: {value: 0}})} style={{ width: '100%', background: 'transparent', border: 'none', color: '#ccc', fontSize: '11px', fontWeight: 'bold', textAlign: 'center', outline: 'none', MozAppearance: 'textfield', WebkitAppearance: 'none' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '4px', borderBottom: '1px solid #222' }}>
            <div style={{ height: '35px', background: '#0a0a0c', border: '1px solid #333', position: 'relative' }}><div style={{ position: 'absolute', bottom: '2px', left: '2px', fontSize: '8px', color: '#555' }}>GATE</div></div>
            <div style={{ height: '35px', background: '#0a0a0c', border: '1px solid #333', position: 'relative' }}><div style={{ position: 'absolute', bottom: '2px', left: '2px', fontSize: '8px', color: '#555' }}>DYN</div></div>
            <div style={{ height: '40px', background: '#0a0a0c', border: '1px solid #333', overflow: 'hidden' }}><MiniEQDisplay eq={channel.eq} /></div>
          </div>
          <div style={{ flex: 1, padding: '4px', borderBottom: '1px solid #222', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ width: '80%', height: '3px', background: '#0984e3' }}></div>
            <div style={{ width: '40%', height: '3px', background: '#0984e3' }}></div>
            <div style={{ width: '10%', height: '3px', background: '#555' }}></div>
          </div>
        </div>
      )}

      <div style={{ height: '35px', background: '#0984e3', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', borderBottom: '1px solid #000' }}>
        {channel.name}
      </div>

      <div style={{ padding: '6px 4px', display: 'flex', flexDirection: 'column', gap: '6px', borderBottom: '1px solid #222' }}>
        <button onClick={() => dispatch(selectChannel(channel.id))} style={{ background: isSelected ? '#0984e3' : '#222', color: isSelected ? '#fff' : '#888', border: '1px solid #111', padding: '4px', borderRadius: '2px', cursor: 'pointer', fontWeight: 'bold', fontSize: '10px' }}>SELECT</button>
        <button style={{ background: '#222', color: '#888', border: '1px solid #111', padding: '4px', borderRadius: '2px', cursor: 'pointer', fontWeight: 'bold', fontSize: '10px' }}>SOLO</button>
        {/* FIX: Double Click Pan Reset */}
        <div style={{ display: 'flex', justifyContent: 'center' }}><input id={`channel-${channel.id}-pan`} type="range" min="-100" max="100" step="1" value={channel.pan} onChange={handlePan} onDoubleClick={() => handlePan({target: {value: 0}})} style={{ width: '100%', accentColor: '#0984e3' }} /></div>
      </div>

      <div style={{ padding: '8px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#1c1c1c' }}>
        <div style={{ color: '#fff', fontSize: '10px', fontWeight: 'bold', marginBottom: '8px' }}>
          {channel.faderLevel <= -60 ? '-oo' : `${channel.faderLevel > 0 ? '+' : ''}${channel.faderLevel.toFixed(1)}`}
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', gap: '8px', height: '200px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', fontSize: '8px', color: '#666', textAlign: 'right' }}>
            <span>10</span><span>5</span><span>0</span><span>5</span><span>10</span><span>20</span><span>30</span><span>40</span><span>60</span>
          </div>
          {/* FIX: Double Click Fader Reset (-80) */}
          <input id={`channel-${channel.id}-fader`} type="range" min="-60" max="10" step="0.5" value={channel.faderLevel} onChange={handleFader} onDoubleClick={() => handleFader({target: {value: -80}})} style={{ height: '100%', width: '20px', writingMode: 'vertical-lr', direction: 'rtl', cursor: 'grab', accentColor: '#555' }} />
          <IntegratedMeter channelId={channel.id} />
        </div>
        <button style={{ marginTop: '12px', width: '100%', background: '#222', color: '#c0392b', border: '1px solid #111', padding: '6px', borderRadius: '2px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' }}>MUTE</button>
      </div>
    </div>
  );
};