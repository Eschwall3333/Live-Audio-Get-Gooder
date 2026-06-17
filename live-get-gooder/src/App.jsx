import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { ChannelStrip } from './components/ChannelStrip';
import { FatChannel } from './components/FatChannel';
import { MasterMultiband } from './components/MasterMultiband';
import { SceneManager } from './components/SceneManager';
import { FxReturnStrip } from './components/FxReturnStrip';
import { MasterStrip } from './components/MasterStrip';
import { TapeMachine } from './components/TapeMachine';

export const App = () => {
  const channels = useSelector(state => state.mixer.channels);
  
  // GLOBAL VIEW STATE
  const [activeLayer, setActiveLayer] = useState(1);
  const [activeTab, setActiveTab] = useState('EQ'); 

  const visibleChannels = activeLayer === 1 ? channels.slice(0, 16) : channels.slice(16, 32);
  const navTabs = ['Mixer', 'Channel', 'Config', 'Gate', 'Dyn', 'EQ', 'Sends', 'Main'];

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#111', color: '#eee', overflow: 'hidden', fontFamily: 'sans-serif' }}>

      {/* LEFT COLUMN: THE MAIN WORKSPACE */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* TOP MENU BAR (M32 Style) */}
        <div style={{ display: 'flex', background: '#222', borderBottom: '1px solid #000', padding: '5px 10px', gap: '5px' }}>
          {navTabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 16px', background: activeTab === tab ? '#111' : '#333',
                color: activeTab === tab ? '#0984e3' : '#aaa', border: '1px solid #111',
                borderTop: activeTab === tab ? '2px solid #0984e3' : '2px solid transparent',
                cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', borderRadius: '2px'
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* FAT CHANNEL VIEWPORT (Visible on every tab EXCEPT 'Mixer') */}
        {activeTab !== 'Mixer' && (
          <div style={{ height: '45vh', minHeight: '300px', borderBottom: '2px solid #000', display: 'flex', flexShrink: 0 }}>
            <FatChannel activeTab={activeTab} />
          </div>
        )}

        {/* CHANNEL BANK (Auto-resizes based on the Fat Channel above it) */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          
          {/* Fader Layer Buttons */}
          <div style={{ width: '40px', background: '#1a1a1c', borderRight: '1px solid #000', display: 'flex', flexDirection: 'column', padding: '10px 2px', gap: '5px', flexShrink: 0 }}>
            <button onClick={() => setActiveLayer(1)} style={{ flex: 1, maxHeight: '100px', background: activeLayer === 1 ? '#0984e3' : '#333', color: activeLayer === 1 ? '#fff' : '#888', border: 'none', cursor: 'pointer', fontWeight: 'bold', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>1-16</button>
            <button onClick={() => setActiveLayer(2)} style={{ flex: 1, maxHeight: '100px', background: activeLayer === 2 ? '#0984e3' : '#333', color: activeLayer === 2 ? '#fff' : '#888', border: 'none', cursor: 'pointer', fontWeight: 'bold', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>17-32</button>
          </div>

          <div style={{ flex: 1, display: 'flex', overflowX: 'auto', overflowY: 'hidden', alignItems: 'flex-end', background: '#141414' }}>
            {visibleChannels.map(channel => (
              <ChannelStrip key={channel.id} channel={channel} activeTab={activeTab} />
            ))}
          </div>

        </div>
      </div>

      {/* RIGHT COLUMN: UTILITY & MASTER LR */}
      <div style={{ width: '380px', flexShrink: 0, background: '#1a1a1c', borderLeft: '2px solid #000', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <SceneManager />
        <TapeMachine />
        <MasterMultiband />
        <div style={{ display: 'flex', gap: '5px', padding: '10px', justifyContent: 'center' }}>
          <FxReturnStrip />
          <MasterStrip />
        </div>
      </div>

    </div>
  );
};

export default App;