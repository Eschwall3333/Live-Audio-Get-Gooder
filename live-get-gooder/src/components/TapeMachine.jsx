import React, { useState, useRef } from 'react';
import { audioEngine } from '../audio/AudioEngine';

export const TapeMachine = () => {
  const [trackName, setTrackName] = useState('NO MEDIA LOADED');
  const [isPlaying, setIsPlaying] = useState(false);
  const [targetChannel, setTargetChannel] = useState(1); 
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!audioEngine.ctx) {
      await audioEngine.init();
    } else if (audioEngine.ctx.state === 'suspended') {
      await audioEngine.ctx.resume();
    }

    setTrackName('DECODING AUDIO...');
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const arrayBuffer = event.target.result;
      try {
        const audioBuffer = await audioEngine.ctx.decodeAudioData(arrayBuffer);
        audioEngine.loadTrackIntoChannel(targetChannel, audioBuffer);
        setTrackName(file.name.toUpperCase());
        setIsPlaying(false);
      } catch (err) {
        console.error("Audio Decode Error:", err);
        setTrackName('UNSUPPORTED FORMAT');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handlePlay = async () => {
    if (!audioEngine.ctx) {
      await audioEngine.init();
    } else if (audioEngine.ctx.state === 'suspended') {
      await audioEngine.ctx.resume();
    }
    audioEngine.playChannelTrack(targetChannel);
    setIsPlaying(true);
  };

  const handlePause = () => {
    audioEngine.pauseChannelTrack(targetChannel);
    setIsPlaying(false);
  };

  const handleStop = () => {
    audioEngine.stopChannelTrack(targetChannel);
    setIsPlaying(false);
  };

  return (
    <div style={{ padding: '15px', background: '#1c1c1f', border: '1px solid #444', borderRadius: '6px', marginBottom: '15px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0, color: '#17a2b8', fontSize: '14px', letterSpacing: '1px' }}>USB 2-TRACK</h3>
        
        <div style={{ fontSize: '10px', color: '#888', display: 'flex', alignItems: 'center' }}>
          {/* FIX: Explicit Label and ID for the Routing Dropdown */}
          <label htmlFor="tape-route-select" style={{ marginRight: '5px' }}>ROUTE TO: </label>
          <select 
            id="tape-route-select"
            name="tape-route-select"
            value={targetChannel} 
            onChange={(e) => setTargetChannel(parseInt(e.target.value))}
            style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '2px' }}
          >
            {[...Array(32)].map((_, i) => (
              <option key={i+1} value={i+1}>CH {i+1}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ 
        background: '#0a0a0c', border: '1px inset #222', padding: '10px', 
        marginBottom: '10px', color: '#2ecc71', fontFamily: 'monospace', 
        fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' 
      }}>
        {isPlaying ? '▶ ' : '■ '} {trackName}
      </div>

      {/* FIX: Explicit ID and hidden label for the file input */}
      <label htmlFor="tape-file-upload" style={{ display: 'none' }}>Upload Audio File</label>
      <input 
        id="tape-file-upload"
        name="tape-file-upload"
        type="file" 
        accept="audio/*" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        style={{ display: 'none' }} 
      />

      <div style={{ display: 'flex', gap: '5px' }}>
        <button onClick={() => fileInputRef.current.click()} style={btnStyle('#333', '#fff')}>EJECT / LOAD</button>
        <button onClick={handleStop} style={btnStyle('#333', '#dc3545')}>STOP</button>
        <button onClick={isPlaying ? handlePause : handlePlay} style={btnStyle('#333', isPlaying ? '#f39c12' : '#2ecc71')}>
          {isPlaying ? 'PAUSE' : 'PLAY'}
        </button>
      </div>
    </div>
  );
};

const btnStyle = (bg, color) => ({
  flex: 1, background: bg, color: color, border: 'none', 
  padding: '8px', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold', fontSize: '10px'
});