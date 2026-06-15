import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { toggleDcaAssignment, toggleMatrixAssignment, toggleMuteGroupAssignment } from '../store/mixerSlice';
import { audioEngine } from '../audio/AudioEngine';

export const RoutingMatrix = ({ onClose }) => {
  const dispatch = useDispatch();
  const channels = useSelector(state => state.mixer.channels);
  const buses = useSelector(state => state.mixer.buses);
  
  // NEW: Added 3rd Tab State
  const [activeTab, setActiveTab] = useState('dca'); // 'dca', 'matrix', or 'mute'

  const handleDcaToggle = (channelId, dcaIndex) => {
    dispatch(toggleDcaAssignment({ channelId, dcaIndex }));
    const ch = channels.find(c => c.id === channelId);
    let newAssignments = [...(ch.dcaAssignments || [])];
    if (newAssignments.includes(dcaIndex)) newAssignments = newAssignments.filter(d => d !== dcaIndex); else newAssignments.push(dcaIndex);
    audioEngine.updateChannelDcaRouting(channelId, newAssignments);
  };

  const handleMatrixToggle = (busIndex, matrixIndex) => {
    dispatch(toggleMatrixAssignment({ busIndex, matrixIndex }));
    const bus = buses[busIndex];
    let newAssignments = [...(bus.matrixAssignments || [])];
    if (newAssignments.includes(matrixIndex)) newAssignments = newAssignments.filter(m => m !== matrixIndex); else newAssignments.push(matrixIndex);
    audioEngine.updateBusMatrixRouting(busIndex, newAssignments);
  };

  // --- NEW: Mute Routing Function ---
  const handleMuteToggle = (channelId, muteGroupIndex) => {
    dispatch(toggleMuteGroupAssignment({ channelId, muteGroupIndex }));
    const ch = channels.find(c => c.id === channelId);
    let newAssignments = [...(ch.muteGroupAssignments || [])];
    if (newAssignments.includes(muteGroupIndex)) newAssignments = newAssignments.filter(m => m !== muteGroupIndex); else newAssignments.push(muteGroupIndex);
    audioEngine.updateChannelMuteRouting(channelId, newAssignments);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ background: '#1e1e22', border: '1px solid #444', borderRadius: '8px', padding: '20px', width: '90%', maxWidth: '1000px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0px 10px 30px rgba(0,0,0,0.8)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
          <h2 style={{ margin: 0, color: '#f0ad4e' }}>SYSTEM ROUTING PATCH BAY</h2>
          <button onClick={onClose} style={{ background: '#d9534f', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>CLOSE</button>
        </div>

        {/* --- 3-TAB NAVIGATION --- */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button onClick={() => setActiveTab('dca')} style={{ padding: '10px 20px', background: activeTab === 'dca' ? '#00ffff' : '#333', color: activeTab === 'dca' ? '#000' : '#fff', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            INPUT → DCA
          </button>
          <button onClick={() => setActiveTab('matrix')} style={{ padding: '10px 20px', background: activeTab === 'matrix' ? '#ff00ff' : '#333', color: activeTab === 'matrix' ? '#000' : '#fff', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            BUS → MATRIX
          </button>
          <button onClick={() => setActiveTab('mute')} style={{ padding: '10px 20px', background: activeTab === 'mute' ? '#ff0000' : '#333', color: activeTab === 'mute' ? '#fff' : '#888', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            INPUT → MUTE GROUP
          </button>
        </div>

        {/* TAB 1: DCA ROUTING */}
        {activeTab === 'dca' && (
          <div style={{ display: 'grid', gridTemplateColumns: '100px repeat(8, 1fr)', gap: '5px' }}>
            <div style={{ fontWeight: 'bold', borderBottom: '1px solid #444' }}>CHANNEL</div>
            {Array.from({ length: 8 }, (_, i) => (<div key={i} style={{ textAlign: 'center', fontWeight: 'bold', borderBottom: '1px solid #444', paddingBottom: '5px' }}>DCA {i+1}</div>))}
            {channels.slice(0, 16).map(ch => (
              <React.Fragment key={ch.id}>
                <div style={{ padding: '8px 0', borderBottom: '1px solid #333', fontSize: '0.9rem' }}>{ch.name}</div>
                {Array.from({ length: 8 }, (_, dcaIdx) => {
                  const isActive = ch.dcaAssignments && ch.dcaAssignments.includes(dcaIdx);
                  return (
                    <div key={dcaIdx} onClick={() => handleDcaToggle(ch.id, dcaIdx)} style={{ borderBottom: '1px solid #333', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', background: isActive ? '#00ffff' : 'transparent' }}>
                      {isActive && <div style={{ width: '12px', height: '12px', background: '#000', borderRadius: '50%' }} />}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* TAB 2: MATRIX ROUTING */}
        {activeTab === 'matrix' && (
          <div style={{ display: 'grid', gridTemplateColumns: '100px repeat(6, 1fr)', gap: '5px' }}>
            <div style={{ fontWeight: 'bold', borderBottom: '1px solid #444' }}>MIX BUS</div>
            {Array.from({ length: 6 }, (_, i) => (<div key={i} style={{ textAlign: 'center', fontWeight: 'bold', borderBottom: '1px solid #444', paddingBottom: '5px' }}>MTX {i+1}</div>))}
            {buses.map((bus, busIdx) => (
              <React.Fragment key={bus.id}>
                <div style={{ padding: '8px 0', borderBottom: '1px solid #333', fontSize: '0.9rem' }}>{bus.name}</div>
                {Array.from({ length: 6 }, (_, mtxIdx) => {
                  const isActive = bus.matrixAssignments && bus.matrixAssignments.includes(mtxIdx);
                  return (
                    <div key={mtxIdx} onClick={() => handleMatrixToggle(busIdx, mtxIdx)} style={{ borderBottom: '1px solid #333', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', background: isActive ? '#ff00ff' : 'transparent' }}>
                      {isActive && <div style={{ width: '12px', height: '12px', background: '#000', borderRadius: '50%' }} />}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* --- NEW TAB 3: MUTE GROUP ROUTING --- */}
        {activeTab === 'mute' && (
          <div style={{ display: 'grid', gridTemplateColumns: '100px repeat(6, 1fr)', gap: '5px' }}>
            <div style={{ fontWeight: 'bold', borderBottom: '1px solid #444' }}>CHANNEL</div>
            {Array.from({ length: 6 }, (_, i) => (<div key={i} style={{ textAlign: 'center', fontWeight: 'bold', borderBottom: '1px solid #444', paddingBottom: '5px', color: '#ff0000' }}>MG {i+1}</div>))}
            {channels.slice(0, 16).map(ch => (
              <React.Fragment key={ch.id}>
                <div style={{ padding: '8px 0', borderBottom: '1px solid #333', fontSize: '0.9rem' }}>{ch.name}</div>
                {Array.from({ length: 6 }, (_, mgIdx) => {
                  const isActive = ch.muteGroupAssignments && ch.muteGroupAssignments.includes(mgIdx);
                  return (
                    <div key={mgIdx} onClick={() => handleMuteToggle(ch.id, mgIdx)} style={{ borderBottom: '1px solid #333', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', background: isActive ? '#ff0000' : 'transparent' }}>
                      {isActive && <div style={{ width: '12px', height: '12px', background: '#fff', borderRadius: '50%' }} />}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};