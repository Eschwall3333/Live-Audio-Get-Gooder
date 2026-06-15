import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateParam } from '../store/mixerSlice';
import { audioEngine } from '../audio/AudioEngine';

export const AudioLoader = ({ channelId }) => {
  const dispatch = useDispatch();
  
  // Connect to Redux to get the current transport state
  const channel = useSelector(state => state.mixer.channels.find(c => c.id === channelId));
  // Fallback to default if state is missing due to HMR cache
  const transport = channel.transport || { hasTrack: false, isPlaying: false };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    try {
      const audioBuffer = await audioEngine.ctx.decodeAudioData(arrayBuffer);
      audioEngine.loadTrackIntoChannel(channelId, audioBuffer);
      
      // Update state: Track loaded, but waiting for user to press play
      dispatch(updateParam({ channelId, key: 'transport', value: { hasTrack: true, isPlaying: false } }));
    } catch (err) {
      console.error("Error decoding audio data:", err);
    }
  };

  const handlePlay = () => {
    audioEngine.playChannelTrack(channelId);
    dispatch(updateParam({ channelId, key: 'transport', value: { ...transport, isPlaying: true } }));
  };

  const handlePause = () => {
    audioEngine.pauseChannelTrack(channelId);
    dispatch(updateParam({ channelId, key: 'transport', value: { ...transport, isPlaying: false } }));
  };

  const handleStop = () => {
    audioEngine.stopChannelTrack(channelId);
    dispatch(updateParam({ channelId, key: 'transport', value: { ...transport, isPlaying: false } }));
  };

  return (
    <div style={{ marginTop: '15px', fontSize: '0.8rem', width: '100%', background: '#3a3a45', padding: '10px', borderRadius: '6px', marginBottom: '15px' }}>
      <div style={{ fontWeight: 'bold', marginBottom: '10px', borderBottom: '1px solid #555' }}>TAPE MACHINE</div>
      
      <label htmlFor={`audio-loader-${channelId}`} className="sr-only">
        Upload Audio Stem for Channel {channelId}
      </label>

      <input 
        id={`audio-loader-${channelId}`}
        name={`audio-loader-${channelId}`}
        type="file" 
        accept="audio/*" 
        onChange={handleFileUpload} 
        style={{ width: '100%', marginBottom: '10px' }}
      />
      {/* TRANSPORT CONTROLS */}
      <div style={{ 
        display: 'flex', 
        gap: '5px', 
        opacity: transport.hasTrack ? 1 : 0.4, 
        pointerEvents: transport.hasTrack ? 'auto' : 'none' 
      }}>
        <button 
          onClick={handlePlay} 
          style={{ flex: 1, background: transport.isPlaying ? '#5cb85c' : '#555', color: '#fff', border: 'none', padding: '8px', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          ▶
        </button>
        <button 
          onClick={handlePause} 
          style={{ flex: 1, background: '#555', color: '#fff', border: 'none', padding: '8px', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          ⏸
        </button>
        <button 
          onClick={handleStop} 
          style={{ flex: 1, background: '#d9534f', color: '#fff', border: 'none', padding: '8px', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          ⏹
        </button>
      </div>
    </div>
  );
};