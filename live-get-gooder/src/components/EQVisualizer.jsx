import React, { useRef, useEffect, useMemo } from 'react';

// We create a single, silent "dummy" environment just to hijack the browser's C++ audio math engine
const getOfflineCtx = () => {
  const AudioContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  return new AudioContextClass(1, 44100, 44100);
};

export const EQVisualizer = ({ channel }) => {
  const canvasRef = useRef(null);

  // Instantiate our dummy mathematical filters once per visualizer
  const filters = useMemo(() => {
    const ctx = getOfflineCtx();
    return {
      hpf: ctx.createBiquadFilter(),
      low: ctx.createBiquadFilter(),
      lowMid: ctx.createBiquadFilter(),
      highMid: ctx.createBiquadFilter(),
      high: ctx.createBiquadFilter()
    };
  }, []);

  useEffect(() => {
    // 1. Configure filter types
    filters.hpf.type = 'highpass';
    filters.low.type = 'lowshelf';
    filters.lowMid.type = 'peaking';
    filters.highMid.type = 'peaking';
    filters.high.type = 'highshelf';

    // 2. Sync dummy filters to your Redux state
    filters.hpf.frequency.value = channel.hpfOn ? channel.hpfFreq : 0; // 0Hz essentially bypasses HPF visually
    
    filters.low.frequency.value = channel.eq.Low.freq;
    filters.low.gain.value = channel.eq.Low.gain;
    
    filters.lowMid.frequency.value = channel.eq.LowMid.freq;
    filters.lowMid.gain.value = channel.eq.LowMid.gain;
    filters.lowMid.Q.value = channel.eq.LowMid.q;

    filters.highMid.frequency.value = channel.eq.HighMid.freq;
    filters.highMid.gain.value = channel.eq.HighMid.gain;
    filters.highMid.Q.value = channel.eq.HighMid.q;

    filters.high.frequency.value = channel.eq.High.freq;
    filters.high.gain.value = channel.eq.High.gain;

    // 3. Prepare the Canvas
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const numPoints = width;

    // 4. Generate the Logarithmic X-Axis (20Hz to 20kHz)
    const freqArray = new Float32Array(numPoints);
    const minFreq = 20;
    const maxFreq = 20000;
    for (let i = 0; i < numPoints; i++) {
      freqArray[i] = minFreq * Math.pow(maxFreq / minFreq, i / (numPoints - 1));
    }

    // 5. Ask the browser to calculate the exact dB magnitude for every pixel
    const totalDb = new Float32Array(numPoints);
    const magResponse = new Float32Array(numPoints);
    const phaseResponse = new Float32Array(numPoints);
    
    const filterArray = [filters.hpf, filters.low, filters.lowMid, filters.highMid, filters.high];
    
    filterArray.forEach(f => {
      f.getFrequencyResponse(freqArray, magResponse, phaseResponse);
      for (let i = 0; i < numPoints; i++) {
        const mag = magResponse[i];
        if (mag > 0) totalDb[i] += 20 * Math.log10(mag);
        else totalDb[i] -= 100; // Floor out if magnitude drops to 0
      }
    });

    // 6. DRAW THE M32 SCREEN UI
    ctx.fillStyle = '#111113'; // Dark M32 Screen Background
    ctx.fillRect(0, 0, width, height);

    // Draw Grid Markers (100Hz, 1kHz, 10kHz vertical lines)
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    [100, 1000, 10000].forEach(f => {
       const x = (Math.log(f / minFreq) / Math.log(maxFreq / minFreq)) * width;
       ctx.moveTo(x, 0); ctx.lineTo(x, height);
    });
    // Draw 0dB Horizontal Center Line
    const y0 = height / 2;
    ctx.moveTo(0, y0); ctx.lineTo(width, y0);
    ctx.stroke();

    // 7. PLOT THE CURVE
    ctx.strokeStyle = '#00ffff'; // Classic Cyan UI Curve
    ctx.lineWidth = 2;
    ctx.beginPath();

    const maxVisualDb = 18; // Canvas Y-Axis limits (+/- 18dB)

    for (let i = 0; i < numPoints; i++) {
      let db = totalDb[i];
      if (db > maxVisualDb) db = maxVisualDb;
      if (db < -maxVisualDb) db = -maxVisualDb;

      // Map dB to pixel height (y0 is 0dB, up is positive, down is negative)
      const y = y0 - ((db / maxVisualDb) * y0);
      if (i === 0) ctx.moveTo(i, y);
      else ctx.lineTo(i, y);
    }
    ctx.stroke();

    // 8. Add the translucent Cyan fill underneath the curve for polish
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
    ctx.fill();

  }, [channel.eq, channel.hpfOn, channel.hpfFreq]); 
  // Re-renders seamlessly 60fps only when a knob is physically moving

  return (
    <div style={{ background: '#000', padding: '5px', borderRadius: '4px', marginBottom: '15px', border: '1px solid #333' }}>
      <canvas 
        ref={canvasRef} 
        width={200} 
        height={100} 
        style={{ display: 'block', width: '100%', borderRadius: '2px' }} 
      />
    </div>
  );
};