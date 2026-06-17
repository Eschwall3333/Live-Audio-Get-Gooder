import React, { useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateChannelEq } from '../store/mixerSlice';
import { audioEngine } from '../audio/AudioEngine';

// ==========================================
// 1. THE BIG EQ VISUALIZER
// ==========================================
const BigEQDisplay = ({ eq }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, width, height);

    // Draw Grid Lines & 0dB Center
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(width * (i / 4), 0); ctx.lineTo(width * (i / 4), height); ctx.stroke();
    }
    ctx.strokeStyle = '#444';
    ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();

    const bands = eq || {
      low: { gain: 0 }, lowMid: { gain: 0 }, highMid: { gain: 0 }, high: { gain: 0 }
    };

    // Map -15dB to +15dB into Y pixels
    const getY = (gain) => (height / 2) - (gain / 15) * (height / 2 - 10);

    const pts = [
      { x: width * 0.1, y: getY(bands.low.gain) },
      { x: width * 0.35, y: getY(bands.lowMid.gain) },
      { x: width * 0.65, y: getY(bands.highMid.gain) },
      { x: width * 0.9, y: getY(bands.high.gain) }
    ];

    // Draw the Glowing EQ Curve
    ctx.strokeStyle = '#17a2b8';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, height / 2); 
    ctx.lineTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.lineTo(pts[2].x, pts[2].y);
    ctx.lineTo(pts[3].x, pts[3].y);
    ctx.lineTo(width, height / 2); 
    ctx.stroke();

    // Draw Frequency Nodes
    ctx.fillStyle = '#fff';
    pts.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    });

  }, [eq]);

  return (
    <div style={{ padding: '5px', background: '#000', borderRadius: '4px', border: '1px solid #333' }}>
      <canvas ref={canvasRef} width="600" height="150" style={{ display: 'block', width: '100%' }} />
    </div>
  );
};

// ==========================================
// 2. THE MASTER CONTROL SCREEN
// ==========================================
export const FatChannel = () => {
  const dispatch = useDispatch();
  const selectedId = useSelector(state => state.mixer.selectedChannelId);
  const channel = useSelector(state => state.mixer.channels.find(ch => ch.id === selectedId));

  if (!channel) return null; // Failsafe

  const handleEqChange = (band, param, value) => {
    const val = parseFloat(value);
    
    // 1. Update Redux Memory
    dispatch(updateChannelEq({ channelId: channel.id, band, param, value: val }));
    
    // 2. Push directly to C++ DSP Engine
    const engineChannel = audioEngine.getChannel(channel.id);
    if (engineChannel && typeof engineChannel.setEqBand === 'function') {
      engineChannel.setEqBand(band, param, val);
    }
  };

  // Helper to render the 3 sliders for each EQ band
  const renderBandControls = (band, label, color, minFreq, maxFreq) => {
    const data = channel.eq[band];
    return (
      <div style={{ flex: 1, padding: '15px', background: '#222', borderTop: `3px solid ${color}`, borderRadius: '4px' }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#fff', fontSize: '14px' }}>{label}</h4>
        
        {/* GAIN */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#888' }}>
            <span>GAIN</span> <span style={{ color }}>{data.gain > 0 ? `+${data.gain}` : data.gain} dB</span>
          </div>
          <input type="range" min="-15" max="15" step="0.5" value={data.gain} onChange={(e) => handleEqChange(band, 'gain', e.target.value)} style={{ width: '100%' }} />
        </div>

        {/* FREQ */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#888' }}>
            <span>FREQ</span> <span>{data.freq} Hz</span>
          </div>
          <input type="range" min={minFreq} max={maxFreq} step="10" value={data.freq} onChange={(e) => handleEqChange(band, 'freq', e.target.value)} style={{ width: '100%' }} />
        </div>

        {/* Q (Resonance) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#888' }}>
            <span>Q</span> <span>{data.q}</span>
          </div>
          <input type="range" min="0.1" max="10" step="0.1" value={data.q} onChange={(e) => handleEqChange(band, 'q', e.target.value)} style={{ width: '100%' }} />
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '20px', background: '#1a1a1c', borderBottom: '2px solid #333', display: 'flex', gap: '20px', flexShrink: 0 }}>
      
      {/* LEFT: Target Identification */}
      <div style={{ width: '150px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ background: '#17a2b8', color: '#000', padding: '10px', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>
          {channel.name}
        </div>
        <div style={{ color: '#888', fontSize: '12px', textAlign: 'center' }}>SELECTED CHANNEL</div>
      </div>

      {/* CENTER: The Master EQ Section */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <BigEQDisplay eq={channel.eq} />
        
        <div style={{ display: 'flex', gap: '10px' }}>
          {renderBandControls('low', 'LOW', '#2ecc71', 20, 200)}
          {renderBandControls('lowMid', 'L-MID', '#f1c40f', 100, 1000)}
          {renderBandControls('highMid', 'H-MID', '#e67e22', 500, 5000)}
          {renderBandControls('high', 'HIGH', '#e74c3c', 2000, 20000)}
        </div>
      </div>

    </div>
  );
};