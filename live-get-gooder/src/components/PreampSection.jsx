import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { updateParam } from '../store/mixerSlice';
import { audioEngine } from '../audio/AudioEngine';

export const PreampSection = ({ channel }) => {
  const dispatch = useDispatch();
  const [gain, setGain] = useState(channel.gain);
  const [hpfFreq, setHpfFreq] = useState(channel.hpfFreq);

  // --- Handlers for Input Gain ---
  const handleGainChange = (e) => {
    const val = parseFloat(e.target.value);
    setGain(val);
    audioEngine.getChannel(channel.id).setGain(val);
  };

  const handleGainRelease = () => {
    dispatch(updateParam({ channelId: channel.id, key: 'gain', value: gain }));
  };

  // --- Handlers for Buttons (Phase & HPF Toggle) ---
  const togglePhase = () => {
    const newVal = !channel.phaseInverted;
    audioEngine.getChannel(channel.id).setPhase(newVal);
    dispatch(updateParam({ channelId: channel.id, key: 'phaseInverted', value: newVal }));
  };

  const toggleHPF = () => {
    const newVal = !channel.hpfOn;
    audioEngine.getChannel(channel.id).setHPF(newVal, hpfFreq);
    dispatch(updateParam({ channelId: channel.id, key: 'hpfOn', value: newVal }));
  };

  // --- Handlers for HPF Frequency ---
  const handleHpfFreqChange = (e) => {
    const val = parseFloat(e.target.value);
    setHpfFreq(val);
    if (channel.hpfOn) {
      audioEngine.getChannel(channel.id).setHPF(true, val);
    }
  };

  const handleHpfFreqRelease = () => {
    dispatch(updateParam({ channelId: channel.id, key: 'hpfFreq', value: hpfFreq }));
  };

  return (
    <div style={{ background: '#3a3a45', padding: '10px', borderRadius: '6px', marginBottom: '15px', width: '100%', fontSize: '0.8rem' }}>
      <div style={{ fontWeight: 'bold', marginBottom: '10px', borderBottom: '1px solid #555' }}>PREAMP</div>
      
      {/* Gain Slider */}
      <div style={{ marginBottom: '10px' }}>
        <label>Gain: {gain} dB</label>
        <input type="range" min="-12" max="60" step="0.5" value={gain} onChange={handleGainChange} onMouseUp={handleGainRelease} style={{ width: '100%' }} />
      </div>

      {/* Toggles */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <button onClick={togglePhase} style={{ flex: 1, background: channel.phaseInverted ? '#d9534f' : '#555', color: '#fff', border: 'none', padding: '5px', borderRadius: '3px', cursor: 'pointer' }}>
          Ø Phase
        </button>
        <button onClick={toggleHPF} style={{ flex: 1, background: channel.hpfOn ? '#5cb85c' : '#555', color: '#fff', border: 'none', padding: '5px', borderRadius: '3px', cursor: 'pointer' }}>
          HPF In
        </button>
      </div>

      {/* HPF Freq Slider */}
      <div>
        <label>HPF Freq: {hpfFreq} Hz</label>
        <input type="range" min="20" max="400" step="1" value={hpfFreq} onChange={handleHpfFreqChange} onMouseUp={handleHpfFreqRelease} style={{ width: '100%' }} />
      </div>
    </div>
  );
};