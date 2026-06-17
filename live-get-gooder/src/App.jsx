import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { ChannelStrip } from './components/ChannelStrip';
import { MasterMultiband } from './components/MasterMultiband';
import { SceneManager } from './components/SceneManager';
import { FxReturnStrip } from './components/FxReturnStrip';
import { MasterStrip } from './components/MasterStrip';
import { TapeMachine } from './components/TapeMachine';
import { FatChannel } from './components/FatChannel';

export const App = () => {
  const channels = useSelector(state => state.mixer.channels);

  // FADER BANK PAGINATION
  const [activeLayer, setActiveLayer] = useState(1);
  const visibleChannels = activeLayer === 1 
    ? channels.slice(0, 16) 
    : channels.slice(16, 32);

  return (
    // 1. STRICT 100VH WRAPPER (Never overflows the physical monitor)
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', backgroundColor: '#111', color: '#eee', overflow: 'hidden' }}>
      
      {/* 2. PINNED TOP RACK (Fat Channel) */}
      <div style={{ flexShrink: 0 }}>
        <FatChannel />
      </div>

      {/* 3. THE DESK (Takes remaining height, splits into 3 independent columns) */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* LEFT COLUMN: FADER BANK BUTTONS */}
        <div style={{ width: '50px', background: '#1a1a1c', borderRight: '2px solid #333', display: 'flex', flexDirection: 'column', padding: '20px 5px', gap: '10px', flexShrink: 0, overflowY: 'auto' }}>
          <button 
            onClick={() => setActiveLayer(1)}
            style={{ 
              flex: 1, minHeight: '100px', maxHeight: '150px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', 
              background: activeLayer === 1 ? '#17a2b8' : '#333', 
              color: activeLayer === 1 ? '#000' : '#888',
              writingMode: 'vertical-rl', transform: 'rotate(180deg)' 
            }}
          >
            CH 1-16
          </button>
          <button 
            onClick={() => setActiveLayer(2)}
            style={{ 
              flex: 1, minHeight: '100px', maxHeight: '150px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', 
              background: activeLayer === 2 ? '#17a2b8' : '#333', 
              color: activeLayer === 2 ? '#000' : '#888',
              writingMode: 'vertical-rl', transform: 'rotate(180deg)' 
            }}
          >
            CH 17-32
          </button>
        </div>

        {/* CENTER COLUMN: THE CHANNEL BANK */}
        {/* FIX: flex-start prevents vertical squishing, overflowY: auto enables scrolling */}
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', display: 'flex', gap: '5px', padding: '20px', alignItems: 'flex-start' }}>
          {visibleChannels.map(channel => (
            <ChannelStrip key={channel.id} channel={channel} />
          ))}
        </div>

        {/* RIGHT COLUMN: THE MASTER RACK */}
        <div style={{ width: '450px', minWidth: '450px', flexShrink: 0, padding: '20px', borderLeft: '2px solid #333', backgroundColor: '#1a1a1c', overflowY: 'auto' }}>
          <SceneManager />
          <TapeMachine />
          <MasterMultiband />
          <div style={{ display: 'flex', gap: '5px', padding: '10px', background: '#1c1c1f', borderRadius: '4px', border: '1px solid #333' }}>
            <FxReturnStrip />
            <MasterStrip />
          </div>
        </div>

      </div>
    </div>
  );
};

export default App;