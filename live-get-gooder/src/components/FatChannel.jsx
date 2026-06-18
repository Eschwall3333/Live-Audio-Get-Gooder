import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateChannelEq, updateParam, updateChannelSend } from '../store/mixerSlice';
import { audioEngine } from '../audio/AudioEngine';

// ==========================================
// 1. DYNAMIC SVG RENDERERS (Hardware Curves)
// ==========================================
const GateCurve = ({ thresh = -40, range = 40, active = false }) => {
  const tx = Math.max(0, Math.min(((thresh + 80) / 80) * 100, 100));
  const ty = 100 - tx;
  const rY = (range / 80) * 100;
  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
      <path d={`M 0 ${Math.min(100, ty + rY)} L ${tx} ${ty + rY} L ${tx} ${ty} L 100 0`} stroke={active ? '#0984e3' : '#666'} strokeWidth="2" fill="none" strokeLinejoin="round" />
    </svg>
  );
};

const CompCurve = ({ thresh = -10, ratio = 2.5, active = false }) => {
  const tx = Math.max(0, Math.min(((thresh + 60) / 60) * 100, 100));
  const ty = 100 - tx;
  const endY = ty - ((100 - tx) / Math.max(1, ratio));
  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
      <path d={`M 0 100 L ${tx} ${ty} L 100 ${endY}`} stroke={active ? '#0984e3' : '#666'} strokeWidth="2" fill="none" strokeLinejoin="round" />
    </svg>
  );
};

const EnvelopeGraph = ({ a = 10, h = 500, r = 900, isComp = false }) => {
  const aw = Math.max(2, (a / 120) * 25);
  const hw = Math.max(5, (h / 2000) * 35);
  const rw = Math.max(5, (r / 4000) * 30);
  const startY = isComp ? 20 : 90; const peakY = isComp ? 90 : 20;
  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
      <path d={`M 5 ${startY} L ${5+aw} ${peakY} L ${5+aw+hw} ${peakY} L ${5+aw+hw+rw} ${startY}`} stroke="#0984e3" strokeWidth="2" fill="rgba(9, 132, 227, 0.4)" strokeLinejoin="round" />
      <line x1={5+aw} y1="0" x2={5+aw} y2="100" stroke="#0984e3" strokeWidth="1" opacity="0.5" />
      <line x1={5+aw+hw} y1="0" x2={5+aw+hw} y2="100" stroke="#0984e3" strokeWidth="1" opacity="0.5" />
    </svg>
  );
};

const MiniEQCurve = ({ eq }) => {
  const bands = eq || { low: {}, lowMid: {}, highMid: {}, high: {} };
  const bandKeys = ['low', 'lowMid', 'highMid', 'high'];
  let path = "M 0 50 ";
  for (let x = 0; x <= 100; x += 2) {
    const f = Math.pow(10, Math.log10(20) + (x / 100) * (Math.log10(20000) - Math.log10(20)));
    let totalGain = 0;
    bandKeys.forEach(key => {
      const b = bands[key];
      if (b && b.freq) totalGain += (b.gain || 0) * Math.exp(-0.5 * Math.pow((b.q || 1) * Math.log2(f / b.freq), 2));
    });
    const y = 50 - (totalGain / 15) * 40;
    path += `L ${x} ${y} `;
  }
  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
      <path d={path} stroke="#0984e3" strokeWidth="2" fill="none" />
      <path d={`${path} L 100 50 L 0 50`} stroke="none" fill="rgba(9, 132, 227, 0.2)" />
      <line x1="0" y1="50" x2="100" y2="50" stroke="#333" strokeWidth="1" />
    </svg>
  );
};

