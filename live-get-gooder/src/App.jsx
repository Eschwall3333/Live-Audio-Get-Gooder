import React from 'react';
import { useSelector } from 'react-redux';
import { ChannelStrip } from './components/ChannelStrip';
import { MasterMultiband } from './components/MasterMultiband';
import { SceneManager } from './components/SceneManager';
import { FxReturnStrip } from './components/FxReturnStrip';
import { MasterStrip } from './components/MasterStrip';

export const App = () => {
  // Grab the 32 channels from Redux so we can render them
  const channels = useSelector(state => state.mixer.channels);

  return (
    // THE DESK: Takes up 100% of the screen, no vertical body scroll
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#111', color: '#eee', overflow: 'hidden' }}>
      
      {/* LEFT SIDE: The Channel Bank (Scrolls Horizontally) */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', display: 'flex', gap: '5px', padding: '20px' }}>
        {channels.map(channel => (
          <ChannelStrip key={channel.id} channel={channel} />
        ))}
      </div>

      {/* RIGHT SIDE: The Master Rack (Pinned, never scrolls away) */}
      <div style={{ width: '450px', minWidth: '450px', flexShrink: 0, padding: '20px', borderLeft: '2px solid #333', overflowY: 'auto', backgroundColor: '#1a1a1c' }}>
        
        <SceneManager />
        <MasterMultiband />

        {/* Master Faders Block */}
        <div style={{ display: 'flex', gap: '5px', padding: '10px', background: '#1c1c1f', borderRadius: '4px', border: '1px solid #333' }}>
          <FxReturnStrip />
          <MasterStrip />
        </div>
        
      </div>
      
    </div>
  );
};

export default App;