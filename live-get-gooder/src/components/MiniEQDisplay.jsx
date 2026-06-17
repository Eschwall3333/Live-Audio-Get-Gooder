import React, { useRef, useEffect } from 'react';

export const MiniEQDisplay = ({ eq }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // 1. Paint the dark LCD background
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, width, height);

    // 2. Draw the 0dB center reference line
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // 3. BULLETPROOF FALLBACK: If eq is undefined, or if a specific band is missing, default to 0dB.
    const defaultBand = { gain: 0 };
    const bands = {
      low: eq?.low || defaultBand,
      lowMid: eq?.lowMid || defaultBand,
      highMid: eq?.highMid || defaultBand,
      high: eq?.high || defaultBand
    };

    // Map -15dB to +15dB into physical Y pixels (inverted so positive is UP)
    const getY = (gain) => (height / 2) - (gain / 15) * (height / 2 - 4);

    const pts = [
      { x: width * 0.1, y: getY(bands.low.gain) },
      { x: width * 0.35, y: getY(bands.lowMid.gain) },
      { x: width * 0.65, y: getY(bands.highMid.gain) },
      { x: width * 0.9, y: getY(bands.high.gain) }
    ];

    // 4. Draw the actual glowing EQ curve
    ctx.strokeStyle = '#17a2b8'; 
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    
    ctx.moveTo(0, height / 2); 
    ctx.lineTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.lineTo(pts[2].x, pts[2].y);
    ctx.lineTo(pts[3].x, pts[3].y);
    ctx.lineTo(width, height / 2); 
    ctx.stroke();

  }, [eq]); 

  return (
    <div style={{ 
      padding: '2px', background: '#000', borderRadius: '3px', 
      border: '1px inset #222', marginBottom: '10px' 
    }}>
      <canvas 
        ref={canvasRef} 
        width="80" 
        height="40" 
        style={{ width: '100%', display: 'block', borderRadius: '2px' }} 
      />
    </div>
  );
};