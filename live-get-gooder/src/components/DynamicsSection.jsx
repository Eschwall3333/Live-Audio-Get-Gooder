import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { updateParam } from '../store/mixerSlice';
import { audioEngine } from '../audio/AudioEngine';

const defaultDynamics = {
  gateOn: false,
  gateThreshold: -60,
  gateAttack: 10,
  gateRelease: 100,
  compOn: false,
  compThreshold: 0,
  compRatio: 2,
  compAttack: 10,
  compRelease: 100
};

export const DynamicsSection = ({ channel }) => {
  const dispatch = useDispatch();
  const [dyn, setDyn] = useState(channel.dynamics || defaultDynamics);

  useEffect(() => {
    if (channel.dynamics) {
      setDyn(channel.dynamics);
    }
  }, [channel.dynamics]);

  const handleDynChange = (param, value) => {
    const numVal = parseFloat(value);
    const newDyn = { ...dyn, [param]: numVal };
    setDyn(newDyn);

    if (param.startsWith('gate')) {
      audioEngine.getChannel(channel.id).setGate(newDyn.gateOn, newDyn.gateThreshold, newDyn.gateAttack, newDyn.gateRelease);
    } else {
      audioEngine.getChannel(channel.id).setCompressor(newDyn.compOn, newDyn.compThreshold, newDyn.compRatio, newDyn.compAttack, newDyn.compRelease);
    }
  };

  const toggleModule = (module) => {
    const key = module === 'gate' ? 'gateOn' : 'compOn';
    const newVal = !dyn[key];
    const newDyn = { ...dyn, [key]: newVal };
    setDyn(newDyn);
    
    if (module === 'gate') {
      audioEngine.getChannel(channel.id).setGate(newVal, newDyn.gateThreshold, newDyn.gateAttack, newDyn.gateRelease);
    } else {
      audioEngine.getChannel(channel.id).setCompressor(newVal, newDyn.compThreshold, newDyn.compRatio, newDyn.compAttack, newDyn.compRelease);
    }
    dispatch(updateParam({ channelId: channel.id, key: 'dynamics', value: newDyn }));
  };

  const handleRelease = () => {
    dispatch(updateParam({ channelId: channel.id, key: 'dynamics', value: dyn }));
  };

  return (
    <div style={{ background: '#3a3a45', padding: '10px', borderRadius: '6px', marginBottom: '15px', width: '100%', fontSize: '0.8rem' }}>
      <div style={{ fontWeight: 'bold', marginBottom: '10px', borderBottom: '1px solid #555' }}>DYNAMICS</div>
      
      {/* ----------- NOISE GATE SECTION ----------- */}
      <div style={{ borderBottom: '1px dashed #555', paddingBottom: '10px', marginBottom: '10px' }}>
        <button 
          onClick={() => toggleModule('gate')} 
          style={{ width: '100%', marginBottom: '10px', background: dyn.gateOn ? '#5cb85c' : '#555', color: '#fff', border: 'none', padding: '5px', borderRadius: '3px', cursor: 'pointer' }}
        >
          GATE {dyn.gateOn ? 'ON' : 'OFF'}
        </button>

        <div style={{ opacity: dyn.gateOn ? 1 : 0.5, pointerEvents: dyn.gateOn ? 'auto' : 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>Thresh:</span> <span>{dyn.gateThreshold} dB</span>
          </div>
          <input type="range" min="-80" max="0" step="1" value={dyn.gateThreshold} onChange={(e) => handleDynChange('gateThreshold', e.target.value)} onMouseUp={handleRelease} style={{ width: '100%' }} />
        </div>
      </div>

      {/* ----------- COMPRESSOR SECTION ----------- */}
      <div>
        <button 
          onClick={() => toggleModule('comp')} 
          style={{ width: '100%', marginBottom: '10px', background: dyn.compOn ? '#f0ad4e' : '#555', color: '#fff', border: 'none', padding: '5px', borderRadius: '3px', cursor: 'pointer' }}
        >
          COMP {dyn.compOn ? 'ON' : 'OFF'}
        </button>

        <div style={{ opacity: dyn.compOn ? 1 : 0.5, pointerEvents: dyn.compOn ? 'auto' : 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>Thresh:</span> <span>{dyn.compThreshold} dB</span>
          </div>
          <input type="range" min="-60" max="0" step="1" value={dyn.compThreshold} onChange={(e) => handleDynChange('compThreshold', e.target.value)} onMouseUp={handleRelease} style={{ width: '100%', marginBottom: '10px' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>Ratio:</span> <span>{dyn.compRatio}:1</span>
          </div>
          <input type="range" min="1" max="20" step="0.5" value={dyn.compRatio} onChange={(e) => handleDynChange('compRatio', e.target.value)} onMouseUp={handleRelease} style={{ width: '100%', marginBottom: '10px' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>Attack:</span> <span>{dyn.compAttack} ms</span>
          </div>
          <input type="range" min="1" max="100" step="1" value={dyn.compAttack} onChange={(e) => handleDynChange('compAttack', e.target.value)} onMouseUp={handleRelease} style={{ width: '100%', marginBottom: '10px' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>Release:</span> <span>{dyn.compRelease} ms</span>
          </div>
          <input type="range" min="10" max="1000" step="10" value={dyn.compRelease} onChange={(e) => handleDynChange('compRelease', e.target.value)} onMouseUp={handleRelease} style={{ width: '100%' }} />
        </div>
      </div>
    </div>
  );
};