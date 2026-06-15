import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../audio/AudioEngine';

export const Meter = ({ channelId }) => {
  const fillRef = useRef(null);
  const reqRef = useRef();

  useEffect(() => {
    const updateMeter = () => {
      // Only run math if the AudioContext is actually unlocked and running
      if (audioEngine.ctx && audioEngine.ctx.state === 'running') {
        try {
          const ch = audioEngine.getChannel(channelId);
          const db = ch.getMeterLevel();

          // Map -60dB -> 0dB to a 0% -> 100% height scale
          let percent = ((db + 60) / 60) * 100;
          if (percent < 0) percent = 0;
          if (percent > 100) percent = 100;

          if (fillRef.current) {
            fillRef.current.style.height = `${percent}%`;
            
            // Color Logic: Green (-60 to -18), Yellow (-18 to -3), Red (Clipping)
            if (db > -3) {
              fillRef.current.style.background = '#d9534f'; // Clip (Red)
            } else if (db > -18) {
              fillRef.current.style.background = '#f0ad4e'; // Warning (Yellow)
            } else {
              fillRef.current.style.background = '#5cb85c'; // Safe (Green)
            }
          }
        } catch (e) {
          // Channel might not be initialized yet, fail silently
        }
      }
      // Loop the animation frame
      reqRef.current = requestAnimationFrame(updateMeter);
    };

    reqRef.current = requestAnimationFrame(updateMeter);
    
    // Cleanup loop on unmount
    return () => cancelAnimationFrame(reqRef.current);
  }, [channelId]);

  return (
    <div style={{ 
      width: '12px', 
      height: '300px', 
      background: '#111', 
      borderRadius: '4px', 
      position: 'relative', 
      overflow: 'hidden',
      marginTop: '120px',
      border: '1px solid #333'
    }}>
      <div 
        ref={fillRef} 
        style={{ 
          position: 'absolute', 
          bottom: 0, 
          left: 0, 
          width: '100%', 
          height: '0%', 
          transition: 'height 0.05s linear' // Slight smoothing so it mimics real LEDs
        }} 
      />
    </div>
  );
};