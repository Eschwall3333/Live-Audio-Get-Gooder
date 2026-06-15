import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { audioEngine } from './audio/AudioEngine';

// COMPONENT IMPORTS
import { PreampSection } from './components/PreampSection';
import { EQSection } from './components/EQSection';
import { DynamicsSection } from './components/DynamicsSection';
import { AudioLoader } from './components/AudioLoader';
import { Fader } from './components/Fader';
import { Meter } from './components/Meter';
import { FeedbackTrainer } from './components/FeedbackTrainer';
import { ToneGenerator } from './components/ToneGenerator';
import { MasterStrip } from './components/MasterStrip';
// --- NEW IMPORTS ---
import { RoutingMatrix } from './components/RoutingMatrix';
import { DcaStrip } from './components/DcaStrip';
import { MatrixStrip } from './components/MatrixStrip';
import { MuteGroupBank } from './components/MuteGroupBank';

export default function App() {
  const channels = useSelector((state) => state.mixer.channels);
  
  // --- LAYOUT & BANKING STATE ---
  const [viewSize, setViewSize] = useState(32); 
  const [startIdx, setStartIdx] = useState(0);  
  
  // --- MIX MODE STATE ---
  const [activeBus, setActiveBus] = useState(null); // null = Main Mix, 0-15 = Bus Mix
  
  // --- NEW: ROUTING MATRIX STATE ---
  const [showRouting, setShowRouting] = useState(false);

  useEffect(() => {
    const startAudio = () => {
      audioEngine.init();
      window.removeEventListener('click', startAudio);
      console.log("Audio Engine Online!"); 
    };
    window.addEventListener('click', startAudio);
    return () => window.removeEventListener('click', startAudio);
  }, []);

  // --- BANKING LOGIC ---
  const handleViewChange = (e) => {
    const val = parseInt(e.target.value);
    setViewSize(val);
    if (startIdx + val > 32) {
      setStartIdx(Math.max(0, 32 - val));
    }
  };

  const shiftBank = (amount) => {
    let newIdx = startIdx + amount;
    if (newIdx < 0) newIdx = 0;
    if (newIdx + viewSize > 32) newIdx = 32 - viewSize;
    setStartIdx(newIdx);
  };

  const visibleChannels = channels.slice(startIdx, startIdx + viewSize);

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ margin: '0 0 10px 0' }}>Sound Decisions: M32 Simulator</h2>
      <p style={{ fontSize: '0.9rem', color: '#aaa', marginTop: 0, marginBottom: '20px' }}>
        Click anywhere on the background first to unlock the Audio Engine.
      </p>

      {/* --- TOP BAR: GLOBAL MODULES --- */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <FeedbackTrainer />
        <ToneGenerator />
        {/* --- TOP BAR: GLOBAL MODULES --- */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <FeedbackTrainer />
        <ToneGenerator />
        {/* NEW: THE KILL SWITCHES */}
        <MuteGroupBank />
      </div>
      </div>

      {/* --- TOP BAR: LAYOUT & BANKING PRESETS --- */}
      <div style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap',
        background: '#1a1a1e', padding: '15px 20px', borderRadius: '4px', marginBottom: '20px', border: '1px solid #333' 
      }}>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          
          {/* UPDATED: Lighthouse Label for Layout Preset */}
          <label htmlFor="layout-preset-select" className="module-header" style={{ border: 'none', margin: 0, padding: 0, color: '#f0ad4e', cursor: 'pointer' }}>
            LAYOUT PRESET:
          </label>
          <select 
            id="layout-preset-select"
            name="layout-preset-select"
            value={viewSize} 
            onChange={handleViewChange} 
            style={{ background: '#111', color: '#fff', padding: '8px 15px', border: '1px solid #555', borderRadius: '3px', fontSize: '1rem', cursor: 'pointer' }}
          >
            <option value={32}>All Inputs (1-32)</option>
            <option value={16}>16 Channels (Standard Bank)</option>
            <option value={8}>8 Channels (Half Bank)</option>
            <option value={4}>4 Channels (Zoomed)</option>
          </select>

          {/* NEW: Routing Matrix Trigger Button */}
          <button 
            onClick={() => setShowRouting(true)}
            style={{ padding: '8px 20px', background: '#00ffff', color: '#000', border: 'none', fontWeight: 'bold', borderRadius: '3px', cursor: 'pointer', marginLeft: '20px' }}
          >
            OPEN ROUTING MATRIX
          </button>
        </div>

        {/* --- TOP BAR: SENDS ON FADERS (MODE 1) --- */}
        <div style={{ 
          display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap',
          background: activeBus !== null ? '#1a3333' : 'transparent', // Glows cyan when active
          padding: '10px 15px', borderRadius: '4px', border: activeBus !== null ? '1px solid #00ffff' : 'none',
          transition: 'all 0.2s'
        }}>
          <div className="module-header" style={{ border: 'none', margin: 0, padding: 0, color: activeBus !== null ? '#00ffff' : '#f0ad4e' }}>
            MIX MODE:
          </div>
          
          <button 
            onClick={() => setActiveBus(null)}
            style={{ padding: '8px 15px', background: activeBus === null ? '#d9534f' : '#333', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
          >
            MAIN LR (FOH)
          </button>

          <div style={{ width: '2px', background: '#444', height: '20px' }} />

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            
            {/* UPDATED: Lighthouse Label for Mix Mode */}
            <label htmlFor="mix-mode-select" style={{ fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', color: activeBus !== null ? '#00ffff' : '#ccc' }}>
              SENDS ON FADERS:
            </label>
            <select 
              id="mix-mode-select"
              name="mix-mode-select"
              value={activeBus === null ? 'off' : activeBus} 
              onChange={(e) => setActiveBus(e.target.value === 'off' ? null : parseInt(e.target.value))}
              style={{ background: '#111', color: '#00ffff', padding: '8px 15px', border: '1px solid #00ffff', cursor: 'pointer', fontWeight: 'bold' }}
            >
              <option value="off">--- OFF ---</option>
              {Array.from({ length: 16 }, (_, i) => (
                <option key={i} value={i}>MIX BUS {i + 1}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Dynamic Shift Buttons */}
        {viewSize < 32 && (
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <span className="module-header" style={{ border: 'none', margin: '0 15px 0 0', padding: 0 }}>BANK SHIFT:</span>
            
            <button onClick={() => shiftBank(-8)} disabled={startIdx === 0} style={{ padding: '6px 10px', cursor: startIdx === 0 ? 'not-allowed' : 'pointer' }}>- 8</button>
            <button onClick={() => shiftBank(-4)} disabled={startIdx === 0} style={{ padding: '6px 10px', cursor: startIdx === 0 ? 'not-allowed' : 'pointer' }}>- 4</button>
            <button onClick={() => shiftBank(-2)} disabled={startIdx === 0} style={{ padding: '6px 10px', cursor: startIdx === 0 ? 'not-allowed' : 'pointer' }}>- 2</button>
            
            <span style={{ margin: '0 15px', color: '#00ffff', fontWeight: 'bold', fontSize: '1.1rem', letterSpacing: '1px' }}>
              CH {startIdx + 1} - {startIdx + viewSize}
            </span>
            
            <button onClick={() => shiftBank(2)} disabled={startIdx + viewSize >= 32} style={{ padding: '6px 10px', cursor: startIdx + viewSize >= 32 ? 'not-allowed' : 'pointer' }}>+ 2</button>
            <button onClick={() => shiftBank(4)} disabled={startIdx + viewSize >= 32} style={{ padding: '6px 10px', cursor: startIdx + viewSize >= 32 ? 'not-allowed' : 'pointer' }}>+ 4</button>
            <button onClick={() => shiftBank(8)} disabled={startIdx + viewSize >= 32} style={{ padding: '6px 10px', cursor: startIdx + viewSize >= 32 ? 'not-allowed' : 'pointer' }}>+ 8</button>
          </div>
        )}
      </div>

      {/* --- THE CONSOLE GRID --- */}
      <div style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '20px' }}>
        
        {/* Render the Active Bank of Input Channels */}
        {visibleChannels.map((ch) => (
          <div key={ch.id} className="channel-strip">
            <div className="scribble-strip">{ch.name}</div>
            <PreampSection channel={ch} />
            <EQSection channel={ch} />
            <DynamicsSection channel={ch} />
            <AudioLoader channelId={ch.id} />

            <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start', width: '100%', justifyContent: 'center' }}>
              <Fader channelId={ch.id} activeBus={activeBus} />
              <Meter channelId={ch.id} />
            </div>
          </div>
        ))}

        {/* Divider Bay */}
        <div style={{ minWidth: '10px', borderLeft: '2px dashed #444', margin: '0 10px' }}></div>

        {/* --- NEW: DCA FADER BANK --- */}
        <div style={{ display: 'flex', gap: '5px' }}>
          {Array.from({ length: 8 }, (_, i) => (
            <DcaStrip key={i} dcaIndex={i} />
          ))}
        </div>

        <div style={{ minWidth: '10px', borderLeft: '2px dashed #444', margin: '0 10px' }}></div>

        {/* --- NEW: MATRIX FADER BANK --- */}
        <div style={{ display: 'flex', gap: '5px' }}>
          {Array.from({ length: 6 }, (_, i) => (
            <MatrixStrip key={i} matrixIndex={i} />
          ))}
        </div>

        {/* DOCKED MASTER LR STRIP */}
        <MasterStrip />

      </div>

      {/* --- NEW: ROUTING MATRIX MODAL --- */}
      {showRouting && <RoutingMatrix onClose={() => setShowRouting(false)} />}

    </div>
  );
}