// ==========================================
// 2. INTERACTIVE EQ ENGINE
// ==========================================
const BigEQDisplay = ({ channelId, eq, rtaEnabled, onBandChange }) => {
  const wrapperRef = useRef(null); const canvasRef = useRef(null);
  const requestRef = useRef(); const rtaData = useMemo(() => new Uint8Array(512), []);
  const bandColors = ['#1abc9c', '#3498db', '#e84393', '#e67e22'];
  const bandKeys = ['low', 'lowMid', 'highMid', 'high'];
  const [draggingBand, setDraggingBand] = useState(null);

  const getLogScaling = (width, height) => {
    const logMin = Math.log10(20); const logMax = Math.log10(20000);
    const getX = (freq) => ((Math.log10(freq) - logMin) / (logMax - logMin)) * width;
    const getFreq = (x) => Math.pow(10, logMin + (x / width) * (logMax - logMin));
    const getY = (gain) => (height / 2) - (gain / 15) * (height / 2 - 10);
    const getGain = (y) => ((height / 2 - y) / (height / 2 - 10)) * 15;
    return { getX, getY, getFreq, getGain };
  };

  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left; const y = e.clientY - rect.top;
    const { getX, getY } = getLogScaling(canvasRef.current.width, canvasRef.current.height);
    let closestBand = null; let minDistance = 20;
    bandKeys.forEach((key) => {
      const b = eq[key];
      if (b && b.freq) {
        const dist = Math.hypot(getX(b.freq) - x, getY(b.gain || 0) - y);
        if (dist < minDistance) { closestBand = key; minDistance = dist; }
      }
    });
    if (closestBand) setDraggingBand(closestBand);
  };

  const handleMouseMove = (e) => {
    if (!draggingBand) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, canvasRef.current.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, canvasRef.current.height));
    const { getFreq, getGain } = getLogScaling(canvasRef.current.width, canvasRef.current.height);
    onBandChange(draggingBand, 'freq', Math.max(20, Math.min(20000, Math.round(getFreq(x)))));
    onBandChange(draggingBand, 'gain', Math.max(-15, Math.min(15, Math.round(getGain(y) * 10) / 10)));
  };

  const handleMouseUp = () => setDraggingBand(null);

  useEffect(() => {
    const wrapper = wrapperRef.current; const canvas = canvasRef.current;
    if (!wrapper || !canvas) return; const ctx = canvas.getContext('2d');

    const drawLoop = () => {
      const width = wrapper.clientWidth; const height = wrapper.clientHeight;
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      
      const { getX, getY, getFreq } = getLogScaling(width, height);

      ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#222'; ctx.lineWidth = 1;
      [100, 1000, 10000].forEach(f => { const x = getX(f); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); });
      ctx.strokeStyle = '#444'; ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();

      if (rtaEnabled && audioEngine.ctx) {
        try {
          const engineChannel = audioEngine.getChannel(channelId);
          if (engineChannel) {
            engineChannel.getFrequencyData(rtaData);
            const nyquist = audioEngine.ctx.sampleRate / 2 || 24000;
            ctx.fillStyle = 'rgba(26, 188, 156, 0.2)'; ctx.beginPath(); ctx.moveTo(0, height);
            for (let i = 0; i < rtaData.length; i++) {
              const freq = i * (nyquist / rtaData.length);
              if (freq < 20) continue; if (freq > 20000) break;
              ctx.lineTo(getX(freq), height - (rtaData[i] / 255) * height);
            }
            ctx.lineTo(width, height); ctx.fill();
          }
        } catch(e) { }
      }

      const bands = eq || { low: {}, lowMid: {}, highMid: {}, high: {} };
      
      ctx.beginPath();
      for (let x = 0; x <= width; x += 2) {
        let totalGain = 0;
        bandKeys.forEach(key => {
          const b = bands[key];
          if (b && b.freq) totalGain += (b.gain || 0) * Math.exp(-0.5 * Math.pow((b.q || 1) * Math.log2(getFreq(x) / b.freq), 2));
        });
        if (x === 0) ctx.moveTo(x, getY(totalGain)); else ctx.lineTo(x, getY(totalGain));
      }
      ctx.lineTo(width, height / 2); ctx.lineTo(0, height / 2);
      ctx.fillStyle = 'rgba(52, 152, 219, 0.3)'; ctx.fill();
      
      ctx.beginPath();
      for (let x = 0; x <= width; x += 2) {
        let totalGain = 0;
        bandKeys.forEach(key => {
          const b = bands[key];
          if (b && b.freq) totalGain += (b.gain || 0) * Math.exp(-0.5 * Math.pow((b.q || 1) * Math.log2(getFreq(x) / b.freq), 2));
        });
        if (x === 0) ctx.moveTo(x, getY(totalGain)); else ctx.lineTo(x, getY(totalGain));
      }
      ctx.strokeStyle = '#3498db'; ctx.lineWidth = 2; ctx.stroke();

      bandKeys.forEach((key, idx) => {
        const b = bands[key];
        if (b && b.freq) { 
          ctx.beginPath(); ctx.arc(getX(b.freq), getY(b.gain || 0), 12, 0, Math.PI * 2); 
          ctx.strokeStyle = bandColors[idx]; ctx.lineWidth = 3; ctx.stroke(); 
        }
      });
      requestRef.current = requestAnimationFrame(drawLoop);
    };
    requestRef.current = requestAnimationFrame(drawLoop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [eq, rtaEnabled, channelId]);

  return (
    <div ref={wrapperRef} style={{ flex: 1, minHeight: '180px', width: '100%', background: '#000', border: '1px solid #333', overflow: 'hidden', cursor: draggingBand ? 'grabbing' : 'crosshair' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} />
    </div>
  );
};

// ==========================================
// 3. THE MASTER CONTROL SCREEN (M32 STYLE)
// ==========================================
export const FatChannel = ({ activeTab }) => {
  const dispatch = useDispatch();
  const selectedId = useSelector(state => state.mixer.selectedChannelId);
  const channel = useSelector(state => state.mixer.channels.find(ch => ch.id === selectedId));
  const [rtaEnabled, setRtaEnabled] = useState(false);
  const [uiState, setUiState] = useState({ polarity: false, delayOn: false, eqOn: true, lrmc: 'LR' });

  if (!channel) return null;

  // SAFE DATA EXTRACTION
  const eq = channel.eq || { low: {}, lowMid: {}, highMid: {}, high: {} };
  const gate = channel.dynamics || {};
  const comp = channel.comp || {};
  
  const gActive = gate.gateOn || false; const gThresh = gate.gateThreshold ?? -40; const gRange = gate.range ?? 40;
  const gAttack = gate.attack ?? 8; const gHold = gate.hold ?? 500; const gRelease = gate.release ?? 900;
  const gType = gate.type ?? 3.0; const gFreq = gate.freq ?? 990.9;
  
  const cActive = comp.compOn || false; const cThresh = comp.threshold ?? -10; const cRatio = comp.ratio ?? 2.5; 
  const cMix = comp.mix ?? 100; const cGain = comp.makeupGain ?? 0; const cAttack = comp.attack ?? 10; 
  const cHold = comp.hold ?? 50; const cRelease = comp.release ?? 150; const cType = comp.type ?? 3.0; 
  const cFreq = comp.freq ?? 990.9; const cKnee = comp.knee ?? 1;

  const toggleUi = (key) => setUiState(prev => ({ ...prev, [key]: !prev[key] }));

  const handleEqChange = (band, param, value) => {
    const val = param === 'mode' ? value : parseFloat(value);
    dispatch(updateChannelEq({ channelId: channel.id, band, param, value: val }));
    if (audioEngine.ctx && param !== 'mode') {
      try { const engineChannel = audioEngine.getChannel(channel.id); if (engineChannel && typeof engineChannel.setEqBand === 'function') engineChannel.setEqBand(band, param, val); } catch (err) { }
    }
  };

  const handleGate = (param, val) => {
    const parsed = typeof val === 'boolean' || isNaN(val) ? val : parseFloat(val);
    dispatch(updateParam({ channelId: channel.id, key: 'dynamics', value: { ...gate, [param]: parsed } }));
  };

  const handleComp = (param, val) => {
    const parsed = typeof val === 'boolean' || isNaN(val) ? val : parseFloat(val);
    dispatch(updateParam({ channelId: channel.id, key: 'comp', value: { ...comp, [param]: parsed } }));
  };

  const handlePan = (e) => {
    const val = parseFloat(e.target.value);
    dispatch(updateParam({ channelId: channel.id, key: 'pan', value: val }));
    if (audioEngine.ctx) {
      try { const engineChannel = audioEngine.getChannel(channel.id); if (engineChannel && typeof engineChannel.setPan === 'function') engineChannel.setPan(val); } catch(err) {}
    }
  };

  const handleTrim = (e) => dispatch(updateParam({ channelId: channel.id, key: 'trim', value: parseFloat(e.target.value) || 0 }));

  const handleSourceChange = (e) => {
    const sourceId = parseInt(e.target.value, 10);
    dispatch(updateParam({ channelId: channel.id, key: 'source', value: sourceId }));
    if (audioEngine.ctx) {
      try {
        if (typeof audioEngine.routeInputToChannel === 'function') {
          audioEngine.routeInputToChannel(sourceId, channel.id);
        }
      } catch(err) { console.error("Patchbay routing error:", err); }
    }
  };

  const handleSendChange = (busIndex, val) => {
    const db = parseFloat(val);
    dispatch(updateChannelSend({ channelId: channel.id, busIndex, value: db }));
    if (audioEngine.ctx) {
      try {
        const engineChannel = audioEngine.getChannel(channel.id);
        if (engineChannel && typeof engineChannel.setSendLevel === 'function') {
          engineChannel.setSendLevel(busIndex, db);
        }
      } catch(e) {}
    }
  };

  // --- TAB COMPONENT: SENDS ---
  const renderSendsTab = () => {
    const routingOptions = ['Input', 'Pre EQ', 'Post EQ', 'Pre Fader', 'Post Fader', 'Sub Group'];
    const activeRoutes = ['Pre Fader', 'Post Fader', 'Post Fader', 'Post Fader', 'Post Fader', 'Post Fader', 'Post Fader', 'Post Fader'];
    
    const busData = [
      { name: 'DJBooth L', color: '#fff', isLinked: true }, { name: 'DJBooth R', color: '#fff', isLinked: true },
      { name: 'TD L', color: '#e74c3c', isLinked: true }, { name: 'TD R', color: '#e74c3c', isLinked: true },
      { name: 'Outfill', color: '#3498db', isLinked: false }, { name: 'DJ SUB L', color: '#0984e3', isLinked: true },
      { name: 'DJ SUB R', color: '#0984e3', isLinked: true }, { name: 'SUB', color: '#fff', isLinked: false },
      { name: 'IEM 1', color: '#1abc9c', isLinked: false }, { name: 'IEM 2', color: '#1abc9c', isLinked: false },
      { name: 'IEM 3', color: '#1abc9c', isLinked: false }, { name: 'Bus 12', color: '#555', isLinked: false },
      { name: 'Reverb', color: '#e056fd', isLinked: false }, { name: 'Fx 2', color: '#e056fd', isLinked: false },
      { name: 'Delay', color: '#e056fd', isLinked: false }, { name: 'Fx 4', color: '#e056fd', isLinked: false }
    ];

    return (
      <div style={{ display: 'flex', height: '100%', padding: '15px 10px', color: '#eee', minWidth: '950px', overflowX: 'auto', fontFamily: 'sans-serif' }}>
        <div style={{ width: '85px', display: 'flex', flexDirection: 'column', flexShrink: 0, paddingRight: '10px' }}>
          <div style={{ height: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '11px', color: '#aaa', textAlign: 'right' }}>
            {routingOptions.map(opt => <div key={opt} style={{ height: '14px', lineHeight: '14px' }}>{opt}</div>)}
          </div>
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid #888', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '18px' }}>🌐</div>
            <div style={{ fontSize: '9px', color: '#ccc', textAlign: 'center', marginTop: '5px', lineHeight: '1.2' }}>Changes<br/>affect<br/>selected<br/>Channel</div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex' }}>
          {channel.sends.map((val, i) => {
            const pairIdx = Math.floor(i / 2); const isEven = i % 2 === 0; const route = activeRoutes[pairIdx];
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '45px', borderRight: isEven ? 'none' : '1px solid #222' }}>
                <div style={{ height: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  {routingOptions.map(opt => (<div key={opt} style={{ height: '14px', display: 'flex', alignItems: 'center' }}><input type="radio" checked={route === opt} readOnly style={{ margin: 0, width: '12px', height: '12px', accentColor: '#0984e3' }} /></div>))}
                </div>
                <div style={{ width: '92%', border: `1px solid ${busData[i].color}`, color: busData[i].color, background: '#000', fontSize: '9px', fontWeight: 'bold', textAlign: 'center', padding: '3px 0', whiteSpace: 'nowrap', overflow: 'hidden', marginTop: '10px' }}>{busData[i].name}</div>
                <div style={{ display: 'flex', alignItems: 'center', height: '24px', gap: '2px', marginTop: '4px', width: '100%', justifyContent: 'center' }}>
                  <button style={{ background: 'transparent', border: 'none', color: '#0984e3', cursor: 'pointer', fontSize: '14px', padding: 0 }}>⏻</button>
                  {busData[i].isLinked && isEven && (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                       <div style={{ width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: '8px solid #3498db' }}></div>
                       <div style={{ border: '1px solid #555', fontSize: '5px', color: '#aaa', padding: '1px', borderRadius: '2px', marginLeft: '1px' }}>LR<br/>PAN</div>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#ccc', margin: '4px 0 8px 0' }}>{val <= -60 ? '-oo' : val.toFixed(1)}</div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '2px', height: '140px', width: '100%' }}>
                  {isEven && (<div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '7px', color: '#555', textAlign: 'right', paddingRight: '2px' }}><span>10</span><span>0</span><span>-10</span><span>-20</span><span>-30</span><span>-oo</span></div>)}
                  <input type="range" min="-60" max="10" step="0.5" value={val} onChange={(e) => handleSendChange(i, e.target.value)} onDoubleClick={() => handleSendChange(i, -80)} style={{ height: '100%', width: '16px', writingMode: 'vertical-lr', direction: 'rtl', accentColor: '#555', cursor: 'grab' }} />
                  {!isEven && (<div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '7px', color: '#555', textAlign: 'left', paddingLeft: '2px' }}><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span></div>)}
                </div>
                <div style={{ fontSize: '10px', color: '#aaa', marginTop: '8px', fontWeight: 'bold' }}>Bus {i+1}</div>
              </div>
            );
          })}
        </div>

        <div style={{ width: '80px', display: 'flex', flexDirection: 'column', flexShrink: 0, paddingLeft: '10px' }}>
          <div style={{ height: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '11px', color: '#aaa', textAlign: 'left' }}>
            {routingOptions.map(opt => <div key={opt} style={{ height: '14px', lineHeight: '14px' }}>{opt}</div>)}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', paddingBottom: '30px', fontSize: '10px', color: '#ccc' }}>dB</div>
        </div>
      </div>
    );
  };

  // --- TAB COMPONENT: EQ ---
  const renderEQTab = () => {
    const bandColors = ['#1abc9c', '#3498db', '#e84393', '#e67e22'];
    const bandLabels = ['Low', 'LoMid', 'HiMid', 'High'];
    const bandKeys = ['low', 'lowMid', 'highMid', 'high'];

    const NumberInput = ({ label, value, unit, step, min, max, onChange, color }) => (
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
        <div style={{ width: '35px', textAlign: 'right', marginRight: '8px', color: '#ccc', fontSize: '11px' }}>{label}</div>
        <div style={{ flex: 1, display: 'flex', background: '#000', border: '1px solid #333' }}>
          <input type="number" step={step} min={min} max={max} value={value} onChange={(e) => onChange(e.target.value)} onDoubleClick={() => onChange(label === 'Gain' ? 0 : value)} style={{ width: '100%', background: 'transparent', border: 'none', color: color, padding: '2px', fontSize: '11px', textAlign: 'right', outline: 'none', MozAppearance: 'textfield', WebkitAppearance: 'none', margin: 0 }} />
          <span style={{ color: '#fff', fontSize: '11px', padding: '2px 4px 2px 2px', width: '20px', textAlign: 'left' }}>{unit}</span>
        </div>
      </div>
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px' }}>
        <BigEQDisplay channelId={channel.id} eq={eq} rtaEnabled={rtaEnabled} onBandChange={handleEqChange} />
        <div style={{ display: 'flex', gap: '8px', height: '140px', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', minWidth: '90px' }}>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button onClick={() => toggleUi('eqOn')} style={{ ...(uiState.eqOn ? powerBtnOn : powerBtnOff), flex: 1, padding: '4px' }}>EQ</button>
              <button style={{ ...powerBtnOff, flex: 1, padding: '4px', background: '#444' }}>RESET</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '15px' }}>
              <div style={{ width: '30px', height: '30px', background: '#1abc9c', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg viewBox="0 0 24 24" width="20" height="20" stroke="#000" strokeWidth="2" fill="none"><path d="M 4 20 L 10 20 L 16 4 L 22 4" /></svg></div>
              <div style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '5px', color: '#fff' }}>20 Hz</div>
              <div style={{ fontSize: '10px', color: '#888' }}>Low Cut</div>
            </div>
          </div>
          <div style={{ display: 'flex', flex: 1, gap: '4px' }}>
            {bandKeys.map((band, idx) => {
              const data = channel.eq[band]; const c = bandColors[idx];
              const mode = data?.mode || (idx === 0 ? 'LShv' : idx === 3 ? 'HShv' : 'PEQ');
              return (
                <div key={band} style={{ flex: 1, background: '#111', border: '1px solid #333', padding: '6px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `2px solid ${c}`, paddingBottom: '4px', marginBottom: '8px' }}>
                    <span style={{ color: c, fontSize: '12px', fontWeight: 'bold', border: `1px solid ${c}`, padding: '2px 8px', borderRadius: '2px' }}>{bandLabels[idx]}</span>
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="#0984e3" strokeWidth="2" fill="none"><path d="M 12 2 L 12 12 M 7 6 A 8 8 0 1 0 17 6"/></svg>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ width: '35px', textAlign: 'right', marginRight: '8px', color: '#ccc', fontSize: '11px' }}>Mode</div>
                    <select value={mode} onChange={(e) => handleEqChange(band, 'mode', e.target.value)} style={{ flex: 1, background: '#000', border: '1px solid #333', color: '#fff', padding: '2px', fontSize: '11px', outline: 'none' }}>
                      <option value="LCut">LCut</option><option value="LShv">LShv</option><option value="PEQ">PEQ</option><option value="VEQ">VEQ</option><option value="HShv">HShv</option><option value="HCut">HCut</option>
                    </select>
                  </div>
                  <NumberInput label="Gain" value={data?.gain ?? 0} unit="dB" step="0.5" min="-15" max="15" onChange={(val) => handleEqChange(band, 'gain', val)} color="#0984e3" />
                  <NumberInput label="Freq" value={data?.freq ?? 100} unit="Hz" step="10" min="20" max="20000" onChange={(val) => handleEqChange(band, 'freq', val)} color="#0984e3" />
                  <NumberInput label="Qual" value={data?.q ?? 1} unit="" step="0.1" min="0.1" max="10" onChange={(val) => handleEqChange(band, 'q', val)} color="#0984e3" />
                </div>
              );
            })}
          </div>
          <div style={{ minWidth: '100px', display: 'flex', flexDirection: 'column', padding: '5px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '5px' }}>
              <button onClick={() => setRtaEnabled(!rtaEnabled)} style={{ ...powerBtnOff, background: rtaEnabled ? '#0984e3' : '#222', color: '#fff', border: '1px solid #444', padding: '4px 12px' }}>RTA</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', fontSize: '10px', color: '#ccc' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><input type="checkbox" style={{ margin: 0, accentColor: '#0984e3' }} /> Pre</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><input type="checkbox" style={{ margin: 0, accentColor: '#0984e3' }} /> Spec</label>
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {['Gain:', 'Frequency:', 'Quality:'].map(lbl => (
                <div key={lbl} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '5px', fontSize: '10px', color: '#888' }}>
                  <span>{lbl}</span><div style={{ width: '35px', height: '10px', background: '#1abc9c' }}></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- TAB COMPONENT: CHANNEL HOME ---
  const renderChannelTab = () => (
    <div style={{ display: 'flex', gap: '4px', height: '100%', overflowX: 'auto' }}>
      <div className="m32-col" style={colStyle}>
        <div style={headerStyle}>Channel Input</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '10px' }}><div style={{ width: '20px', height: '20px', background: '#e67e22', color: '#000', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '2px', fontSize: '10px' }}>L</div><span style={{ fontSize: '11px', color: '#ccc' }}>Stereo Link</span></div>
        <div style={{ padding: '0 10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div onClick={() => toggleUi('polarity')} style={{...iconBtn, background: uiState.polarity ? '#e67e22' : '#222', color: uiState.polarity ? '#000' : '#888'}}>Ø</div><span style={{fontSize: '11px', color: '#ccc'}}>Polarity</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div onClick={() => toggleUi('delayOn')} style={{...iconBtn, background: uiState.delayOn ? '#0984e3' : '#222', color: uiState.delayOn ? '#fff' : '#888'}}>Δt</div><span style={{fontSize: '11px', color: '#ccc'}}>Delay</span></div>
        </div>
        <div style={{ flex: 1, display: 'flex', marginTop: '15px', padding: '0 10px', gap: '15px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
            <input type="range" min="-18" max="18" step="0.5" value={channel.trim || 0} onChange={handleTrim} onDoubleClick={() => handleTrim({target: {value: 0}})} style={{ height: '100px', width: '20px', writingMode: 'vertical-lr', direction: 'rtl', accentColor: '#0984e3' }} />
            <div style={{ fontSize: '10px', color: '#ccc', marginTop: '5px' }}>Trim</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
             <select style={{ background: '#111', color: '#fff', border: '1px solid #333', fontSize: '10px', width: '50px' }}><option>OFF</option></select>
             <div style={{ fontSize: '10px', color: '#888' }}>Insert<br/><span style={{background: '#17a2b8', color: '#000', padding: '2px 4px', borderRadius: '2px'}}>PRE</span></div>
             <div style={{ fontSize: '10px', color: '#888' }}>Dyn.<br/><span style={{background: '#333', color: '#666', padding: '2px 4px', borderRadius: '2px'}}>PRE</span></div>
          </div>
        </div>
      </div>
      <div className="m32-col" style={colStyle}>
        <div style={headerStyle}>Noise Gate</div>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '5px' }}><button onClick={() => handleGate('gateOn', !gActive)} style={gActive ? powerBtnOn : powerBtnOff}>Gate</button></div>
        <div style={graphBox}><GateCurve thresh={gThresh} range={gRange} active={gActive} /></div>
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '10px', height: '100px' }}>
           <input type="range" min="-80" max="0" value={gThresh} onChange={(e) => handleGate('gateThreshold', e.target.value)} onDoubleClick={() => handleGate('gateThreshold', -40)} style={{ height: '100%', width: '20px', writingMode: 'vertical-lr', direction: 'rtl', accentColor: '#555' }} />
           <div style={{ width: '10px', background: '#0a0a0c', border: '1px solid #222' }}></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '10px', color: '#888' }}><span>Threshold</span><span>GR</span></div>
      </div>
      <div className="m32-col" style={colStyle}>
        <div style={headerStyle}>Equalizer</div>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '5px' }}><button onClick={() => toggleUi('eqOn')} style={uiState.eqOn ? powerBtnOn : powerBtnOff}>EQ</button></div>
        <div style={{ ...graphBox, borderColor: '#0984e3' }}>
          <MiniEQCurve eq={eq} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px' }}><div style={{ width: '15px', height: '15px', background: '#17a2b8' }}></div><span style={{ fontSize: '11px', color: '#ccc' }}>Low Cut</span></div>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '5px', height: '80px' }}><input type="range" min="20" max="400" value={eq.low?.freq ?? 20} onChange={(e) => handleEqChange('low', 'freq', e.target.value)} onDoubleClick={() => handleEqChange('low', 'freq', 20)} style={{ height: '100%', width: '20px', writingMode: 'vertical-lr', direction: 'rtl', accentColor: '#555' }} /></div>
        <div style={{ textAlign: 'center', fontSize: '10px', color: '#888' }}>Frequency</div>
      </div>
      <div className="m32-col" style={colStyle}>
        <div style={headerStyle}>Dynamics</div>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '5px' }}><button onClick={() => handleComp('compOn', !cActive)} style={cActive ? powerBtnOn : powerBtnOff}>Comp</button></div>
        <div style={graphBox}><CompCurve thresh={cThresh} ratio={cRatio} active={cActive} /></div>
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '10px', height: '100px' }}>
           <input type="range" min="-60" max="0" value={cThresh} onChange={(e) => handleComp('threshold', e.target.value)} onDoubleClick={() => handleComp('threshold', -10)} style={{ height: '100%', width: '20px', writingMode: 'vertical-lr', direction: 'rtl', accentColor: '#555' }} />
           <div style={{ width: '10px', background: '#0a0a0c', border: '1px solid #222' }}></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '10px', color: '#888' }}><span>Threshold</span><span>GR</span></div>
      </div>
      <div className="m32-col" style={{ ...colStyle, minWidth: '140px' }}>
        <div style={headerStyle}>Main Out</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px' }}><button style={{ background: '#e67e22', color: '#000', border: 'none', padding: '2px 4px', fontWeight: 'bold', borderRadius: '2px' }}>LR</button><span style={{ fontSize: '11px', color: '#ccc' }}>Main Stereo</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px' }}><button style={{ background: '#333', color: '#666', border: 'none', padding: '2px 4px', fontWeight: 'bold', borderRadius: '2px' }}>M/C</button><span style={{ fontSize: '11px', color: '#ccc' }}>Mono/Center</span></div>
        <div style={{ padding: '10px' }}><input type="range" min="-100" max="100" value={channel.pan} onChange={handlePan} onDoubleClick={() => handlePan({target: {value: 0}})} style={{ width: '100%', accentColor: '#0984e3' }} /><div style={{ textAlign: 'right', fontSize: '10px', color: '#ccc' }}>{channel.pan}</div></div>
        <div style={{ padding: '0 10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
           <div><div style={{ fontSize: '10px', color: '#ccc', fontWeight: 'bold', marginBottom: '5px' }}>DCA Groups</div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>{[1,2,3,4,5,6,7,8].map(i => <div key={i} style={dcaCircle}>{i}</div>)}</div></div>
           <div><div style={{ fontSize: '10px', color: '#ccc', fontWeight: 'bold', marginBottom: '5px' }}>Mute Groups</div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>{[1,2,3,4,5,6].map(i => <div key={i} style={muteSquare}>{i}</div>)}</div></div>
        </div>
      </div>
      <div className="m32-col" style={{ ...colStyle, flex: 2, minWidth: '150px' }}>
        <div style={headerStyle}>Bus Sends</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '10px' }}>
           {[ { id: 1, c: '#555', w: '40%' }, { id: 2, c: '#0984e3', w: '60%' }, { id: 3, c: '#e74c3c', w: '70%' }, { id: 4, c: '#0984e3', w: '50%' }, { id: 5, c: '#0984e3', w: '80%' }, { id: 6, c: '#333', w: '0%' }, { id: 7, c: '#555', w: '30%' }, { id: 8, c: '#fff', w: '50%' } ].map(bus => (
             <div key={bus.id} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '15px', fontSize: '9px', color: '#888', textAlign: 'right' }}>{bus.id}</div><div style={{ flex: 1, background: '#0a0a0c', border: '1px solid #333', height: '12px', display: 'flex' }}><div style={{ width: bus.w, background: bus.c, height: '100%' }}></div></div></div>
           ))}
           {[9,10,11,12,13,14,15,16].map(i => (
             <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '15px', fontSize: '9px', color: '#888', textAlign: 'right' }}>{i}</div><div style={{ flex: 1, background: '#0a0a0c', border: '1px solid #333', height: '12px' }}></div></div>
           ))}
        </div>
      </div>
    </div>
  );

  // --- TAB COMPONENT: CONFIG ---
  const renderConfigTab = () => {
    const sourceOptions = Array.from({ length: 32 }, (_, i) => {
      const num = (i + 1).toString().padStart(2, '0');
      return `${num} : IN${num}`;
    });

    const currentSource = channel.source || `${channel.id.toString().padStart(2, '0')} : IN${channel.id.toString().padStart(2, '0')}`;

    return (
      <div style={{ display: 'flex', height: '100%', padding: '20px', gap: '40px', color: '#eee' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', marginTop: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ width: '24px', height: '24px', background: '#f1c40f', color: '#000', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '2px', fontSize: '12px' }}>L</div><span style={{ fontSize: '12px', fontWeight: 'bold' }}>Stereo Link</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div onClick={() => toggleUi('polarity')} style={{...iconBtn, background: uiState.polarity ? '#e67e22' : 'transparent', color: uiState.polarity ? '#000' : '#888'}}>Ø</div><span style={{ fontSize: '12px', fontWeight: 'bold' }}>Polarity</span></div>
        </div>
        
        {/* NEW: Input Source Router */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold' }}>Source</div>
          <select value={currentSource} onChange={handleSourceChange} style={{ background: '#111', color: '#fff', border: '1px solid #333', padding: '4px', fontSize: '12px', width: '100px', textAlign: 'center', outline: 'none' }}>
            {sourceOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          
          <div style={{ fontSize: '12px', marginTop: '10px' }}>{(channel.trim || 0).toFixed(1)} dB</div>
          <div style={{ display: 'flex', gap: '10px', height: '120px', alignItems: 'center' }}>
             <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', fontSize: '9px', color: '#888', textAlign: 'right' }}><span>18</span><span>12</span><span>+6</span><span></span><span>-6</span><span>-12</span><span>-18</span></div>
             <input type="range" min="-18" max="18" step="0.5" value={channel.trim || 0} onChange={handleTrim} onDoubleClick={() => handleTrim({target: {value: 0}})} style={{ height: '100%', width: '20px', writingMode: 'vertical-lr', direction: 'rtl', accentColor: '#0984e3' }} />
          </div>
          <div style={{ fontSize: '11px', color: '#aaa', marginTop: '5px' }}>Trim</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold' }}>Low Cut</div>
          <button style={{ width: '30px', height: '30px', background: '#17a2b8', border: 'none', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg viewBox="0 0 24 24" width="16" height="16" stroke="#000" strokeWidth="2" fill="none"><path d="M 4 20 L 10 20 L 16 4 L 22 4" /></svg></button>
          <div style={{ fontSize: '12px', marginTop: '10px' }}>{eq.low?.freq ?? 20} Hz</div>
          <div style={{ display: 'flex', gap: '10px', height: '120px', alignItems: 'center' }}>
             <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', fontSize: '9px', color: '#888', textAlign: 'right' }}><span>230 Hz</span><span>140 Hz</span><span>90 Hz</span><span>60 Hz</span><span>40 Hz</span><span>20 Hz</span></div>
             <input type="range" min="20" max="400" value={eq.low?.freq ?? 20} onChange={(e) => handleEqChange('low', 'freq', e.target.value)} onDoubleClick={() => handleEqChange('low', 'freq', 20)} style={{ height: '100%', width: '20px', writingMode: 'vertical-lr', direction: 'rtl', accentColor: '#555' }} />
          </div>
          <div style={{ fontSize: '11px', color: '#aaa', marginTop: '5px' }}>Frequency</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold' }}>Delay</div>
          <button onClick={() => toggleUi('delayOn')} style={{ ...iconBtn, width: '30px', height: '30px', background: uiState.delayOn ? '#0984e3' : '#222', color: uiState.delayOn ? '#fff' : '#888' }}>Δt</button>
          <div style={{ fontSize: '10px', marginTop: '10px', textAlign: 'center', color: '#ccc', lineHeight: '1.4' }}>0.3 ft<br/>0.10 m<br/>0.3 ms</div>
          <div style={{ display: 'flex', gap: '10px', height: '120px', alignItems: 'center' }}><input type="range" min="0" max="500" defaultValue="0.3" style={{ height: '100%', width: '20px', writingMode: 'vertical-lr', direction: 'rtl', accentColor: '#555' }} /></div>
          <div style={{ fontSize: '11px', color: '#aaa', marginTop: '5px' }}>Delay</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginLeft: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', textAlign: 'center' }}>Insert Position</div>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
             <div style={insertBlock}><span style={{fontSize:'10px'}}>Δt</span></div>
             <div style={insertBlock}><svg viewBox="0 0 24 24" width="16" height="16" stroke="#888" strokeWidth="2" fill="none"><path d="M 4 20 L 10 20 L 16 4 L 22 4"/></svg></div>
             <div style={insertBlock}><svg viewBox="0 0 24 24" width="16" height="16" stroke="#888" strokeWidth="2" fill="none"><path d="M 4 20 L 10 10 L 20 5"/></svg></div>
             <div style={{...insertBlock, borderColor: '#0984e3', position: 'relative'}}>
               <svg viewBox="0 0 24 24" width="16" height="16" stroke="#0984e3" strokeWidth="2" fill="none"><path d="M 2 12 Q 8 2 12 12 T 22 12"/></svg>
               <div style={{ position: 'absolute', bottom: '-15px', color: '#0984e3', fontSize: '14px' }}>↑</div>
             </div>
             <div style={insertBlock}><svg viewBox="0 0 24 24" width="16" height="16" stroke="#888" strokeWidth="2" fill="none"><path d="M 4 20 L 10 10 L 20 5"/></svg></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
             <div style={{ background: '#333', color: '#888', padding: '4px', borderRadius: '2px', fontSize: '10px', fontWeight: 'bold' }}>FX</div>
             <select style={{ background: '#111', color: '#fff', border: '1px solid #333', padding: '6px', fontSize: '12px', flex: 1 }}><option>OFF</option></select>
             <button style={{ background: '#17a2b8', color: '#000', border: 'none', padding: '6px 10px', borderRadius: '2px', fontSize: '10px', fontWeight: 'bold' }}>PRE</button>
          </div>
        </div>
      </div>
    );
  };

  // --- TAB COMPONENT: GATE ---
  const renderGateTab = () => {
    return (
      <div style={{ display: 'flex', height: '100%', padding: '20px', gap: '40px', color: '#eee' }}>
        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ marginTop: '30px' }}><button onClick={() => handleGate('gateOn', !gActive)} style={{ padding: '8px 20px', background: gActive ? '#0984e3' : '#333', color: gActive ? '#fff' : '#ccc', border: '1px solid #555', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Active</button></div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '10px' }}>Gain</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ width: '150px', height: '100px', background: '#0a0a0c', border: '1px solid #333' }}>
                <GateCurve thresh={gThresh} range={gRange} active={gActive} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '5px', fontSize: '11px', color: '#ccc' }}>
                {['Exp 2:1', 'Exp 3:1', 'Exp 4:1', 'Gate', 'Ducker'].map(mode => (
                  <label key={mode} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}><input type="radio" name="gateMode" defaultChecked={mode === 'Gate'} style={{ accentColor: '#0984e3' }} /> {mode}</label>
                ))}
                <div style={{ marginTop: '5px', textAlign: 'center', fontWeight: 'bold' }}>Mode</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '15px', marginTop: '20px', height: '140px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '10px' }}>{gThresh.toFixed(1)} dB</div>
                <div style={{ display: 'flex', gap: '10px', height: '100%' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '9px', color: '#888', textAlign: 'right' }}><span>-10</span><span>-20</span><span>-30</span><span>-40</span><span>-50</span><span>-60</span><span>-70</span><span>-80</span></div>
                  <input type="range" min="-80" max="0" value={gThresh} onChange={(e) => handleGate('gateThreshold', e.target.value)} onDoubleClick={() => handleGate('gateThreshold', -40)} style={{ height: '100%', width: '20px', writingMode: 'vertical-lr', direction: 'rtl', accentColor: '#555' }} />
                </div>
                <div style={{ fontSize: '11px', color: '#aaa', marginTop: '5px' }}>Threshold</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '10px', visibility: 'hidden' }}>0 dB</div>
                <div style={{ display: 'flex', gap: '10px', height: '100%' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '9px', color: '#888', textAlign: 'right' }}><span>10</span><span>20</span><span>30</span><span>40</span><span>50</span><span>60</span></div>
                  <div style={{ height: '100%', width: '20px', background: '#0a0a0c', border: '1px solid #333' }}></div>
                </div>
                <div style={{ fontSize: '11px', color: '#aaa', marginTop: '5px' }}>GR</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '10px' }}>{gRange.toFixed(1)} dB</div>
                <div style={{ display: 'flex', gap: '10px', height: '100%' }}>
                  <input type="range" min="0" max="60" value={gRange} onChange={(e) => handleGate('range', e.target.value)} onDoubleClick={() => handleGate('range', 40)} style={{ height: '100%', width: '20px', writingMode: 'vertical-lr', direction: 'rtl', accentColor: '#0984e3' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '9px', color: '#888', textAlign: 'left' }}><span>60</span><span>50</span><span>40</span><span>30</span><span>20</span><span>10</span><span>0</span></div>
                </div>
                <div style={{ fontSize: '11px', color: '#aaa', marginTop: '5px' }}>Range</div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '10px' }}>Gain Envelope</div>
          <div style={{ width: '180px', height: '100px', background: '#0a0a0c', border: '1px solid #333', position: 'relative' }}>
            <EnvelopeGraph a={gAttack} h={gHold} r={gRelease} isComp={false} />
          </div>
          <div style={{ display: 'flex', gap: '20px', marginTop: '20px', height: '140px' }}>
            {[{ label: 'Attack', val: gAttack, min: 0, max: 120, unit: 'ms' }, { label: 'Hold', val: gHold, min: 0, max: 2000, unit: 'ms' }, { label: 'Release', val: gRelease, min: 5, max: 4000, unit: 'ms' }].map(ctrl => (
              <div key={ctrl.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '10px' }}>{ctrl.val} {ctrl.unit}</div>
                <input type="range" min={ctrl.min} max={ctrl.max} value={ctrl.val} onChange={(e) => handleGate(ctrl.label.toLowerCase(), e.target.value)} onDoubleClick={() => handleGate(ctrl.label.toLowerCase(), ctrl.min + (ctrl.max - ctrl.min) / 2)} style={{ height: '100%', width: '20px', writingMode: 'vertical-lr', direction: 'rtl', accentColor: '#0984e3' }} />
                <div style={{ fontSize: '11px', color: '#aaa', marginTop: '5px' }}>{ctrl.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '10px' }}>Side Chain Filter</div>
          <div style={{ width: '180px', height: '100px', background: '#0a0a0c', border: '1px solid #333' }}>
            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
              <path d="M 10 90 Q 50 10 90 90" stroke="#666" strokeWidth="1" fill="rgba(255, 255, 255, 0.1)" />
              <line x1="50" y1="10" x2="50" y2="100" stroke="#888" strokeWidth="1" />
            </svg>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', fontSize: '11px', color: '#ccc' }}>
            Key Source 
            <select style={{ background: '#111', color: '#fff', border: '1px solid #333', padding: '4px' }}><option>Self</option></select>
          </div>
          <div style={{ display: 'flex', gap: '20px', marginTop: '10px', height: '110px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' }}><button style={powerBtnOff}>Filter</button><button style={powerBtnOff}>Solo</button></div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '10px' }}>{gType.toFixed(1)}</div>
              <input type="range" min="1" max="10" step="0.1" value={gType} onChange={(e) => handleGate('type', e.target.value)} onDoubleClick={() => handleGate('type', 3.0)} style={{ height: '100%', width: '20px', writingMode: 'vertical-lr', direction: 'rtl', accentColor: '#0984e3' }} />
              <div style={{ fontSize: '11px', color: '#aaa', marginTop: '5px' }}>Type</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '10px' }}>{gFreq.toFixed(1)} Hz</div>
              <input type="range" min="20" max="20000" step="10" value={gFreq} onChange={(e) => handleGate('freq', e.target.value)} onDoubleClick={() => handleGate('freq', 990)} style={{ height: '100%', width: '20px', writingMode: 'vertical-lr', direction: 'rtl', accentColor: '#0984e3' }} />
              <div style={{ fontSize: '11px', color: '#aaa', marginTop: '5px' }}>Frequency</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- TAB COMPONENT: DYNAMICS (COMPRESSOR) ---
  const renderDynTab = () => {
    return (
      <div style={{ display: 'flex', height: '100%', padding: '20px', gap: '40px', color: '#eee' }}>
        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ marginTop: '30px' }}><button onClick={() => handleComp('compOn', !cActive)} style={{ padding: '8px 20px', background: cActive ? '#0984e3' : '#333', color: cActive ? '#fff' : '#ccc', border: '1px solid #555', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Active</button></div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '10px' }}>Gain</div>
            <div style={{ display: 'flex', gap: '15px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '130px', height: '90px', background: '#0a0a0c', border: '1px solid #333' }}>
                  <CompCurve thresh={cThresh} ratio={cRatio} active={cActive} />
                </div>
                <div style={{ display: 'flex', gap: '15px', marginTop: '10px', fontSize: '11px', color: '#ccc' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}><input type="radio" name="compMode" checked={comp.mode !== 'Exp'} onChange={() => handleComp('mode', 'Comp')} style={{ accentColor: '#0984e3' }} /> Comp</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}><input type="radio" name="compMode" checked={comp.mode === 'Exp'} onChange={() => handleComp('mode', 'Exp')} style={{ accentColor: '#0984e3' }} /> Exp</label>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10px', color: '#ccc' }}>
                {[0, 1, 2, 3, 4, 5].map(k => (<label key={k} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}><input type="radio" name="compKnee" checked={cKnee === k} onChange={() => handleComp('knee', k)} style={{ margin: 0, accentColor: '#0984e3' }}/> {k}</label>))}
                <div style={{ fontWeight: 'bold', marginTop: '2px' }}>Knee</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', fontSize: '10px', color: '#ccc', marginLeft: '5px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}><input type="radio" name="compEnv" checked={comp.env !== 'Log'} onChange={() => handleComp('env', 'Lin')} style={{ margin: 0, accentColor: '#0984e3' }}/> Lin</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}><input type="radio" name="compEnv" checked={comp.env === 'Log'} onChange={() => handleComp('env', 'Log')} style={{ margin: 0, accentColor: '#0984e3' }}/> Log</label>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}><input type="radio" name="compDet" checked={comp.det !== 'RMS'} onChange={() => handleComp('det', 'Peak')} style={{ margin: 0, accentColor: '#0984e3' }}/> Peak</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}><input type="radio" name="compDet" checked={comp.det === 'RMS'} onChange={() => handleComp('det', 'RMS')} style={{ margin: 0, accentColor: '#0984e3' }}/> RMS</label>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '15px', marginTop: '15px', height: '140px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '10px' }}>{cThresh.toFixed(1)} dB</div>
                <div style={{ display: 'flex', gap: '10px', height: '100%' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '9px', color: '#888', textAlign: 'right' }}><span>-10</span><span>-20</span><span>-30</span><span>-40</span><span>-50</span><span>-60</span></div>
                  <input type="range" min="-60" max="0" step="0.5" value={cThresh} onChange={(e) => handleComp('threshold', e.target.value)} onDoubleClick={() => handleComp('threshold', -10)} style={{ height: '100%', width: '20px', writingMode: 'vertical-lr', direction: 'rtl', accentColor: '#555' }} />
                </div>
                <div style={{ fontSize: '11px', color: '#aaa', marginTop: '5px' }}>Threshold</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '10px', visibility: 'hidden' }}>0 dB</div>
                <div style={{ display: 'flex', gap: '10px', height: '100%' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '9px', color: '#888', textAlign: 'right' }}><span>3</span><span>6</span><span>9</span><span>12</span><span>15</span><span>18</span></div>
                  <div style={{ height: '100%', width: '20px', background: '#0a0a0c', border: '1px solid #333' }}></div>
                </div>
                <div style={{ fontSize: '11px', color: '#aaa', marginTop: '5px' }}>GR</div>
              </div>
              {[{ label: 'Ratio', val: cRatio, min: 1, max: 20, step: 0.5, unit: '' }, { label: 'Mix', val: cMix, min: 0, max: 100, step: 1, unit: '%' }, { label: 'Gain', val: cGain, min: 0, max: 24, step: 0.5, unit: 'dB' }].map(ctrl => (
                <div key={ctrl.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '10px' }}>{ctrl.val.toFixed(1)} {ctrl.unit}</div>
                  <input type="range" min={ctrl.min} max={ctrl.max} step={ctrl.step} value={ctrl.val} onChange={(e) => handleComp(ctrl.label.toLowerCase() === 'gain' ? 'makeupGain' : ctrl.label.toLowerCase(), e.target.value)} onDoubleClick={() => handleComp(ctrl.label.toLowerCase() === 'gain' ? 'makeupGain' : ctrl.label.toLowerCase(), ctrl.min + (ctrl.max - ctrl.min) / 4)} style={{ height: '100%', width: '20px', writingMode: 'vertical-lr', direction: 'rtl', accentColor: '#0984e3' }} />
                  <div style={{ fontSize: '11px', color: '#aaa', marginTop: '5px' }}>{ctrl.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '10px' }}>Gain Envelope</div>
          <div style={{ width: '150px', height: '90px', background: '#0a0a0c', border: '1px solid #333', position: 'relative' }}>
            <EnvelopeGraph a={cAttack} h={cHold} r={cRelease} isComp={true} />
          </div>
          <button style={{ ...powerBtnOff, marginTop: '10px' }}>Auto Time</button>
          <div style={{ display: 'flex', gap: '20px', marginTop: '20px', height: '110px' }}>
            {[{ label: 'Attack', val: cAttack, min: 0, max: 120, unit: 'ms' }, { label: 'Hold', val: cHold, min: 0, max: 2000, unit: 'ms' }, { label: 'Release', val: cRelease, min: 5, max: 4000, unit: 'ms' }].map(ctrl => (
              <div key={ctrl.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '10px' }}>{ctrl.val} {ctrl.unit}</div>
                <input type="range" min={ctrl.min} max={ctrl.max} value={ctrl.val} onChange={(e) => handleComp(ctrl.label.toLowerCase(), e.target.value)} onDoubleClick={() => handleComp(ctrl.label.toLowerCase(), ctrl.min + (ctrl.max - ctrl.min) / 4)} style={{ height: '100%', width: '20px', writingMode: 'vertical-lr', direction: 'rtl', accentColor: '#0984e3' }} />
                <div style={{ fontSize: '11px', color: '#aaa', marginTop: '5px' }}>{ctrl.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '10px' }}>Side Chain Filter</div>
          <div style={{ width: '180px', height: '90px', background: '#0a0a0c', border: '1px solid #333' }}>
            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
              <path d="M 10 90 Q 50 10 90 90" stroke="#666" strokeWidth="1" fill="rgba(255, 255, 255, 0.1)" />
              <line x1="50" y1="10" x2="50" y2="100" stroke="#888" strokeWidth="1" />
            </svg>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', fontSize: '11px', color: '#ccc' }}>
            Key Source 
            <select style={{ background: '#111', color: '#fff', border: '1px solid #333', padding: '4px' }}><option>Self</option></select>
          </div>
          <div style={{ display: 'flex', gap: '20px', marginTop: '10px', height: '110px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' }}><button style={powerBtnOff}>Filter</button><button style={powerBtnOff}>Solo</button></div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '10px' }}>{cType.toFixed(1)}</div>
              <input type="range" min="1" max="10" step="0.1" value={cType} onChange={(e) => handleComp('type', e.target.value)} onDoubleClick={() => handleComp('type', 3.0)} style={{ height: '100%', width: '20px', writingMode: 'vertical-lr', direction: 'rtl', accentColor: '#0984e3' }} />
              <div style={{ fontSize: '11px', color: '#aaa', marginTop: '5px' }}>Type</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '10px' }}>{cFreq.toFixed(1)} Hz</div>
              <input type="range" min="20" max="20000" step="10" value={cFreq} onChange={(e) => handleComp('freq', e.target.value)} onDoubleClick={() => handleComp('freq', 990)} style={{ height: '100%', width: '20px', writingMode: 'vertical-lr', direction: 'rtl', accentColor: '#0984e3' }} />
              <div style={{ fontSize: '11px', color: '#aaa', marginTop: '5px' }}>Frequency</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- TAB COMPONENT: MAIN OUT ---
  const renderMainTab = () => {
    const pan = channel.pan || 0;

    return (
      <div style={{ display: 'flex', height: '100%', padding: '20px', color: '#eee', fontFamily: 'sans-serif' }}>
        
        {/* LEFT PANE - MAIN OUTPUT */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '20px' }}>Main Output</div>
          
          <div style={{ display: 'flex', width: '100%', justifyContent: 'space-around', marginBottom: '40px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', marginBottom: '10px', fontWeight: 'bold' }}>Main Stereo</div>
              <button style={{ background: '#d35400', color: '#000', border: 'none', padding: '4px 8px', fontWeight: 'bold', borderRadius: '2px', cursor: 'pointer' }}>LR</button>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', marginBottom: '10px', fontWeight: 'bold' }}>Mono/Center</div>
              <button style={{ background: '#333', color: '#777', border: 'none', padding: '4px 8px', fontWeight: 'bold', borderRadius: '2px', cursor: 'pointer' }}>M/C</button>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '11px', marginBottom: '10px', fontWeight: 'bold' }}>Panning Mode</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#0984e3', cursor: 'pointer' }}>
                <input type="radio" checked readOnly style={{ accentColor: '#0984e3', margin: 0 }} /> LR + Mono
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#555', marginTop: '5px' }}>
                <input type="radio" disabled style={{ margin: 0 }} /> LCR
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', width: '100%', justifyContent: 'space-around', alignItems: 'flex-end' }}>
            {/* PANORAMA INTERACTIVE GRAPHIC */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: '11px', marginBottom: '10px', fontWeight: 'bold' }}>Panorama</div>
              <div style={{ fontSize: '11px', marginBottom: '10px' }}>{pan}</div>
              <div style={{ width: '80px', height: '30px', background: '#111', border: '1px solid #333', position: 'relative' }}>
                 <input type="range" min="-100" max="100" value={pan} onChange={handlePan} onDoubleClick={() => handlePan({target: {value: 0}})} style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0, cursor: 'grab', zIndex: 10 }} />
                 <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                   <polygon points="0,0 50,50 0,100" fill={pan < 0 ? '#0984e3' : '#333'} />
                   <polygon points="100,0 50,50 100,100" fill={pan > 0 ? '#0984e3' : '#333'} />
                 </svg>
              </div>
            </div>

            {/* MONO SLIDER */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: '11px', marginBottom: '10px' }}>-2.8 dB</div>
              <div style={{ display: 'flex', gap: '10px', height: '100px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '9px', color: '#888', textAlign: 'right' }}>
                  <span>10</span><span>0</span><span>-10</span><span>-30</span><span>-oo</span>
                </div>
                <input type="range" min="-60" max="10" defaultValue="-2.8" style={{ height: '100%', width: '20px', writingMode: 'vertical-lr', direction: 'rtl', accentColor: '#555' }} />
              </div>
            </div>

            {/* L M R METERS */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '10px', fontSize: '11px', marginBottom: '5px', fontWeight: 'bold' }}>
                <span>Left</span><span>Mono</span><span>Right</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', height: '100px', background: '#050505', border: '1px solid #222', padding: '5px', borderRadius: '4px' }}>
                <div style={{ width: '15px', background: '#111', position: 'relative', border: '1px solid #333' }}>
                  <div style={{ position: 'absolute', bottom: 0, width: '100%', height: '60%', background: '#0984e3' }}></div>
                </div>
                <div style={{ width: '15px', background: '#111', position: 'relative', border: '1px solid #333' }}>
                  <div style={{ position: 'absolute', bottom: 0, width: '100%', height: '10%', background: '#0984e3' }}></div>
                </div>
                <div style={{ width: '15px', background: '#111', position: 'relative', border: '1px solid #333' }}>
                  <div style={{ position: 'absolute', bottom: 0, width: '100%', height: '10%', background: '#0984e3' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ width: '1px', background: '#222', margin: '0 20px' }}></div>

        {/* RIGHT PANE - GROUP ASSIGNMENTS */}
        <div style={{ flex: 1, display: 'flex' }}>
          
          {/* Auto Mix Weight */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: '30px' }}>
            <div style={{ fontSize: '11px', marginBottom: '10px' }}>+1.0 dB</div>
            <div style={{ display: 'flex', gap: '10px', height: '140px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '9px', color: '#888', textAlign: 'right' }}>
                <span>+12</span><span>+8</span><span>+4</span><span>0</span><span>-4</span><span>-8</span><span>-12</span>
              </div>
              <input type="range" min="-12" max="12" defaultValue="1" style={{ height: '100%', width: '20px', writingMode: 'vertical-lr', direction: 'rtl', accentColor: '#0984e3' }} />
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '9px', color: '#888', textAlign: 'left' }}>
                <span>2</span><span>4</span><span>6</span><span>8</span><span>10</span><span>12</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '15px', fontSize: '10px', color: '#aaa', marginTop: '5px', fontWeight: 'bold' }}>
              <span>Weight</span><span>GR</span>
            </div>
          </div>

          {/* Groups Grid */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center' }}>Group Assignments</div>
            
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '10px' }}>Auto Mix</div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={dcaCircle}>X</div><div style={dcaCircle}>Y</div>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '10px' }}>DCA Group</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '5px' }}>
                  {[1,2,3,4,5,6,7,8].map(i => <div key={i} style={dcaCircle}>{i}</div>)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginLeft: '10px' }}>
                  <input type="checkbox" style={{ accentColor: '#0984e3', width: '16px', height: '16px' }} />
                  <span style={{ fontSize: '9px', color: '#aaa', marginTop: '2px' }}>Edit</span>
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '10px' }}>Mute Group</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '5px' }}>
                  {[1,2,3,4,5,6].map(i => <div key={i} style={muteSquare}>{i}</div>)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginLeft: '10px' }}>
                  <input type="checkbox" style={{ accentColor: '#0984e3', width: '16px', height: '16px' }} />
                  <span style={{ fontSize: '9px', color: '#aaa', marginTop: '2px' }}>Edit</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ width: '100%', display: 'flex', background: '#1a1a1c', fontFamily: 'sans-serif' }}>
      <div style={{ width: '120px', background: '#111', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ borderBottom: '1px solid #333', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
           <div style={{ color: '#0984e3', fontSize: '24px', marginBottom: '5px' }}>▣</div>
           <div style={{ color: '#0984e3', fontWeight: 'bold', fontSize: '14px', textAlign: 'center' }}>{channel.name}</div>
        </div>
      </div>
      <div style={{ flex: 1, padding: '10px', background: '#141414', overflowY: 'auto' }}>
        {activeTab === 'Main' && renderMainTab()}
        {activeTab === 'Sends' && renderSendsTab()}
        {activeTab === 'EQ' && renderEQTab()}
        {activeTab === 'Config' && renderConfigTab()}
        {activeTab === 'Gate' && renderGateTab()}
        {activeTab === 'Dyn' && renderDynTab()}
        {activeTab === 'Channel' && renderChannelTab()}
      </div>
    </div>
  );
};

// --- STYLES ---
const colStyle = { flex: 1, minWidth: '120px', background: '#1a1a1c', border: '1px solid #333', display: 'flex', flexDirection: 'column' };
const headerStyle = { background: '#222', color: '#fff', padding: '5px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold', borderBottom: '1px solid #333' };
const powerBtnOff = { background: '#333', color: '#888', border: '1px solid #555', borderRadius: '4px', padding: '4px 12px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' };
const powerBtnOn = { background: '#0984e3', color: '#fff', border: '1px solid #0984e3', borderRadius: '4px', padding: '4px 12px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' };
const graphBox = { margin: '5px', height: '80px', background: '#0a0a0c', border: '1px solid #333', padding: '5px' };
const iconBtn = { width: '24px', height: '24px', background: '#222', border: '1px solid #444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', borderRadius: '2px', fontSize: '12px', cursor: 'pointer' };
const insertBlock = { width: '30px', height: '24px', border: '1px solid #555', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const dcaCircle = { width: '24px', height: '24px', borderRadius: '50%', background: '#333', border: '1px solid #555', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' };
const muteSquare = { width: '28px', height: '24px', borderRadius: '2px', background: '#333', border: '1px solid #555', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' };