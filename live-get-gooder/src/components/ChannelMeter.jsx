import React, { useRef, useEffect } from 'react';
import { audioEngine } from '../audio/AudioEngine';

export const ChannelMeter = ({ channelId }) => {
  const canvasRef = useRef(null);
  const requestRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const width = canvas.width;
    const height = canvas.height;

    const drawMeter = () => {
      let db = -80; // Default to completely silent

      // THE SILENCER: Only ask the engine for volume if the engine is actually online!
      if (audioEngine.ctx) {
        try {
          const engineChannel = audioEngine.getChannel(channelId);
          if (engineChannel) {
            db = engineChannel.getLevel();
          }
        } catch (err) {
          // If the engine throws an initialization error, fail silently and keep the meter dark
        }
      }

      let percent = (db + 60) / 70; 
      if (percent < 0) percent = 0;
      if (percent > 1) percent = 1;

      const meterHeight = percent * height;

      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(0, 0, width, height);

      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, '#2ecc71');   
      gradient.addColorStop(0.7, '#f1c40f'); 
      gradient.addColorStop(0.9, '#e74c3c'); 

      ctx.fillStyle = gradient;
      ctx.fillRect(0, height - meterHeight, width, meterHeight);

      requestRef.current = requestAnimationFrame(drawMeter);
    };

    requestRef.current = requestAnimationFrame(drawMeter);
    return () => cancelAnimationFrame(requestRef.current);
  }, [channelId]);

  return (
    <div style={{ background: '#000', padding: '2px', borderRadius: '3px', border: '1px solid #222' }}>
      <canvas 
        ref={canvasRef} 
        width="10" 
        height="250" 
        style={{ display: 'block', borderRadius: '2px' }}
      />
    </div>
  );
};