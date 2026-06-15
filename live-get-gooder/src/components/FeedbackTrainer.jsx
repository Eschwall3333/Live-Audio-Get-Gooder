import React, { useState } from 'react';
import { audioEngine } from '../audio/AudioEngine';

export const FeedbackTrainer = () => {
  const [active, setActive] = useState(false);
  const targetChannel = 1; // Hardcoded to Channel 1 for this lesson

  const toggleFeedback = () => {
    if (!active) {
      audioEngine.spawnFeedbackLoop(targetChannel);
      setActive(true);
    } else {
      audioEngine.killFeedbackLoop();
      setActive(false);
    }
  };

  return (
    <div style={{ background: '#2d2d35', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: active ? '2px solid #d9534f' : '2px solid transparent' }}>
      <h3 style={{ marginTop: 0, color: '#fff' }}>Ear Training: Kill the Feedback</h3>
      <p style={{ color: '#ccc', fontSize: '0.9rem', maxWidth: '600px' }}>
        <strong>Instructions:</strong> Activate the bad room acoustics below. Slowly push up the Preamp Gain and Fader on <strong>CH 01</strong>. 
        When the signal crosses the threshold, the room will start to ring. Use your High-Mid EQ band to sweep, find the ringing frequency, tighten your Q, and cut the gain until the squeal stops.
      </p>
      <button 
        onClick={toggleFeedback}
        style={{
          background: active ? '#d9534f' : '#f0ad4e',
          color: '#fff',
          border: 'none',
          padding: '10px 20px',
          fontSize: '1rem',
          fontWeight: 'bold',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        {active ? 'STOP / RESET ROOM' : 'ARM MIC IN "BAD ROOM" (CH 1)'}
      </button>
    </div>
  );
};